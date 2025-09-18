import TelegramUser from "../models/telegramUser";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import bigInt from "big-integer";
import TelegramPage from "../models/telegramPage";
import { v2 as cloudinary } from "cloudinary";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

// Initialize Cloudinary configuration
cloudinary.config({
  cloud_name: "dmvudmx86",
  api_key: "737943533352822",
  api_secret: "LILUHv0IFf790mbLoXndhKki34E", // Use environment variable
});

// const telegramBot = new TelegramBot("8343683334:AAE8RnQAJ28npHfR9gNWME9LrGktIsPOk0E", { polling: true });

// Interfaces
interface AuthSessionData {
  client: TelegramClient;
  phoneCodeHash: string;
  phoneNumber: string;
  createdAt: Date;
}

interface ChannelInfo {
  id: string;
  title: string;
  type: string;
  username: string | null;
  memberCount: number;
  isAdmin: boolean;
  isCreator: boolean;
  isVerified: boolean;
  isScam: boolean;
  isFake: boolean;
  date?: number;
  description?: string | null;
  inviteLink?: string;
}

const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "23351709");
const TELEGRAM_API_HASH =
  process.env.TELEGRAM_API_HASH || "0c736ebb3f791b108a9539f83b8ff73e";

// Storage for authentication sessions
const authSessions = new Map<string, AuthSessionData>();
const userSessions = new Map<string, string>();

// Ensure directories exist
const sessionsDir = path.join(process.cwd(), "telegram-sessions");
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

// Helper function to normalize phone number format
function normalizePhoneNumber(phoneNumber: string): string {
  let cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
  if (!cleanNumber.startsWith("+")) {
    if (cleanNumber.length === 10) {
      cleanNumber = `+91${cleanNumber}`;
    } else {
      cleanNumber = `+${cleanNumber}`;
    }
  }
  return cleanNumber;
}

// Session management functions
function saveUserSession(phoneNumber: string, sessionString: any): void {
  const normalizedNumber = normalizePhoneNumber(phoneNumber);
  const sessionFile = path.join(
    sessionsDir,
    `${normalizedNumber.replace(/[^0-9+]/g, "")}.session`
  );
  fs.writeFileSync(sessionFile, sessionString);
  userSessions.set(normalizedNumber, sessionString);
}

function loadUserSession(phoneNumber: string): string {
  const normalizedNumber = normalizePhoneNumber(phoneNumber);
  const sessionFile = path.join(
    sessionsDir,
    `${normalizedNumber.replace(/[^0-9+]/g, "")}.session`
  );
  if (fs.existsSync(sessionFile)) {
    const sessionString = fs.readFileSync(sessionFile, "utf8");
    userSessions.set(normalizedNumber, sessionString);
    return sessionString;
  }
  return "";
}

// Clean up expired auth sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [phoneNumber, session] of authSessions.entries()) {
    const sessionAge = now - session.createdAt.getTime();
    if (sessionAge > 10 * 60 * 1000) {
      // 10 minutes
      console.log(`Cleaning up expired session for: ${phoneNumber}`);
      try {
        session.client.destroy();
      } catch (error) {
        console.error("Error destroying client:", error);
      }
      authSessions.delete(phoneNumber);
    }
  }
}, 60 * 1000); // Check every minute

const botToken = "8343683334:AAE8RnQAJ28npHfR9gNWME9LrGktIsPOk0E";
const baseUrl = `https://api.telegram.org/bot${botToken}`
export default class TelegramController {

  static AddUserToChannel = async (req: any, res: any) => {
    try {
      const { channelId, userId, apiToken } = req.body;
      
      console.log("Request received with data:", { channelId, userId, apiToken });
      
      // Validate required parameters
      if (!channelId || !userId || !apiToken) {
        return res.status(400).json({ 
          error: 'Channel ID, User ID, and API Token are required' 
        });
      }
  
      // Format channel ID correctly
      let formattedChannelId = channelId;
      if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
        formattedChannelId = `-100${channelId}`;
        console.log("Converting channel ID to:", formattedChannelId);
      }
  
      // Convert user ID to number
      const numericUserId = parseInt(userId, 10);
      if (isNaN(numericUserId)) {
        return res.status(400).json({ 
          error: 'Invalid User ID format',
          details: 'User ID must be a valid number'
        });
      }
  
      // First, check if the bot is an admin in the channel
      try {
        const botInfoResponse = await axios.get(
          `https://api.telegram.org/bot${apiToken}/getMe`
        );
        
        const botId = botInfoResponse.data.result.id;
        console.log("Bot ID:", botId);
  
        // Check if bot is admin in the channel
        const chatMemberResponse = await axios.get(
          `https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`
        );
        
        const botStatus = chatMemberResponse.data.result.status;
        console.log("Bot status in channel:", botStatus);
        
        if (botStatus !== 'administrator' && botStatus !== 'creator') {
          return res.status(403).json({ 
            error: 'Bot is not an administrator in the specified channel',
            details: 'Please make sure the bot has been added as an admin with appropriate permissions'
          });
        }
  
        // Check if bot has permission to add users
        const canInviteUsers = chatMemberResponse.data.result.can_invite_users;
        console.log("Bot can invite users:", canInviteUsers);
        
        if (!canInviteUsers) {
          return res.status(403).json({ 
            error: 'Bot does not have permission to invite users',
            details: 'Please grant the bot "Invite Users" permission in the channel settings'
          });
        }
      } catch (error) {
        console.error('Error checking bot admin status:', error.response?.data || error.message);
        
        if (error.response?.data.error_code === 400) {
          return res.status(404).json({ 
            error: 'Bot is not a member of the specified channel',
            details: 'Please add the bot to the channel first and make it an administrator'
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to verify bot permissions',
          details: error.response?.data?.description || error.message
        });
      }
  
      // Check if user is already a member of the channel
      try {
        const userStatusResponse = await axios.get(
          `https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`
        );
        
        const userStatus = userStatusResponse.data.result.status;
        console.log("User status in channel:", userStatus);
        
        if (userStatus !== 'left' && userStatus !== 'kicked') {
          return res.status(400).json({ 
            error: 'User is already a member of the channel',
            details: `User status: ${userStatus}`
          });
        }
      } catch (statusError) {
        console.log("User is not a member of the channel or error checking status:", statusError.response?.data || statusError.message);
      }
  
      // METHOD 1: First try to add user directly using inviteChatMember
      try {
        console.log("Trying to add user directly with inviteChatMember...");
        const response = await axios.post(
          `https://api.telegram.org/bot${apiToken}/inviteChatMember`,
          {
            chat_id: formattedChannelId,
            user_id: numericUserId
          }
        );
  
        console.log("User added successfully with inviteChatMember:", response.data);
        
        return res.json({ 
          success: true, 
          message: `User ${userId} successfully added to channel ${channelId}`,
          data: response.data
        });
      } catch (inviteError) {
        console.error('Error with inviteChatMember:', inviteError.response?.data || inviteError.message);
        
        // METHOD 2: If direct add fails, try to use approveChatJoinRequest
        // (This will work if user has sent a join request)
        try {
          console.log("Trying approveChatJoinRequest method...");
          console.log(numericUserId,"feklwmlk", formattedChannelId)
          const response = await axios.post(
            `https://api.telegram.org/bot${apiToken}/approveChatJoinRequest`,
            {
              chat_id: formattedChannelId,
              user_id: numericUserId,
              hide_requester: false  // ✅ Yeh parameter add kar
            }
          );
  
          console.log("Join request approved successfully:", response.data);
          
          return res.json({ 
            success: true, 
            message: `User ${userId} added to channel ${channelId} by approving their join request`,
            data: response.data
          });
        } catch (approveError) {
          console.error('Error with approveChatJoinRequest:', approveError.response?.data || approveError.message);
          
          // METHOD 3: If both fail, create an invite link and approve it automatically
          try {
            console.log("Creating special invite link for user...");
            const inviteLinkResponse = await axios.post(
              `https://api.telegram.org/bot${apiToken}/createChatInviteLink`,
              {
                chat_id: formattedChannelId,
                member_limit: 1,
                name: `invite-for-${userId}`,
                creates_join_request: false
              }
            );
  
            const inviteLink = inviteLinkResponse.data.result.invite_link;
            console.log("Created special invite link:", inviteLink);
            
            // Try to use the invite link programmatically
            // Note: This is a workaround since we can't force users to click links
            
            return res.json({ 
              success: true, 
              message: `Created special invite link for user. Share this link: ${inviteLink}`,
              invite_link: inviteLink,
              note: "User needs to click this link to join the channel"
            });
          } catch (finalError) {
            console.error('All methods failed:', finalError.response?.data || finalError.message);
            
            // Return detailed error information
            return res.status(500).json({ 
              error: 'All methods failed to add user to channel',
              details: finalError.response?.data?.description || finalError.message,
              possibleReasons: [
                'User might have privacy restrictions preventing them from being added',
                'Channel might have restrictions on who can add members',
                'Bot might need additional permissions',
                'User ID might be incorrect or user might have blocked the bot'
              ]
            });
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error in AddUserToChannel:', error);
      
      return res.status(500).json({ 
        error: 'Unexpected error occurred',
        details: error.message
      });
    }
  };

  static RemoveUserFromChannel = async (req: any, res: any) => {
    try {
      const { channelId, userId, apiToken } = req.body;
      
      console.log("Remove user request received with data:", { channelId, userId, apiToken });
      
      // Validate required parameters
      if (!channelId || !userId || !apiToken) {
        return res.status(400).json({ 
          error: 'Channel ID, User ID, and API Token are required' 
        });
      }
  
      // Format channel ID correctly
      let formattedChannelId = channelId;
      if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
        formattedChannelId = `-100${channelId}`;
        console.log("Converting channel ID to:", formattedChannelId);
      }
  
      // Convert user ID to number
      const numericUserId = parseInt(userId, 10);
      if (isNaN(numericUserId)) {
        return res.status(400).json({ 
          error: 'Invalid User ID format',
          details: 'User ID must be a valid number'
        });
      }
  
      // First, check if the bot is an admin and has permission to ban users
      try {
        const botInfoResponse = await axios.get(
          `https://api.telegram.org/bot${apiToken}/getMe`
        );
        
        const botId = botInfoResponse.data.result.id;
        console.log("Bot ID:", botId);
  
        // Check if bot is admin in the channel
        const chatMemberResponse = await axios.get(
          `https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`
        );
        
        const botStatus = chatMemberResponse.data.result.status;
        console.log("Bot status in channel:", botStatus);
        
        if (botStatus !== 'administrator' && botStatus !== 'creator') {
          return res.status(403).json({ 
            error: 'Bot is not an administrator in the specified channel',
            details: 'Please make sure the bot has been added as an admin with appropriate permissions'
          });
        }
  
        // Check if bot has permission to ban/restrict users
        const canRestrictMembers = chatMemberResponse.data.result.can_restrict_members;
        console.log("Bot can restrict members:", canRestrictMembers);
        
        if (!canRestrictMembers) {
          return res.status(403).json({ 
            error: 'Bot does not have permission to remove users',
            details: 'Please grant the bot "Ban Users" permission in the channel settings'
          });
        }
      } catch (error) {
        console.error('Error checking bot admin status:', error.response?.data || error.message);
        
        if (error.response?.data.error_code === 400) {
          return res.status(404).json({ 
            error: 'Bot is not a member of the specified channel',
            details: 'Please add the bot to the channel first and make it an administrator'
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to verify bot permissions',
          details: error.response?.data?.description || error.message
        });
      }
  
      // Check if user is actually a member of the channel
      try {
        const userStatusResponse = await axios.get(
          `https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`
        );
        
        const userStatus = userStatusResponse.data.result.status;
        console.log("User status in channel:", userStatus);
        
        if (userStatus === 'left' || userStatus === 'kicked') {
          return res.status(400).json({ 
            error: 'User is not a member of the channel',
            details: `User status: ${userStatus}`
          });
        }
      } catch (statusError) {
        console.log("Error checking user status:", statusError.response?.data || statusError.message);
        return res.status(400).json({ 
          error: 'User is not a member of the channel or invalid user ID'
        });
      }
  
      // METHOD 1: Try to ban the user (permanently remove)
      try {
        console.log("Trying to ban user...");
        const response = await axios.post(
          `https://api.telegram.org/bot${apiToken}/banChatMember`,
          {
            chat_id: formattedChannelId,
            user_id: numericUserId,
            revoke_messages: false // Set true to delete all messages from user
          }
        );
  
        console.log("User banned successfully:", response.data);
        
        return res.json({ 
          success: true, 
          message: `User ${userId} successfully removed from channel ${channelId}`,
          data: response.data
        });
      } catch (banError) {
        console.error('Error with banChatMember:', banError.response?.data || banError.message);
        
        // METHOD 2: If ban fails, try to kick the user (temporary remove)
        try {
          console.log("Trying to kick user...");
          const response = await axios.post(
            `https://api.telegram.org/bot${apiToken}/banChatMember`,
            {
              chat_id: formattedChannelId,
              user_id: numericUserId,
              until_date: Math.floor(Date.now() / 1000) + 30, // 30 seconds se ban
              revoke_messages: false
            }
          );
  
          console.log("User kicked successfully:", response.data);
          
          return res.json({ 
            success: true, 
            message: `User ${userId} successfully kicked from channel ${channelId}`,
            data: response.data
          });
        } catch (kickError) {
          console.error('Error with kick:', kickError.response?.data || kickError.message);
          
          // Return detailed error information
          return res.status(500).json({ 
            error: 'Failed to remove user from channel',
            details: kickError.response?.data?.description || kickError.message,
            possibleReasons: [
              'Bot might not have sufficient permissions',
              'User might be the channel owner',
              'User might be an admin with higher privileges than bot'
            ]
          });
        }
      }
    } catch (error) {
      console.error('Unexpected error in RemoveUserFromChannel:', error);
      
      return res.status(500).json({ 
        error: 'Unexpected error occurred',
        details: error.message
      });
    }
  };

  static getBotInfo = async() => {
    try {
      console.log(baseUrl,"Saflkew")
      const response = await axios.get(`${baseUrl}/getMe`);
      console.log(response.data,"Delkwnd")
      return response.data;
    } catch (error) {
      console.log("d;kmelw")
      throw new Error(`Failed to get bot info: ${error.message}`);
    }
  }

  /**
   * Add bot to a channel as an administrator
   */
  static addBotToChannel = async(req: any, res: any) => {
    try {
      const { channelId } = req.body;
      // First, we need to get the bot's information
      const botInfo = await this.getBotInfo();
      console.log(botInfo,"Demw, ")
      console.log(botInfo?.result,"Dqrdelkemw, ")
      
      // Construct the deep link to add the bot as an administrator
      // Note: This is a simplified approach. In a real scenario, you might need
      // to use the Telegram Bot API's promoteChatMember method or create an invite link
      
      const deepLink = `https://t.me/${botInfo.result.username}?startchannel=${channelId}&admin=post_messages+edit_messages+delete_messages+invite_users+restrict_members+pin_messages+promote_members+change_info+add_subscribers`;
      
      return res.json({
        success: true,
        message: 'Use the following link to add the bot as an administrator to your channel',
        deepLink: deepLink,
        instructions: [
          '1. Open the link above in a web browser',
          '2. Select your channel from the options',
          '3. Grant all administrator privileges to the bot',
          '4. Confirm the action'
        ]
      });
    } catch (error) {
      throw new Error(`Failed to generate bot addition link: ${error.message}`);
    }
  }

  static validateToken = async (req: any, res: any, next: any) => {
    console.log(req.body,"Dewlmk")
    const { apiToken } = req.body;
    console.log(apiToken,"Fewm,,")
    
    if (!apiToken) {
      return res.status(400).json({ error: 'API token is required' });
    }
    
    try {
      // Verify the token is valid by calling getMe
      const response = await axios.get(`https://api.telegram.org/bot${apiToken}/getMe`);
      console.log(response.data?.result,"Dwkl")
      req.botInfo = response.data.result;
      // next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid API token' });
    }
  };


  // Step 1: Initiate login process
  static sendOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, userName } = req.body;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
        return;
      }

      // Format phone number properly
      const cleanNumber = normalizePhoneNumber(phoneNumber);

      if (!cleanNumber.match(/^\+?[1-9]\d{10,14}$/)) {
        res.status(400).json({
          success: false,
          message: "Invalid phone number format. Use: +911234567890",
        });
        return;
      }

      // Check if user already has active session
      const existingUser = await TelegramUser.findOne({
        phoneNumber: cleanNumber,
        userName: userName,
      });
      if (
        existingUser &&
        existingUser.verified &&
        loadUserSession(cleanNumber)
      ) {
        try {
          // Fetch user's created channels
          const channels = await TelegramController.fetchUserChannels(
            cleanNumber
          );

          res.json({
            success: true,
            message: "Welcome back! You are already logged in.",
            verified: true,
            hasSession: true,
            channels: channels,
            totalChannels: channels.length,
            user: {
              phoneNumber: cleanNumber,
              verifiedAt: existingUser.verifiedAt,
            },
          });
        } catch (error) {
          console.error("❌ Error fetching channels for existing user:", error);
          res.json({
            success: true,
            message: "Welcome back! You are already logged in.",
            verified: true,
            hasSession: true,
            channels: [],
            totalChannels: 0,
            user: {
              phoneNumber: cleanNumber,
              verifiedAt: existingUser.verifiedAt,
            },
          });
        }
        return;
      }

      // Create a new Telegram client
      const stringSession = new StringSession("");
      const client = new TelegramClient(
        stringSession,
        TELEGRAM_API_ID,
        TELEGRAM_API_HASH,
        {
          connectionRetries: 5,
          useWSS: false,
          timeout: 10000,
        }
      );

      await client.connect();

      // Send code request
      const { phoneCodeHash } = await client.sendCode(
        {
          apiId: TELEGRAM_API_ID,
          apiHash: TELEGRAM_API_HASH,
        },
        cleanNumber
      );

      // Store the authentication session
      authSessions.set(cleanNumber, {
        client,
        phoneCodeHash,
        phoneNumber: cleanNumber,
        createdAt: new Date(),
      });

      console.log("OTP sent to:", cleanNumber);
      console.log("Active sessions:", Array.from(authSessions.keys()));

      res.json({
        success: true,
        message: "OTP sent! Check your Telegram app for the verification code.",
        phoneNumber: cleanNumber,
        expiresIn: 10, // minutes
      });
    } catch (error: any) {
      console.error("❌ Error initiating login:", error);

      if (error.message.includes("PHONE_NUMBER_INVALID")) {
        res.status(400).json({
          success: false,
          message: "Invalid phone number format.",
        });
      } else if (error.message.includes("PHONE_NUMBER_FLOOD")) {
        res.status(400).json({
          success: false,
          message: "Too many attempts. Please try again later.",
        });
      } else if (error.message.includes("PHONE_NUMBER_BANNED")) {
        res.status(400).json({
          success: false,
          message: "This phone number is banned from Telegram.",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to initiate login process: " + error.message,
        });
      }
    }
  };

  // Step 2: Verify OTP
  static verifyLoginOtp = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { phoneNumber, otp, userName } = req.body;

      if (!phoneNumber || !otp) {
        res.status(400).json({
          success: false,
          message: "Phone number and OTP are required.",
        });
        return;
      }

      const cleanNumber = normalizePhoneNumber(phoneNumber);

      console.log("Verifying OTP for:", cleanNumber);
      console.log("Available auth sessions:", Array.from(authSessions.keys()));

      const authSession = authSessions.get(cleanNumber);

      if (!authSession) {
        console.log("No active session found for:", cleanNumber);

        res.status(400).json({
          success: false,
          message:
            "No active session found for this phone number. Please request a new OTP.",
        });
        return;
      }

      // Check if session is expired
      const sessionAge = Date.now() - authSession.createdAt.getTime();
      if (sessionAge > 10 * 60 * 1000) {
        authSession.client.destroy();
        authSessions.delete(cleanNumber);

        res.status(400).json({
          success: false,
          message: "Session expired. Please request a new OTP.",
        });
        return;
      }

      try {
        // Sign in with the code
        const result = await authSession.client.invoke(
          new Api.auth.SignIn({
            phoneNumber: cleanNumber,
            phoneCodeHash: authSession.phoneCodeHash,
            phoneCode: otp,
          })
        );

        console.log(result,"Sdlkwenkj")

        // Save the session
        const sessionString = authSession.client.session.save();
        saveUserSession(cleanNumber, sessionString);

        // DON'T destroy the client immediately - this prevents notifications
        // Instead, just remove from authSessions and let it remain connected
        authSessions.delete(cleanNumber);

        // Save or update user
        let telegramUser = await TelegramUser.findOne({
          phoneNumber: cleanNumber,
          userName: userName,
        });
        if (!telegramUser) {
          telegramUser = new TelegramUser({
            phoneNumber: cleanNumber,
            userName: userName,
            verified: true,
            verifiedAt: new Date(),
          });
        } else {
          telegramUser.verified = true;
          telegramUser.verifiedAt = new Date();
        }

        await telegramUser.save();

        // Fetch user channels
        const channels = await TelegramController.fetchUserChannels(
          cleanNumber
        );

        res.json({
          success: true,
          message: "Login successful!",
          verified: true,
          authenticated: true,
          channels: channels,
          totalChannels: channels.length,
          user: {
            phoneNumber: cleanNumber,
            verifiedAt: telegramUser.verifiedAt,
          },
        });
      } catch (error: any) {
        console.error("❌ Error during sign-in:", error);

        // Clean up failed session
        authSession.client.destroy();
        authSessions.delete(cleanNumber);

        if (error.message.includes("PHONE_CODE_INVALID")) {
          res.status(400).json({
            success: false,
            message: "Invalid OTP code.",
          });
        } else if (error.message.includes("PHONE_CODE_EXPIRED")) {
          res.status(400).json({
            success: false,
            message: "OTP code has expired. Please request a new one.",
          });
        } else if (error.message.includes("SESSION_PASSWORD_NEEDED")) {
          res.status(400).json({
            success: false,
            message:
              "Two-factor authentication is enabled. Please provide your password.",
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to verify OTP: " + error.message,
          });
        }
      }
    } catch (error: any) {
      console.error("❌ Unexpected error in verifyLoginOtp:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during OTP verification.",
      });
    }
  };

  // Fetch user channels
  // Optimized fetchUserChannels function
  static fetchUserChannels = async (
    phoneNumber: string
  ): Promise<ChannelInfo[]> => {
    try {
      const sessionString = loadUserSession(phoneNumber);
      if (!sessionString) {
        throw new Error("No session found for user");
      }

      const stringSession = new StringSession(sessionString);
      const client = new TelegramClient(
        stringSession,
        TELEGRAM_API_ID,
        TELEGRAM_API_HASH,
        {
          connectionRetries: 2, // Reduced from 3
          timeout: 8000, // Reduced from 15000
        }
      );

      await client.connect();

      // Get current user info once
      const me = await client.getMe();
      const myId = me.id;

      const result: any = await client.invoke(
        new Api.messages.GetDialogs({
          offsetDate: 0,
          offsetId: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          limit: 200, // Reduced from 500 for faster response
          hash: bigInt(0),
        })
      );

      const channels: ChannelInfo[] = [];
      const channelPromises: Promise<void>[] = [];

      // Pre-filter to only process channels (not groups/chats)
      const relevantChats = result.chats.filter((chat: any) => {
        return (
          chat.className === "Channel" &&
          !chat.left && // Skip left chats
          !chat.deactivated
        ); // Skip deactivated chats
      });

      // Process chats in parallel with concurrency limit
      const CONCURRENCY_LIMIT = 5;
      const semaphore = new Array(CONCURRENCY_LIMIT).fill(Promise.resolve());

      for (const chat of relevantChats) {
        const promise = semaphore.shift()!.then(async () => {
          try {
            let memberCount = 0;
            let isAdmin = false;
            let isCreator = false;
            let inviteLink = null;

            if (chat.className === "Channel") {
              // Quick check for creator status using basic chat info first
              if (chat.creator === true) {
                isCreator = true;
                isAdmin = true;
              } else {
                // Only do detailed check if basic info suggests user might be creator/admin
                try {
                  const participant = (await Promise.race([
                    client.invoke(
                      new Api.channels.GetParticipant({
                        channel: chat.id,
                        participant: myId,
                      })
                    ),
                    new Promise((_, reject) =>
                      setTimeout(() => reject(new Error("Timeout")), 3000)
                    ),
                  ])) as any;

                  if (participant) {
                    isCreator =
                      participant.participant.className ===
                      "ChannelParticipantCreator";
                    isAdmin =
                      isCreator ||
                      participant.participant.className ===
                        "ChannelParticipantAdmin";
                  }
                } catch (err) {
                  // Skip if can't determine status quickly
                  return;
                }
              }

              // Only get detailed info for creator channels
              if (isCreator) {
                try {
                  const fullChannel = (await Promise.race([
                    client.invoke(
                      new Api.channels.GetFullChannel({ channel: chat.id })
                    ),
                    new Promise((_, reject) =>
                      setTimeout(() => reject(new Error("Timeout")), 2000)
                    ),
                  ])) as any;

                  memberCount = fullChannel.fullChat.participantsCount || 0;

                  // Get invite link only if needed
                  if (isAdmin) {
                    try {
                      const exportedInvite = (await Promise.race([
                        client.invoke(
                          new Api.messages.ExportChatInvite({
                            peer: chat.id,
                            legacyRevokePermanent: false,
                          })
                        ),
                        new Promise((_, reject) =>
                          setTimeout(() => reject(new Error("Timeout")), 1500)
                        ),
                      ])) as any;

                      inviteLink = exportedInvite.link;
                    } catch (inviteError) {
                      // Silent fail for invite link
                    }
                  }
                } catch (err) {
                  // Use fallback data if full channel info fails
                  memberCount = (chat as any).participantsCount || 0;
                }
              }
            }

            // Only add channels/groups where the user is the creator
            if (isCreator) {
              channels.push({
                id: chat.id.toString(),
                title: (chat as any).title,
                type:
                  chat.className === "Channel"
                    ? (chat as any).broadcast
                      ? "channel"
                      : "supergroup"
                    : "group",
                username: (chat as any).username || null,
                memberCount: memberCount,
                isAdmin: isAdmin,
                isCreator: isCreator,
                isVerified: (chat as any).verified || false,
                isScam: (chat as any).scam || false,
                isFake: (chat as any).fake || false,
                date: (chat as any).date,
                description: null,
                inviteLink: inviteLink,
              });
            }
          } catch (err) {
            console.log(`Skipped chat due to error: ${(chat as any).title}`);
          }
        });

        channelPromises.push(promise);
        semaphore.push(promise);
      }

      // Wait for all promises with overall timeout
      await Promise.race([
        Promise.allSettled(channelPromises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Overall timeout")), 5000)
        ),
      ]);

      await client.disconnect();

      // Sort by member count (descending)
      return channels.sort((a, b) => b.memberCount - a.memberCount);
    } catch (error) {
      console.error("❌ Error fetching channels:", error);
      throw error;
    }
  };

  // Get user channels endpoint
  static getUserChannels = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
        return;
      }

      const cleanNumber = normalizePhoneNumber(phoneNumber);

      // Check if user has an active session
      const sessionString = loadUserSession(cleanNumber);
      if (!sessionString) {
        res.status(401).json({
          success: false,
          message: "No active session found. Please login first.",
        });
        return;
      }

      const channels = await TelegramController.fetchUserChannels(cleanNumber);

      res.json({
        success: true,
        channels: channels,
        totalChannels: channels.length,
      });
    } catch (error: any) {
      console.error("❌ Error fetching user channels:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch channels: " + error.message,
      });
    }
  };

  static createChannel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, channelName, channelDescription, isPublic } =
        req.body;

      if (!phoneNumber || !channelName) {
        res.status(400).json({
          success: false,
          message: "Phone number and channel name are required",
        });
        return;
      }

      const cleanNumber = normalizePhoneNumber(phoneNumber);

      // Check if user has an active session
      const sessionString = loadUserSession(cleanNumber);
      if (!sessionString) {
        res.status(401).json({
          success: false,
          message: "No active session found. Please login first.",
        });
        return;
      }

      // Create Telegram client
      const stringSession = new StringSession(sessionString);
      const client = new TelegramClient(
        stringSession,
        TELEGRAM_API_ID,
        TELEGRAM_API_HASH,
        {
          connectionRetries: 3,
          timeout: 15000,
        }
      );

      await client.connect();

      try {
        // Create the channel
        const result: any = await client.invoke(
          new Api.channels.CreateChannel({
            title: channelName,
            about: channelDescription || "",
            megagroup: false,
            broadcast: true,
            forImport: false,
          })
        );

        const channel = result.chats[0];

        // If it's a public channel, try to set a username
        if (isPublic && channel) {
          try {
            // Generate a simple username from channel name
            const username =
              channelName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "_")
                .substring(0, 20) +
              "_" +
              Math.random().toString(36).substring(2, 7);

            await client.invoke(
              new Api.channels.UpdateUsername({
                channel: channel.id,
                username: username,
              })
            );
          } catch (usernameError) {
            console.warn("Could not set username for channel:", usernameError);
            // Continue without username - channel will be private
          }
        }

        // Update channel description if provided - FIXED THE ERROR HERE
        if (channelDescription) {
          try {
            // Use the correct API method for setting channel description
            await client.invoke(
              new Api.messages.EditChatAbout({
                peer: channel.id,
                about: channelDescription,
              })
            );
          } catch (descriptionError) {
            console.warn(
              "Could not set channel description:",
              descriptionError
            );

            // Alternative approach for some channel types
            try {
              await client.invoke(
                new Api.channels.EditTitle({
                  channel: channel.id,
                  title: channelName,
                })
              );
            } catch (titleError) {
              console.warn(
                "Could not update channel title either:",
                titleError
              );
            }
          }
        }

        // Get the invite link for the new channel
        let inviteLink = null;
        try {
          const exportedInvite = (await client.invoke(
            new Api.messages.ExportChatInvite({
              peer: channel.id,
              legacyRevokePermanent: false,
            })
          )) as any;
          inviteLink = exportedInvite.link;
        } catch (inviteError) {
          console.warn("Could not get invite link:", inviteError);
        }

        await client.disconnect();

        // Return the created channel info
        res.json({
          success: true,
          message: "Channel created successfully",
          channel: {
            id: channel.id.toString(),
            title: channelName,
            type: "channel",
            username: (channel as any).username || null,
            inviteLink: inviteLink,
            isPublic: isPublic || false,
          },
        });
      } catch (error: any) {
        // Ensure client is properly disconnected even on errors
        try {
          await client.disconnect();
        } catch (disconnectError) {
          console.warn("Error disconnecting client:", disconnectError);
        }

        console.error("❌ Error creating channel:", error);

        // More specific error handling
        if (error.errorMessage) {
          switch (error.errorMessage) {
            case "CHANNELS_TOO_MUCH":
              res.status(400).json({
                success: false,
                message:
                  "You have created too many channels. Please wait before creating more.",
              });
              break;
            case "CHAT_TITLE_EMPTY":
              res.status(400).json({
                success: false,
                message: "Channel name cannot be empty.",
              });
              break;
            case "CHANNEL_INVALID":
              res.status(400).json({
                success: false,
                message: "Invalid channel parameters.",
              });
              break;
            case "CHAT_ABOUT_TOO_LONG":
              res.status(400).json({
                success: false,
                message: "Channel description is too long.",
              });
              break;
            default:
              res.status(500).json({
                success: false,
                message: `Failed to create channel: ${error.errorMessage}`,
              });
          }
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to create channel: Unknown error occurred",
          });
        }
      }
    } catch (error: any) {
      console.error("❌ Unexpected error in createChannel:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during channel creation.",
      });
    }
  };

  static createTelegramPage = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const requestPayload = req.body;
    try {
      const newTelegramPage = await TelegramPage.create(requestPayload);
      res.json({
        success: true,
        result: newTelegramPage,
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err,
      });
    }
  };

  static imageUpload = async (req: any, res: any) => {
    try {
      console.log(req.body, "Sd;lkmew");
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      // Validate it's an image
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      // Convert buffer to base64 for Cloudinary
      const fileStr = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;
      // console.log(fileStr,"ASd;lwek")

      const uploadResult = await cloudinary.uploader.upload(fileStr, {
        public_id: `img_${Date.now()}`,
        quality: "auto:best",
        fetch_format: "auto",
        width: 1500,
        height: 1500,
        crop: "limit",
        format: "jpg",
        transformation: [
          {
            quality: "80",
            dpr: "auto",
          },
        ],
      });

      console.log(uploadResult, "Sdfmw,e");

      const telegramImage = await TelegramPage.findOneAndUpdate(
        { _id: req.body.telegramId },
        { $set: { imageUrl: uploadResult?.secure_url } },
        { new: true }
      );

      console.log(telegramImage, "dewkl");

      return res.status(200).json({
        message: "File uploaded successfully",
        url: uploadResult.secure_url,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: err.message });
    }
  };

  static countAllTelegramPagesByUserName = async (req: any, res: any) => {
    const userName = req.query.userName;
    const query: any = {};
    if (userName !== "ADMIN") {
      query.userName = userName;
    }
    const counts = await TelegramPage.aggregate([
      {
        $match: query,
      },
      {
        $facet: {
          total: [{ $count: "count" }],
          active: [{ $match: { status: "ACTIVE" } }, { $count: "count" }],
          inactive: [{ $match: { status: "INACTIVE" } }, { $count: "count" }],
          rejected: [{ $match: { status: "REJECTED" } }, { $count: "count" }],
        },
      },
    ]);

    // Extract the counts from the aggregation result
    const result = {
      total: counts[0]?.total[0]?.count || 0,
      active: counts[0]?.active[0]?.count || 0,
      inActive: counts[0]?.inactive[0]?.count || 0,
      rejected: counts[0]?.rejected[0]?.count || 0,
    };
    return res.send(result);
  };

  static getAllTelegramPagesPaginated = async (req: any, res: any) => {
    const payload = req.body;
    const query: any = {
      status: payload.status,
    };
    if (payload.userName !== "ADMIN") {
      query.userName = payload.userName;
    }
    const pageNo = payload?.pageNo;
    const pageSize = payload?.pageSize;
    const result = await TelegramPage.find(query)
      .sort({ createdAt: -1 }) // Sort in descending order
      .skip(pageNo * pageSize)
      .limit(pageSize);
    return res.send(result);
  };

  static getTelegramPageDetailsById = async (req: any, res: any) => {
    const payload = req.query.telegramId;
    const result = await TelegramPage.findOne({ _id: payload });
    return res.send(result);
  };

  // Logout endpoint
  static logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, userName } = req.body;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
        return;
      }

      const cleanNumber = normalizePhoneNumber(phoneNumber);

      // Remove session files
      const sessionFile = path.join(
        sessionsDir,
        `${cleanNumber.replace(/[^0-9+]/g, "")}.session`
      );
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }

      // Remove from memory
      userSessions.delete(cleanNumber);
      authSessions.delete(cleanNumber);

      // Update user record
      await TelegramUser.findOneAndUpdate(
        { phoneNumber: cleanNumber, userName: userName },
        { verified: false, verifiedAt: null }
      );

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      console.error("❌ Error during logout:", error);
      res.status(500).json({
        success: false,
        message: "Failed to logout: " + error.message,
      });
    }
  };

  // Check session status
  static checkSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, userName } = req.params;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
        return;
      }

      const cleanNumber = normalizePhoneNumber(phoneNumber);
      const hasSession = !!loadUserSession(cleanNumber);
      const hasAuthSession = authSessions.has(cleanNumber);

      const user = await TelegramUser.findOne({
        phoneNumber: cleanNumber,
        userName: userName,
      });

      res.json({
        success: true,
        hasSession,
        hasAuthSession,
        verified: user?.verified || false,
        verifiedAt: user?.verifiedAt,
      });
    } catch (error: any) {
      console.error("❌ Error checking session:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check session status",
      });
    }
  };
}
