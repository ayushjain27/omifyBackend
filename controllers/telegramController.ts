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
import axios from "axios";
import TelegramNewUser from "../models/telegramNewUser";

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
const sessionsDir = path.join(process.cwd(), "/tmp/telegram-sessions");
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

async function validateSession(client: TelegramClient): Promise<boolean> {
  try {
    // Try to get our own user info to validate the session
    await client.getMe();
    return true;
  } catch (error) {
    console.error("Session validation failed:", error);
    return false;
  }
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
const baseUrl = `https://api.telegram.org/bot${botToken}`;
export default class TelegramController {
  // static getChannelMemberCount = async (req: any, res: any) => {
  //   try {
  //     const { channelId, apiToken } = req.body;

  //     if (!channelId || !apiToken) {
  //       return res.status(400).json({
  //         error: 'Channel ID and API Token are required'
  //       });
  //     }

  //     // Format channel ID correctly
  //     let formattedChannelId = channelId;
  //     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
  //       formattedChannelId = `-100${channelId}`;
  //     }

  //     try {
  //       const response = await axios.get(
  //         `https://api.telegram.org/bot${apiToken}/getChatMemberCount?chat_id=${formattedChannelId}`
  //       );

  //       return res.json({
  //         success: true,
  //         channelId: formattedChannelId,
  //         memberCount: response.data.result,
  //         message: `Channel has ${response.data.result} members`
  //       });
  //     } catch (error) {
  //       console.error('Error getting member count:', error.response?.data || error.message);

  //       return res.status(500).json({
  //         error: 'Failed to get member count',
  //         details: error.response?.data?.description || error.message
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Unexpected error:', error);
  //     return res.status(500).json({
  //       error: 'Unexpected error occurred',
  //       details: error.message
  //     });
  //   }
  // };

  // /**
  //  * Get channel information including member count
  //  */
  // static getChannelInfo = async (req: any, res: any) => {
  //   try {
  //     const { channelId, apiToken } = req.body;

  //     if (!channelId || !apiToken) {
  //       return res.status(400).json({
  //         error: 'Channel ID and API Token are required'
  //       });
  //     }

  //     // Format channel ID correctly
  //     let formattedChannelId = channelId;
  //     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
  //       formattedChannelId = `-100${channelId}`;
  //     }

  //     try {
  //       // Get basic chat info
  //       const chatResponse = await axios.get(
  //         `https://api.telegram.org/bot${apiToken}/getChat?chat_id=${formattedChannelId}`
  //       );

  //       // Get member count
  //       const memberCountResponse = await axios.get(
  //         `https://api.telegram.org/bot${apiToken}/getChatMemberCount?chat_id=${formattedChannelId}`
  //       );

  //       const chatInfo = chatResponse.data.result;
  //       const memberCount = memberCountResponse.data.result;

  //       return res.json({
  //         success: true,
  //         channelInfo: {
  //           id: chatInfo.id,
  //           title: chatInfo.title,
  //           username: chatInfo.username || null,
  //           description: chatInfo.description || null,
  //           type: chatInfo.type,
  //           memberCount: memberCount,
  //           inviteLink: chatInfo.invite_link || null,
  //           pinnedMessage: chatInfo.pinned_message || null,
  //           permissions: chatInfo.permissions || null
  //         }
  //       });
  //     } catch (error) {
  //       console.error('Error getting channel info:', error.response?.data || error.message);

  //       return res.status(500).json({
  //         error: 'Failed to get channel info',
  //         details: error.response?.data?.description || error.message
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Unexpected error:', error);
  //     return res.status(500).json({
  //       error: 'Unexpected error occurred',
  //       details: error.message
  //     });
  //   }
  // };

  // /**
  //  * Get channel administrators list
  //  * Note: This only works if your bot has admin privileges
  //  */
  // static getChannelAdministrators = async (req: any, res: any) => {
  //   try {
  //     const { channelId, apiToken } = req.body;

  //     if (!channelId || !apiToken) {
  //       return res.status(400).json({
  //         error: 'Channel ID and API Token are required'
  //       });
  //     }

  //     // Format channel ID correctly
  //     let formattedChannelId = channelId;
  //     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
  //       formattedChannelId = `-100${channelId}`;
  //     }

  //     try {
  //       const response = await axios.get(
  //         `https://api.telegram.org/bot${apiToken}/getChatAdministrators?chat_id=${formattedChannelId}`
  //       );

  //       const administrators = response.data.result.map((admin: any) => ({
  //         userId: admin.user.id,
  //         firstName: admin.user.first_name,
  //         lastName: admin.user.last_name || null,
  //         username: admin.user.username || null,
  //         status: admin.status,
  //         isBot: admin.user.is_bot,
  //         canBeEdited: admin.can_be_edited || false,
  //         canManageChat: admin.can_manage_chat || false,
  //         canDeleteMessages: admin.can_delete_messages || false,
  //         canManageVideoChats: admin.can_manage_video_chats || false,
  //         canRestrictMembers: admin.can_restrict_members || false,
  //         canPromoteMembers: admin.can_promote_members || false,
  //         canChangeInfo: admin.can_change_info || false,
  //         canInviteUsers: admin.can_invite_users || false,
  //         canPostMessages: admin.can_post_messages || false,
  //         canEditMessages: admin.can_edit_messages || false,
  //         canPinMessages: admin.can_pin_messages || false,
  //         customTitle: admin.custom_title || null
  //       }));

  //       return res.json({
  //         success: true,
  //         channelId: formattedChannelId,
  //         administratorCount: administrators.length,
  //         administrators: administrators
  //       });
  //     } catch (error) {
  //       console.error('Error getting administrators:', error.response?.data || error.message);

  //       return res.status(500).json({
  //         error: 'Failed to get administrators',
  //         details: error.response?.data?.description || error.message,
  //         note: 'Bot must be an administrator to access this information'
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Unexpected error:', error);
  //     return res.status(500).json({
  //       error: 'Unexpected error occurred',
  //       details: error.message
  //     });
  //   }
  // };

  // /**
  //  * Check if a specific user is a member of the channel
  //  */
  // static checkUserMembership = async (req: any, res: any) => {
  //   try {
  //     const { channelId, userId, apiToken } = req.body;

  //     if (!channelId || !userId || !apiToken) {
  //       return res.status(400).json({
  //         error: 'Channel ID, User ID, and API Token are required'
  //       });
  //     }

  //     // Format channel ID correctly
  //     let formattedChannelId = channelId;
  //     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
  //       formattedChannelId = `-100${channelId}`;
  //     }

  //     // Convert user ID to number
  //     const numericUserId = parseInt(userId, 10);
  //     if (isNaN(numericUserId)) {
  //       return res.status(400).json({
  //         error: 'Invalid User ID format'
  //       });
  //     }

  //     try {
  //       const response = await axios.get(
  //         `https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`
  //       );

  //       const memberInfo = response.data.result;
  //       const isMember = memberInfo.status !== 'left' && memberInfo.status !== 'kicked';

  //       return res.json({
  //         success: true,
  //         channelId: formattedChannelId,
  //         userId: numericUserId,
  //         isMember: isMember,
  //         memberInfo: {
  //           userId: memberInfo.user.id,
  //           firstName: memberInfo.user.first_name,
  //           lastName: memberInfo.user.last_name || null,
  //           username: memberInfo.user.username || null,
  //           status: memberInfo.status,
  //           isBot: memberInfo.user.is_bot,
  //           joinedDate: memberInfo.until_date || null
  //         }
  //       });
  //     } catch (error) {
  //       console.error('Error checking membership:', error.response?.data || error.message);

  //       if (error.response?.data.error_code === 400) {
  //         return res.status(404).json({
  //           success: true,
  //           channelId: formattedChannelId,
  //           userId: numericUserId,
  //           isMember: false,
  //           message: 'User is not a member of this channel'
  //         });
  //       }

  //       return res.status(500).json({
  //         error: 'Failed to check membership',
  //         details: error.response?.data?.description || error.message
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Unexpected error:', error);
  //     return res.status(500).json({
  //       error: 'Unexpected error occurred',
  //       details: error.message
  //     });
  //   }
  // };

  // /**
  //  * Get recent channel members (limited functionality)
  //  * Note: This is very limited due to Telegram Bot API restrictions
  //  * You can only get admin list, not all members list
  //  */
  // static getChannelMembersLimited = async (req: any, res: any) => {
  //   try {
  //     const { channelId, apiToken } = req.body;

  //     if (!channelId || !apiToken) {
  //       return res.status(400).json({
  //         error: 'Channel ID and API Token are required'
  //       });
  //     }

  //     // Format channel ID correctly
  //     let formattedChannelId = channelId;
  //     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
  //       formattedChannelId = `-100${channelId}`;
  //     }

  //     try {
  //       // Get basic channel info
  //       const channelInfoResponse = await axios.get(
  //         `https://api.telegram.org/bot${apiToken}/getChat?chat_id=${formattedChannelId}`
  //       );

  //       // Get member count
  //       const memberCountResponse = await axios.get(
  //         `https://api.telegram.org/bot${apiToken}/getChatMemberCount?chat_id=${formattedChannelId}`
  //       );

  //       // Get administrators (this is the only member list we can get via Bot API)
  //       const adminsResponse = await axios.get(
  //         `https://api.telegram.org/bot${apiToken}/getChatAdministrators?chat_id=${formattedChannelId}`
  //       );

  //       const channelInfo = channelInfoResponse.data.result;
  //       const memberCount = memberCountResponse.data.result;
  //       const administrators = adminsResponse.data.result;

  //       return res.json({
  //         success: true,
  //         limitation: 'Bot API can only fetch administrators list, not all members',
  //         channelInfo: {
  //           id: channelInfo.id,
  //           title: channelInfo.title,
  //           username: channelInfo.username || null,
  //           description: channelInfo.description || null,
  //           memberCount: memberCount
  //         },
  //         administrators: administrators.map((admin: any) => ({
  //           userId: admin.user.id,
  //           firstName: admin.user.first_name,
  //           lastName: admin.user.last_name || null,
  //           username: admin.user.username || null,
  //           status: admin.status,
  //           isBot: admin.user.is_bot
  //         })),
  //         totalMembers: memberCount,
  //         accessibleMembers: administrators.length,
  //         note: 'To get all member details, you need to use Telegram Client API (not Bot API) or have special permissions'
  //       });
  //     } catch (error) {
  //       console.error('Error getting limited member info:', error.response?.data || error.message);

  //       return res.status(500).json({
  //         error: 'Failed to get member information',
  //         details: error.response?.data?.description || error.message
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Unexpected error:', error);
  //     return res.status(500).json({
  //       error: 'Unexpected error occurred',
  //       details: error.message
  //     });
  //   }
  // };

  // Add this new method to your TelegramController class

  /**
   * Get all channel members using Telegram Client API
   * This requires user login session (not bot token)
   */
  // static getAllChannelMembers = async (req: any, res: any) => {
  //   try {
  //     const { channelId, phoneNumber } = req.body;

  //     if (!channelId || !phoneNumber) {
  //       return res.status(400).json({
  //         error: "Channel ID and Phone Number are required",
  //       });
  //     }

  //     const cleanNumber = normalizePhoneNumber(phoneNumber);

  //     // Check if user has an active session
  //     const sessionString = loadUserSession(cleanNumber);
  //     if (!sessionString) {
  //       return res.status(401).json({
  //         success: false,
  //         message: "No active session found. Please login first.",
  //       });
  //     }

  //     // Create Telegram client
  //     const stringSession = new StringSession(sessionString);
  //     const client = new TelegramClient(
  //       stringSession,
  //       TELEGRAM_API_ID,
  //       TELEGRAM_API_HASH,
  //       {
  //         connectionRetries: 3,
  //         timeout: 15000,
  //       }
  //     );

  //     await client.connect();

  //     try {
  //       // Convert channel ID to proper format
  //       let formattedChannelId = channelId;
  //       if (typeof channelId === "string" && channelId.startsWith("-100")) {
  //         formattedChannelId = bigInt(channelId.replace("-100", ""));
  //       } else if (
  //         typeof channelId === "number" ||
  //         !isNaN(parseInt(channelId))
  //       ) {
  //         formattedChannelId = bigInt(channelId);
  //       }

  //       // Get channel entity
  //       const channel = await client.getEntity(formattedChannelId);
  //       console.log("Channel found:", channel);

  //       // Get all participants (members)
  //       const participants = await client.getParticipants(channel, {
  //         limit: 10000, // Maximum limit
  //       });

  //       // Format member data
  //       const members = participants.map((participant: any) => {
  //         const user = participant;
  //         return {
  //           userId: user.id?.toString() || null,
  //           firstName: user.firstName || null,
  //           lastName: user.lastName || null,
  //           username: user.username || null,
  //           phone: user.phone || null,
  //           isBot: user.bot || false,
  //           isPremium: user.premium || false,
  //           isVerified: user.verified || false,
  //           isRestricted: user.restricted || false,
  //           isDeleted: user.deleted || false,
  //           languageCode: user.langCode || null,
  //           accessHash: user.accessHash ? user.accessHash.toString() : null,
  //           status: user.status
  //             ? {
  //                 className: user.status.className || "Unknown",
  //                 online: user.status.className === "UserStatusOnline",
  //                 lastOnline: user.status.wasOnline || null,
  //               }
  //             : null,
  //         };
  //       });

  //       // Get channel info with proper type checking
  //       const channelInfo = {
  //         id: (channel as any).id?.toString() || channelId.toString(),
  //         title: (channel as any).title || "Unknown Channel",
  //         username: (channel as any).username || null,
  //         memberCount: (channel as any).participantsCount || members.length,
  //         about: (channel as any).about || null,
  //         date: (channel as any).date || null,
  //         verified: (channel as any).verified || false,
  //         restricted: (channel as any).restricted || false,
  //         scam: (channel as any).scam || false,
  //         fake: (channel as any).fake || false,
  //       };

  //       await client.disconnect();

  //       return res.json({
  //         success: true,
  //         channelInfo: channelInfo,
  //         members: members,
  //         totalMembers: members.length,
  //         fetchedAt: new Date().toISOString(),
  //         note: "Complete member list fetched using Telegram Client API",
  //       });
  //     } catch (error: any) {
  //       await client.disconnect();
  //       console.error("Error fetching members:", error);

  //       if (error.message.includes("CHANNEL_PRIVATE")) {
  //         return res.status(403).json({
  //           error: "Cannot access private channel",
  //           details: "You need to be a member of this channel",
  //         });
  //       } else if (error.message.includes("CHANNEL_INVALID")) {
  //         return res.status(404).json({
  //           error: "Channel not found",
  //           details: "Invalid channel ID or channel does not exist",
  //         });
  //       } else {
  //         return res.status(500).json({
  //           error: "Failed to fetch channel members",
  //           details: error.message,
  //         });
  //       }
  //     }
  //   } catch (error: any) {
  //     console.error("Unexpected error:", error);
  //     return res.status(500).json({
  //       error: "Unexpected error occurred",
  //       details: error.message,
  //     });
  //   }
  // };

  // /**
  //  * Get specific member details from channel
  //  */
  // static getChannelMemberDetails = async (req: any, res: any) => {
  //   try {
  //     const { channelId, phoneNumber, targetUserId } = req.body;

  //     if (!channelId || !phoneNumber || !targetUserId) {
  //       return res.status(400).json({
  //         error: "Channel ID, Phone Number, and Target User ID are required",
  //       });
  //     }

  //     const cleanNumber = normalizePhoneNumber(phoneNumber);

  //     // Check if user has an active session
  //     const sessionString = loadUserSession(cleanNumber);
  //     if (!sessionString) {
  //       return res.status(401).json({
  //         success: false,
  //         message: "No active session found. Please login first.",
  //       });
  //     }

  //     // Create Telegram client
  //     const stringSession = new StringSession(sessionString);
  //     const client = new TelegramClient(
  //       stringSession,
  //       TELEGRAM_API_ID,
  //       TELEGRAM_API_HASH,
  //       {
  //         connectionRetries: 3,
  //         timeout: 15000,
  //       }
  //     );

  //     await client.connect();

  //     try {
  //       // Get channel and user entities
  //       const channel = await client.getEntity(bigInt(channelId));
  //       const targetUser = await client.getEntity(bigInt(targetUserId));

  //       // Get participant info
  //       const participantResult = await client.invoke(
  //         new Api.channels.GetParticipant({
  //           channel: channel,
  //           participant: targetUser,
  //         })
  //       );

  //       // Type assertion for participant data
  //       const participantData = participantResult as any;
  //       const participant = participantData.participant;

  //       const userInfo = {
  //         userId: (targetUser as any).id?.toString() || null,
  //         firstName: (targetUser as any).firstName || null,
  //         lastName: (targetUser as any).lastName || null,
  //         username: (targetUser as any).username || null,
  //         phone: (targetUser as any).phone || null,
  //         isBot: (targetUser as any).bot || false,
  //         isPremium: (targetUser as any).premium || false,
  //         isVerified: (targetUser as any).verified || false,
  //         participantInfo: {
  //           status: participant?.className || "Unknown",
  //           joinedDate: participant?.date || null,
  //           isAdmin: participant?.className?.includes("Admin") || false,
  //           isCreator: participant?.className?.includes("Creator") || false,
  //           adminRights: participant?.adminRights || null,
  //           bannedRights: participant?.bannedRights || null,
  //         },
  //       };

  //       await client.disconnect();

  //       return res.json({
  //         success: true,
  //         userInfo: userInfo,
  //         channelTitle: (channel as any).title || "Unknown Channel",
  //       });
  //     } catch (error: any) {
  //       await client.disconnect();
  //       console.error("Error fetching member details:", error);

  //       if (error.message.includes("USER_NOT_PARTICIPANT")) {
  //         return res.status(404).json({
  //           error: "User is not a member of this channel",
  //         });
  //       } else {
  //         return res.status(500).json({
  //           error: "Failed to fetch member details",
  //           details: error.message,
  //         });
  //       }
  //     }
  //   } catch (error: any) {
  //     console.error("Unexpected error:", error);
  //     return res.status(500).json({
  //       error: "Unexpected error occurred",
  //       details: error.message,
  //     });
  //   }
  // };

  // /**
  //  * Get channel members with pagination and filters
  //  */
  // static getChannelMembersPaginated = async (req: any, res: any) => {
  //   try {
  //     const {
  //       channelId,
  //       phoneNumber,
  //       limit = 100,
  //       offset = 0,
  //       filter = "recent",
  //     } = req.body;

  //     if (!channelId || !phoneNumber) {
  //       return res.status(400).json({
  //         error: "Channel ID and Phone Number are required",
  //       });
  //     }

  //     const cleanNumber = normalizePhoneNumber(phoneNumber);

  //     // Check if user has an active session
  //     const sessionString = loadUserSession(cleanNumber);
  //     if (!sessionString) {
  //       return res.status(401).json({
  //         success: false,
  //         message: "No active session found. Please login first.",
  //       });
  //     }

  //     // Create Telegram client
  //     const stringSession = new StringSession(sessionString);
  //     const client = new TelegramClient(
  //       stringSession,
  //       TELEGRAM_API_ID,
  //       TELEGRAM_API_HASH,
  //       {
  //         connectionRetries: 3,
  //         timeout: 15000,
  //       }
  //     );

  //     await client.connect();

  //     try {
  //       const channel = await client.getEntity(bigInt(channelId));

  //       // Set filter type
  //       let filterType;
  //       switch (filter) {
  //         case "admins":
  //           filterType = new Api.ChannelParticipantsAdmins();
  //           break;
  //         case "bots":
  //           filterType = new Api.ChannelParticipantsBots();
  //           break;
  //         case "banned":
  //           filterType = new Api.ChannelParticipantsBanned({
  //             q: "",
  //           });
  //           break;
  //         case "recent":
  //         default:
  //           filterType = new Api.ChannelParticipantsRecent();
  //           break;
  //       }

  //       // Get participants with pagination
  //       const participantsResult = await client.invoke(
  //         new Api.channels.GetParticipants({
  //           channel: channel,
  //           filter: filterType,
  //           offset: offset,
  //           limit: Math.min(limit, 200), // Max 200 per request
  //           hash: bigInt(0),
  //         })
  //       );

  //       // Type assertion and null checks
  //       const participantsData = participantsResult as any;
  //       const users = participantsData.users || [];
  //       const totalCount = participantsData.count || 0;

  //       const members = users.map((user: any) => ({
  //         userId: user.id?.toString() || null,
  //         firstName: user.firstName || null,
  //         lastName: user.lastName || null,
  //         username: user.username || null,
  //         isBot: user.bot || false,
  //         isPremium: user.premium || false,
  //         isVerified: user.verified || false,
  //         status: user.status
  //           ? {
  //               className: user.status.className || "Unknown",
  //               online: user.status.className === "UserStatusOnline",
  //             }
  //           : null,
  //       }));

  //       await client.disconnect();

  //       return res.json({
  //         success: true,
  //         channelTitle: (channel as any).title || "Unknown Channel",
  //         members: members,
  //         pagination: {
  //           offset: offset,
  //           limit: limit,
  //           fetched: members.length,
  //           hasMore: members.length === limit,
  //           filter: filter,
  //         },
  //         totalCount: totalCount,
  //       });
  //     } catch (error: any) {
  //       await client.disconnect();
  //       throw error;
  //     }
  //   } catch (error: any) {
  //     console.error("Unexpected error:", error);
  //     return res.status(500).json({
  //       error: "Unexpected error occurred",
  //       details: error.message,
  //     });
  //   }
  // };

  static getChannelMembers = async (req: any, res: any) => {
    try {
      const { channelId, apiToken } = req.body;

      // Validate required parameters
      if (!channelId || !apiToken) {
        return res.status(400).json({
          error: "Channel ID and API Token are required",
        });
      }

      // Format channel ID correctly
      let formattedChannelId = channelId;
      if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
        formattedChannelId = `-100${channelId}`;
      }

      // Verify the bot is an admin in the channel
      try {
        const botInfoResponse = await axios.get(
          `https://api.telegram.org/bot${apiToken}/getMe`
        );
        const botId = botInfoResponse.data.result.id;

        const chatMemberResponse = await axios.get(
          `https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`
        );

        const botStatus = chatMemberResponse.data.result.status;
        if (botStatus !== "administrator" && botStatus !== "creator") {
          return res.status(403).json({
            error: "Bot is not an administrator in the specified channel",
          });
        }
      } catch (error) {
        return res.status(403).json({
          error: "Failed to verify bot permissions",
          details: error.response?.data?.description || error.message,
        });
      }

      // Get total member count first
      const chatInfo = await axios.get(
        `https://api.telegram.org/bot${apiToken}/getChat?chat_id=${formattedChannelId}`
      );
      const totalMembers = chatInfo.data.result.members_count;

      console.log(`Channel has ${totalMembers} members`);

      // Get administrators list
      const adminsResponse = await axios.get(
        `https://api.telegram.org/bot${apiToken}/getChatAdministrators?chat_id=${formattedChannelId}`
      );

      const administrators = adminsResponse.data.result.map((admin: any) => ({
        userId: admin.user.id,
        firstName: admin.user.first_name,
        lastName: admin.user.last_name || "",
        username: admin.user.username || "",
        status: admin.status,
        isBot: admin.user.is_bot,
        canBeEdited: admin.can_be_edited || false,
        // Add other admin permissions as needed
      }));

      // For large channels, we need to be careful about getting all members
      // as the Telegram API doesn't provide a direct way to get all members via bot
      // We can only get administrators and information about specific members

      // Return the information we can gather
      return res.json({
        success: true,
        channelInfo: {
          id: formattedChannelId,
          title: chatInfo.data.result.title,
          username: chatInfo.data.result.username || "",
          totalMembers: totalMembers,
          description: chatInfo.data.result.description || "",
        },
        administrators: administrators,
        note: "Due to Telegram API limitations, bots can only retrieve administrator lists, not full member lists. For full member details, you would need to use user API (not bot API) with proper authentication.",
      });
    } catch (error) {
      console.error("Error getting channel members:", error);
      return res.status(500).json({
        error: "Failed to get channel members",
        details: error.response?.data?.description || error.message,
      });
    }
  };

  static getChannelMembersViaUserApi = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { phoneNumber, channelId } = req.body;

      if (!channelId) {
        res.status(400).json({
          success: false,
          message: "Phone number and channel ID are required",
        });
        return;
      }

      const cleanNumber = normalizePhoneNumber(phoneNumber);
      const sessionString = loadUserSession(cleanNumber);

      if (!sessionString) {
        res.status(401).json({
          success: false,
          message: "No active session found. Please login first.",
        });
        return;
      }

      const stringSession = new StringSession(sessionString);
      const client = new TelegramClient(
        stringSession,
        TELEGRAM_API_ID,
        TELEGRAM_API_HASH,
        {
          connectionRetries: 3,
          useWSS: false,
          timeout: 10000,
        }
      );

      try {
        await client.connect();

        // Validate the session first
        const isValid = await validateSession(client);
        if (!isValid) {
          // Clean up invalid session
          const sessionFile = path.join(
            sessionsDir,
            `${cleanNumber.replace(/[^0-9+]/g, "")}.session`
          );
          if (fs.existsSync(sessionFile)) {
            fs.unlinkSync(sessionFile);
          }
          userSessions.delete(cleanNumber);

          res.status(401).json({
            success: false,
            message: "Session expired. Please login again.",
          });
          return;
        }

        // Convert channel ID to the right format (handle different input formats)
        let channelEntity;
        try {
          // Try to get entity by username if provided
          if (isNaN(Number(channelId)) && typeof channelId === "string") {
            channelEntity = await client.getEntity(channelId);
          } else {
            // Handle numeric IDs (add -100 prefix for supergroups/channels)
            const numericId = bigInt(channelId);
            const peer = new Api.PeerChannel({ channelId: numericId });
            channelEntity = await client.getEntity(peer);
          }
        } catch (entityError) {
          console.error("Error getting channel entity:", entityError);
          res.status(400).json({
            success: false,
            message: "Invalid channel ID or not a member of this channel",
          });
          return;
        }

        // Check if we have permission to get participants
        try {
          // Get basic channel info first
          const fullChannel = await client.invoke(
            new Api.channels.GetFullChannel({
              channel: channelEntity.id,
            })
          );

          console.log("Channel info:", fullChannel);

          // Get participants (this might be restricted for large channels)
          const participants = await client.getParticipants(channelEntity, {});

          const members = participants.map((participant: any) => {
            // Handle different participant types safely
            const user = participant.user || participant;
            return {
              userId: user.id,
              firstName: user.firstName || "",
              lastName: user.lastName || "",
              username: user.username || "",
              phone: user.phone || "",
              isBot: user.bot || false,
              isPremium: user.premium || false,
              status: participant.status
                ? participant.status.className
                : "unknown",
              joinDate: participant.date || null,
              // Add other fields you need
            };
          });

          res.json({
            success: true,
            totalMembers: members.length,
            members: members,
          });
        } catch (participantsError) {
          console.error("Error getting participants:", participantsError);

          // Fallback: Try to get at least the admin list
          try {
            const admins = await client.getParticipants(channelEntity, {
              filter: new Api.ChannelParticipantsAdmins(),
            });

            const adminList = admins.map((admin: any) => {
              const user = admin.user || admin;
              return {
                userId: user.id,
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                username: user.username || "",
                isAdmin: true,
              };
            });

            res.json({
              success: true,
              message: "Could not get all members, but retrieved admin list",
              totalAdmins: adminList.length,
              admins: adminList,
              note: "Bot may not have permission to view all channel members",
            });
          } catch (adminError) {
            console.error("Error getting admins:", adminError);
            res.status(403).json({
              success: false,
              message: "Insufficient permissions to view channel members",
            });
          }
        }
      } finally {
        // Always disconnect the client
        try {
          await client.disconnect();
        } catch (disconnectError) {
          console.warn("Error disconnecting client:", disconnectError);
        }
      }
    } catch (error: any) {
      console.error("Error getting channel members via user API:", error);

      // More specific error handling
      if (error.message.includes("AUTH_KEY_UNREGISTERED")) {
        res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
      } else if (
        error.message.includes("CHANNEL_INVALID") ||
        error.message.includes("CHANNEL_PRIVATE")
      ) {
        res.status(404).json({
          success: false,
          message: "Channel not found or you don't have access to it",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to get channel members: " + error.message,
        });
      }
    }
  };

  static AddUserToChannel = async (req: any, res: any) => {
    try {
      const { channelId, phoneNumber, username, selectedPlan } = req.body;
  
      console.log("Request received with data:", {
        channelId,
        phoneNumber,
        selectedPlan,
      });
  
      // Validate required parameters
      if (!channelId || !phoneNumber) {
        return res.status(400).json({
          error: "Channel ID and Phone Number are required",
        });
      }
  
      const newPhoneNumber = `+91${phoneNumber.slice(-10)}`;
  
      // Format channel ID correctly
      let formattedChannelId = channelId;
      if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
        formattedChannelId = `-100${channelId}`;
        console.log("Converting channel ID to:", formattedChannelId);
      }
  
      // First, check if the bot is an admin in the channel
      try {
        const botInfoResponse = await axios.get(
          `https://api.telegram.org/bot${botToken}/getMe`
        );
  
        const botId = botInfoResponse.data.result.id;
        console.log("Bot ID:", botId);
  
        // Check if bot is admin in the channel
        const chatMemberResponse = await axios.get(
          `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`
        );
  
        const botStatus = chatMemberResponse.data.result.status;
        console.log("Bot status in channel:", botStatus);
  
        if (botStatus !== "administrator" && botStatus !== "creator") {
          return res.status(403).json({
            error: "Bot is not an administrator in the specified channel",
            details:
              "Please connect to owner and make sure the bot has been added as an admin with appropriate permissions",
          });
        }
  
        // Check if bot has permission to create invite links
        const canInviteUsers = chatMemberResponse.data.result.can_invite_users;
        console.log("Bot can invite users:", canInviteUsers);
  
        if (!canInviteUsers) {
          return res.status(403).json({
            error: "Bot does not have permission to create invite links",
            details:
              'Please grant the bot "Invite Users" permission in the channel settings',
          });
        }
      } catch (error) {
        console.error(
          "Error checking bot admin status:",
          error.response?.data || error.message
        );
  
        // Handle the specific case where bot is not a member
        if (error.response?.data?.error_code === 400) {
          const errorDescription = error.response.data.description || '';
          
          if (errorDescription.includes("bot is not a member") || 
              errorDescription.includes("bot is not a member of the supergroup") ||
              errorDescription.includes("chat not found") ||
              errorDescription.includes("Bad Request: bot is not a member")) {
            
            console.log("Bot is not a member of the channel. Not creating any data.");
            
            return res.status(404).json({
              error: "Bot is not a member of the specified channel",
              details: "Please add the bot to the channel first and make it an administrator",
              actionRequired: "1. Add bot to channel\n2. Make bot an administrator\n3. Grant 'Invite Users' permission",
              doNotCreateData: true // Flag to indicate no data was created
            });
          }
        }
  
        // Handle other errors
        return res.status(500).json({
          error: "Failed to verify bot permissions",
          details: error.response?.data?.description || error.message,
        });
      }
  
      // Only proceed with data creation if bot verification passed
      // Check if user already exists for this channel
      const existingUser = await TelegramNewUser.findOne({
        phoneNumber: newPhoneNumber,
        channelId: channelId,
      });
  
      console.log(existingUser, "existingUser", selectedPlan);
  
      let totalDaysToAdd = 0;
      const joinDate = new Date();
  
      // Calculate days based on selected plan
      if (selectedPlan) {
        const planValue =
          selectedPlan.value?.toLowerCase() || selectedPlan.toLowerCase();
        const totalNumber = selectedPlan.totalNumber || 1; // Default to 1 if not specified
  
        let daysPerUnit = 0;
  
        console.log(planValue, "planValue");
  
        switch (planValue) {
          case "day":
            daysPerUnit = 1;
            break;
          case "week":
            daysPerUnit = 7;
            break;
          case "month":
            daysPerUnit = 30;
            break;
          case "year":
            daysPerUnit = 365;
            break;
          case "lifetime":
            daysPerUnit = 10000000; // 1 crore days for lifetime
            break;
          default:
            // If it's a number, use it directly
            if (!isNaN(planValue)) {
              daysPerUnit = parseInt(planValue);
            }
            break;
        }
  
        console.log(daysPerUnit, "daysPerUnit", totalNumber);
  
        totalDaysToAdd += daysPerUnit * totalNumber;
        console.log(
          `Plan calculation: ${totalNumber} ${planValue} = ${
            daysPerUnit * totalNumber
          } days`
        );
      }
  
      console.log(`Total days to add: ${totalDaysToAdd}`);
  
      let finalTotalDaysLeft = totalDaysToAdd;
      let updatedUser;
  
      if (existingUser) {
        console.log("User exists, updating plan");
        // User exists, update the selectedPlan and totalDaysLeft
        finalTotalDaysLeft = existingUser.totalDaysLeft + totalDaysToAdd;
        console.log(finalTotalDaysLeft, "finalTotalDaysLeft");
  
        updatedUser = await TelegramNewUser.findByIdAndUpdate(
          existingUser._id,
          {
            $push: { selectedPlan: selectedPlan },
            $set: {
              totalDaysLeft: finalTotalDaysLeft,
              lastUpdated: new Date(),
              updatedAt: new Date(),
            },
          },
          { new: true }
        );
  
        console.log("User plan updated:", {
          phoneNumber: newPhoneNumber,
          channelId,
          previousDays: existingUser.totalDaysLeft,
          addedDays: totalDaysToAdd,
          newTotalDays: finalTotalDaysLeft,
        });
      } else {
        // Create new user only if bot is verified as admin
        updatedUser = await TelegramNewUser.create({
          phoneNumber: newPhoneNumber,
          channelId: channelId,
          username: username || "",
          selectedPlan: selectedPlan || [],
          totalDaysLeft: finalTotalDaysLeft,
          registeredAt: joinDate,
          lastUpdated: joinDate,
        });
  
        console.log("New user created:", {
          phoneNumber: newPhoneNumber,
          channelId,
          totalDaysLeft: finalTotalDaysLeft,
        });
      }
  
      // Create single-use invite link specifically for the phone number
      try {
        console.log(
          "Creating single-use invite link for phone number:",
          phoneNumber
        );
  
        const response = await axios.post(
          `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
          {
            chat_id: formattedChannelId,
            member_limit: 1, // Only one user can join
            name: `invite-for-${`+91${phoneNumber.slice(-10)}`}-${Date.now()}`,
            creates_join_request: false,
          }
        );
  
        const inviteLink = response.data.result.invite_link;
  
        console.log("Single-use invite link created successfully:", {
          inviteLink,
          member_limit: response.data.result.member_limit,
          phone_number: phoneNumber,
          totalDaysAdded: totalDaysToAdd,
          finalTotalDays: finalTotalDaysLeft,
        });
  
        return res.json({
          success: true,
          message: `Single-use invite link created successfully for ${phoneNumber}`,
          invite_link: inviteLink,
          plan_details: {
            selected_plans: selectedPlan || [],
            days_added: totalDaysToAdd,
            total_days_left: finalTotalDaysLeft,
          },
          link_details: {
            phone_number: phoneNumber,
            member_limit: response.data.result.member_limit,
            creator: response.data.result.creator,
            is_revoked: response.data.result.is_revoked,
            is_primary: response.data.result.is_primary,
            name: response.data.result.name,
          },
          usage_instructions: [
            `1. This link is exclusively for phone number: ${phoneNumber}`,
            "2. The link can only be used ONCE (member_limit: 1)",
            "3. Share this link only with the intended user",
            "4. After one user joins, the link becomes invalid automatically",
            "5. No one else can use this link once it's used",
          ],
          security_note:
            "This invite link is tied to the specified phone number and cannot be used by anyone else",
        });
      } catch (createError) {
        console.error(
          "Error creating invite link:",
          createError.response?.data || createError.message
        );
  
        // Rollback user creation if invite link fails
        if (!existingUser && updatedUser) {
          console.log("Rolling back user creation due to invite link failure");
          await TelegramNewUser.findByIdAndDelete(updatedUser._id);
        }
  
        return res.status(500).json({
          error: "Failed to create invite link",
          details:
            createError.response?.data?.description || createError.message,
          possibleReasons: [
            "Bot might not have sufficient permissions to create invite links",
            "Channel might have restrictions on invite link creation",
            "Invalid channel ID or bot token",
          ],
          rollback: !existingUser ? "User data was rolled back" : "No rollback needed for existing user",
        });
      }
    } catch (error) {
      console.error("Unexpected error in AddUserToChannel:", error);
  
      return res.status(500).json({
        error: "Unexpected error occurred",
        details: error.message,
      });
    }
  };

  static RemoveUserFromChannel = async (req: any, res: any) => {
    try {
      const { channelId, userId } = req.body;

      console.log("Remove user request received with data:", {
        channelId,
        userId,
        botToken,
      });

      // Validate required parameters
      if (!channelId || !userId || !botToken) {
        return res.status(400).json({
          error: "Channel ID, User ID, and API Token are required",
        });
      }

      // Format channel ID correctly
      let formattedChannelId = channelId;
      if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
        formattedChannelId = `-100${channelId}`;
        console.log("Converting channel ID to:", formattedChannelId);
      }

      // Convert user ID to number
      const numericUserId = parseInt(userId, 10);
      if (isNaN(numericUserId)) {
        return res.status(400).json({
          error: "Invalid User ID format",
          details: "User ID must be a valid number",
        });
      }

      // First, check if the bot is an admin and has permission to ban users
      try {
        const botInfoResponse = await axios.get(
          `https://api.telegram.org/bot${botToken}/getMe`
        );

        const botId = botInfoResponse.data.result.id;
        console.log("Bot ID:", botId);

        // Check if bot is admin in the channel
        const chatMemberResponse = await axios.get(
          `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`
        );

        const botStatus = chatMemberResponse.data.result.status;
        console.log("Bot status in channel:", botStatus);

        if (botStatus !== "administrator" && botStatus !== "creator") {
          return res.status(403).json({
            error: "Bot is not an administrator in the specified channel",
            details:
              "Please make sure the bot has been added as an admin with appropriate permissions",
          });
        }

        // Check if bot has permission to ban/restrict users
        const canRestrictMembers =
          chatMemberResponse.data.result.can_restrict_members;
        console.log("Bot can restrict members:", canRestrictMembers);

        if (!canRestrictMembers) {
          return res.status(403).json({
            error: "Bot does not have permission to remove users",
            details:
              'Please grant the bot "Ban Users" permission in the channel settings',
          });
        }
      } catch (error) {
        console.error(
          "Error checking bot admin status:",
          error.response?.data || error.message
        );

        if (error.response?.data.error_code === 400) {
          return res.status(404).json({
            error: "Bot is not a member of the specified channel",
            details:
              "Please add the bot to the channel first and make it an administrator",
          });
        }

        return res.status(500).json({
          error: "Failed to verify bot permissions",
          details: error.response?.data?.description || error.message,
        });
      }

      // Check if user is actually a member of the channel
      try {
        const userStatusResponse = await axios.get(
          `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`
        );

        const userStatus = userStatusResponse.data.result.status;
        console.log("User status in channel:", userStatus);

        if (userStatus === "left" || userStatus === "kicked") {
          return res.status(400).json({
            error: "User is not a member of the channel",
            details: `User status: ${userStatus}`,
          });
        }
      } catch (statusError) {
        console.log(
          "Error checking user status:",
          statusError.response?.data || statusError.message
        );
        return res.status(400).json({
          error: "User is not a member of the channel or invalid user ID",
        });
      }

      // METHOD 1: Try to ban the user (permanently remove)
      try {
        console.log("Trying to ban user...");
        const response = await axios.post(
          `https://api.telegram.org/bot${botToken}/banChatMember`,
          {
            chat_id: formattedChannelId,
            user_id: numericUserId,
            revoke_messages: false, // Set true to delete all messages from user
          }
        );

        console.log("User banned successfully:", response.data);

        return res.json({
          success: true,
          message: `User ${userId} successfully removed from channel ${channelId}`,
          data: response.data,
        });
      } catch (banError) {
        console.error(
          "Error with banChatMember:",
          banError.response?.data || banError.message
        );

        // METHOD 2: If ban fails, try to kick the user (temporary remove)
        try {
          console.log("Trying to kick user...");
          const response = await axios.post(
            `https://api.telegram.org/bot${botToken}/banChatMember`,
            {
              chat_id: formattedChannelId,
              user_id: numericUserId,
              until_date: Math.floor(Date.now() / 1000) + 30, // 30 seconds se ban
              revoke_messages: false,
            }
          );

          console.log("User kicked successfully:", response.data);

          return res.json({
            success: true,
            message: `User ${userId} successfully kicked from channel ${channelId}`,
            data: response.data,
          });
        } catch (kickError) {
          console.error(
            "Error with kick:",
            kickError.response?.data || kickError.message
          );

          // Return detailed error information
          return res.status(500).json({
            error: "Failed to remove user from channel",
            details: kickError.response?.data?.description || kickError.message,
            possibleReasons: [
              "Bot might not have sufficient permissions",
              "User might be the channel owner",
              "User might be an admin with higher privileges than bot",
            ],
          });
        }
      }
    } catch (error) {
      console.error("Unexpected error in RemoveUserFromChannel:", error);

      return res.status(500).json({
        error: "Unexpected error occurred",
        details: error.message,
      });
    }
  };

  static getBotInfo = async () => {
    try {
      console.log(baseUrl, "Saflkew");
      const response = await axios.get(`${baseUrl}/getMe`);
      console.log(response.data, "Delkwnd");
      return response.data;
    } catch (error) {
      console.log("d;kmelw");
      throw new Error(`Failed to get bot info: ${error.message}`);
    }
  };

  /**
   * Add bot to a channel as an administrator
   */
  static addBotToChannel = async (req: any, res: any) => {
    try {
      const { channelId } = req.body;
      // First, we need to get the bot's information
      const botInfo = await this.getBotInfo();
      console.log(botInfo, "Demw, ");
      console.log(botInfo?.result, "Dqrdelkemw, ");

      // Construct the deep link to add the bot as an administrator
      // Note: This is a simplified approach. In a real scenario, you might need
      // to use the Telegram Bot API's promoteChatMember method or create an invite link

      const deepLink = `https://t.me/${botInfo.result.username}?startchannel=${channelId}&admin=post_messages+edit_messages+delete_messages+invite_users+restrict_members+pin_messages+promote_members+change_info+add_subscribers`;

      return res.json({
        success: true,
        message:
          "Use the following link to add the bot as an administrator to your channel",
        deepLink: deepLink,
        instructions: [
          "1. Open the link above in a web browser",
          "2. Select your channel from the options",
          "3. Grant all administrator privileges to the bot",
          "4. Confirm the action",
        ],
      });
    } catch (error) {
      throw new Error(`Failed to generate bot addition link: ${error.message}`);
    }
  };

  static validateToken = async (req: any, res: any, next: any) => {
    console.log(req.body, "Dewlmk");
    const { apiToken } = req.body;
    console.log(apiToken, "Fewm,,");

    if (!apiToken) {
      return res.status(400).json({ error: "API token is required" });
    }

    try {
      // Verify the token is valid by calling getMe
      const response = await axios.get(
        `https://api.telegram.org/bot${apiToken}/getMe`
      );
      console.log(response.data?.result, "Dwkl");
      req.botInfo = response.data.result;
      // next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid API token" });
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
          message: "Invalid phone number format",
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

        console.log(result, "Sdlkwenkj");

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
  ): Promise<any> => {
    console.log(req.body, "Dewlkm");
    const requestPayload = req.body;
    const { channelId } = requestPayload;
    console.log(botToken,"bottoen")
    
    try {
      // Check if bot is a member of the specified channel
      if (channelId && botToken) {
        let formattedChannelId = channelId;
        
        // Format channel ID correctly
        if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
          formattedChannelId = `-100${channelId}`;
        }
  
        try {
          // Get bot info first
          const botInfoResponse = await axios.get(
            `https://api.telegram.org/bot${botToken}/getMe`
          );
  
          const botId = botInfoResponse.data.result.id;
  
          // Check if bot is a member of the channel
          await axios.get(
            `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`
          );
  
          console.log("✅ Bot verification successful - Bot is member of channel");
  
        } catch (error) {
          console.error("Bot channel membership check failed:", error.response?.data || error.message);
  
          let errorMessage = "Bot is not a member of the specified channel";
          let errorDetails = "Please add bot to the channel first";
  
          if (error.response?.data?.error_code === 400) {
            errorMessage = "Bot is not a member of the specified channel";
            errorDetails = "The bot needs to be added to the channel as a member before creating a telegram page";
          } else if (error.response?.data?.error_code === 403) {
            errorMessage = "Bot doesn't have access to the channel";
            errorDetails = "Please make sure the bot is added to the channel and has proper permissions";
          }
  
          return res.status(400).json({
            success: false,
            message: errorMessage,
            details: errorDetails,
            telegramError: error.response?.data?.description
          });
        }
      }
  
      // Create the page if bot verification passes
      const newTelegramPage = await TelegramPage.create(requestPayload);
      
      res.json({
        success: true,
        result: newTelegramPage,
        message: channelId && botToken ? "Telegram page created successfully with bot verification" : "Telegram page created successfully"
      });
      
    } catch (err) {
      console.error("Error in createTelegramPage:", err);
      res.status(400).json({
        success: false,
        message: "Failed to create telegram page",
        error: err.message || err,
      });
    }
  };

  static updateTelegramPage = async (
    req: Request,
    res: Response
  ): Promise<any> => {
    console.log(req.body, "Update payload");
    console.log(req.params, "Request params");
    
    const requestPayload = req.body;
    const { id } = req.params; // Assuming the page ID comes from URL params
    const { channelId } = requestPayload;
    
    try {
      // Validate ID exists
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Telegram page ID is required"
        });
      }
  
      // Check if page exists
      const existingPage = await TelegramPage.findById(id);
      if (!existingPage) {
        return res.status(404).json({
          success: false,
          message: "Telegram page not found"
        });
      }
  
      // Determine which bot token to use for verification
      const tokenToUse = botToken;
      
      // Perform bot verification if channelId is being updated/changed
      const isChannelUpdated = channelId && channelId !== existingPage.channelId;
      
      if (isChannelUpdated && tokenToUse) {
        let formattedChannelId = channelId;
        
        // Format channel ID correctly
        if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
          formattedChannelId = `-100${channelId}`;
        }
  
        try {
          // Get bot info first
          const botInfoResponse = await axios.get(
            `https://api.telegram.org/bot${tokenToUse}/getMe`
          );
  
          const botId = botInfoResponse.data.result.id;
  
          // Check if bot is a member of the channel
          await axios.get(
            `https://api.telegram.org/bot${tokenToUse}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`
          );
  
          console.log("✅ Bot verification successful for updated channel");
  
        } catch (error) {
          console.error("Bot channel membership check failed:", error.response?.data || error.message);
  
          let errorMessage = "Bot is not a member of the specified channel";
          let errorDetails = "Please add bot to the channel first";
  
          if (error.response?.data?.error_code === 400) {
            errorMessage = "Bot is not a member of the specified channel";
            errorDetails = "The bot needs to be added to the channel as a member before updating the telegram page";
          } else if (error.response?.data?.error_code === 403) {
            errorMessage = "Bot doesn't have access to the channel";
            errorDetails = "Please make sure the bot is added to the channel and has proper permissions";
          }
  
          return res.status(400).json({
            success: false,
            message: errorMessage,
            details: errorDetails,
            telegramError: error.response?.data?.description
          });
        }
      }
  
      // Update the page
      const updatedPage = await TelegramPage.findByIdAndUpdate(
        id,
        { 
          ...requestPayload,
          updatedAt: new Date() // Ensure updated timestamp is set
        },
        { 
          new: true, // Return the updated document
          runValidators: true // Run model validators
        }
      );
  
      console.log("✅ Telegram page updated successfully");
  
      res.json({
        success: true,
        result: updatedPage,
        message: isChannelUpdated ? 
          "Telegram page updated successfully with bot verification" : 
          "Telegram page updated successfully"
      });
      
    } catch (err) {
      console.error("Error in updateTelegramPage:", err);
      
      // Handle duplicate key errors (if you have unique constraints)
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Duplicate entry",
          error: "A page with similar details already exists",
          field: Object.keys(err.keyPattern)[0]
        });
      }
      
      // Handle validation errors
      if (err.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          error: Object.values(err.errors).map((e: any) => e.message).join(', ')
        });
      }
      
      res.status(400).json({
        success: false,
        message: "Failed to update telegram page",
        error: err.message || err,
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

  static countAllTelegramUsersByChannelId = async (req: any, res: any) => {
      try {
        const { channelId } = req.query;
    
        // Validate channelId
        if (!channelId) {
          return res.status(400).json({
            success: false,
            message: 'channelId is required in query parameters'
          });
        }
    
        // Find all users with the given channelId
        const users = await TelegramNewUser.find({ channelId });
    
        // Count active and inactive users
        const activeUsers = users.filter(user => user.totalDaysLeft > 0).length;
        const inactiveUsers = users.filter(user => user.totalDaysLeft <= 0).length;
    
        // Return the counts
        return res.status(200).json({
          success: true,
          data: {
            channelId,
            activeUsers,
            inactiveUsers,
            totalUsers: users.length
          }
        });
    
      } catch (error) {
        console.error('Error counting users:', error);
        return res.status(500).json({
          success: false,
          message: 'Server error while counting users',
          error: error.message
        });
      }
  };

  static getAllTelegramUsersByChannelId = async (req: any, res: any) => {
    const payload = req.body;
    const query: any = {
      channelId: payload.channelId
    };
    if (payload.status === 'ACTIVE') {
      query.totalDaysLeft = { $gt: 0 };
    } else {
      query.totalDaysLeft = { $lte: 0 };
    }
    const pageNo = payload?.pageNo;
    const pageSize = payload?.pageSize;
    const result = await TelegramNewUser.find(query)
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
