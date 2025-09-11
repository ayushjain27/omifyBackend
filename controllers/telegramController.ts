import TelegramUser from "../models/telegramUser";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import bigInt from 'big-integer';

// Interfaces
interface AuthSessionData {
  client: TelegramClient;
  phoneCodeHash: string;
  phoneNumber: string;
  createdAt: Date;
  is2FARequired?: boolean;
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

const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || '23351709');
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || '0c736ebb3f791b108a9539f83b8ff73e';

// Storage for authentication sessions
const authSessions = new Map<string, AuthSessionData>();
const userSessions = new Map<string, string>();

// Ensure directories exist
const sessionsDir = path.join(process.cwd(), 'telegram-sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

// Helper function to normalize phone number format
function normalizePhoneNumber(phoneNumber: string): string {
  let cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
  if (!cleanNumber.startsWith('+')) {
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
  const sessionFile = path.join(sessionsDir, `${normalizedNumber.replace(/[^0-9+]/g, '')}.session`);
  fs.writeFileSync(sessionFile, sessionString);
  userSessions.set(normalizedNumber, sessionString);
}

function loadUserSession(phoneNumber: string): string {
  const normalizedNumber = normalizePhoneNumber(phoneNumber);
  const sessionFile = path.join(sessionsDir, `${normalizedNumber.replace(/[^0-9+]/g, '')}.session`);
  if (fs.existsSync(sessionFile)) {
    const sessionString = fs.readFileSync(sessionFile, 'utf8');
    userSessions.set(normalizedNumber, sessionString);
    return sessionString;
  }
  return '';
}

// Clean up expired auth sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [phoneNumber, session] of authSessions.entries()) {
    const sessionAge = now - session.createdAt.getTime();
    if (sessionAge > 10 * 60 * 1000) { // 10 minutes
      console.log(`Cleaning up expired session for: ${phoneNumber}`);
      try {
        session.client.destroy();
      } catch (error) {
        console.error('Error destroying client:', error);
      }
      authSessions.delete(phoneNumber);
    }
  }
}, 60 * 1000); // Check every minute

export default class TelegramController {
  
  // Step 1: Initiate login process
  static sendOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        res.status(400).json({ 
          success: false, 
          message: 'Phone number is required' 
        });
        return;
      }

      // Format phone number properly
      const cleanNumber = normalizePhoneNumber(phoneNumber);
      
      if (!cleanNumber.match(/^\+?[1-9]\d{10,14}$/)) {
        res.status(400).json({ 
          success: false, 
          message: 'Invalid phone number format. Use: +911234567890' 
        });
        return;
      }
      
      // Check if user already has active session
      const existingUser = await TelegramUser.findOne({ phoneNumber: cleanNumber });
      if (existingUser && existingUser.verified && loadUserSession(cleanNumber)) {
        res.json({ 
          success: true, 
          message: 'Welcome back! You are already logged in.',
          verified: true,
          hasSession: true,
          user: {
            phoneNumber: cleanNumber,
            verifiedAt: existingUser.verifiedAt
          }
        });
        return;
      }
      
      // Create a new Telegram client
      const stringSession = new StringSession('');
      const client = new TelegramClient(
        stringSession,
        TELEGRAM_API_ID,
        TELEGRAM_API_HASH,
        {
          connectionRetries: 5,
          useWSS: false,
          timeout: 10000
        }
      );
      
      await client.connect();
      
      // Send code request
      const { phoneCodeHash } = await client.sendCode({
        apiId: TELEGRAM_API_ID,
        apiHash: TELEGRAM_API_HASH,
      }, cleanNumber);
      
      // Store the authentication session
      authSessions.set(cleanNumber, {
        client,
        phoneCodeHash,
        phoneNumber: cleanNumber,
        createdAt: new Date()
      });

      console.log('OTP sent to:', cleanNumber);
      console.log('Active sessions:', Array.from(authSessions.keys()));
      
      res.json({ 
        success: true, 
        message: 'OTP sent! Check your Telegram app for the verification code.',
        phoneNumber: cleanNumber,
        expiresIn: 10 // minutes
      });
      
    } catch (error: any) {
      console.error('❌ Error initiating login:', error);
      
      if (error.message.includes('PHONE_NUMBER_INVALID')) {
        res.status(400).json({ 
          success: false, 
          message: 'Invalid phone number format.' 
        });
      } else if (error.message.includes('PHONE_NUMBER_FLOOD')) {
        res.status(400).json({ 
          success: false, 
          message: 'Too many attempts. Please try again later.' 
        });
      } else if (error.message.includes('PHONE_NUMBER_BANNED')) {
        res.status(400).json({ 
          success: false, 
          message: 'This phone number is banned from Telegram.' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to initiate login process: ' + error.message 
        });
      }
    }
  };

  // Step 2: Verify OTP
  static verifyLoginOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, otp } = req.body;
      
      if (!phoneNumber || !otp) {
        res.status(400).json({ 
          success: false, 
          message: 'Phone number and OTP are required.' 
        });
        return;
      }
      
      const cleanNumber = normalizePhoneNumber(phoneNumber);
      
      console.log('Verifying OTP for:', cleanNumber);
      console.log('Available auth sessions:', Array.from(authSessions.keys()));
      
      const authSession = authSessions.get(cleanNumber);
      
      if (!authSession) {
        console.log('No active session found for:', cleanNumber);
        
        res.status(400).json({ 
          success: false, 
          message: 'No active session found for this phone number. Please request a new OTP.' 
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
          message: 'Session expired. Please request a new OTP.' 
        });
        return;
      }
      
      try {
        // Sign in with the code
        await authSession.client.invoke(
          new Api.auth.SignIn({
            phoneNumber: cleanNumber,
            phoneCode: otp,
            phoneCodeHash: authSession.phoneCodeHash,
          })
        );
        
        // Save the session
        const sessionString = authSession.client.session.save();
        saveUserSession(cleanNumber, sessionString);
        
        // Clean up
        authSession.client.destroy();
        authSessions.delete(cleanNumber);
        
        // Save or update user
        let telegramUser = await TelegramUser.findOne({ phoneNumber: cleanNumber });
        if (!telegramUser) {
          telegramUser = new TelegramUser({
            phoneNumber: cleanNumber,
            verified: true,
            verifiedAt: new Date()
          });
        } else {
          telegramUser.verified = true;
          telegramUser.verifiedAt = new Date();
        }
        
        await telegramUser.save();
        
        // Fetch user channels
        const channels = await TelegramController.fetchUserChannels(cleanNumber);
        
        res.json({ 
          success: true, 
          message: 'Login successful!',
          verified: true,
          authenticated: true,
          channels: channels,
          totalChannels: channels.length,
          user: {
            phoneNumber: cleanNumber,
            verifiedAt: telegramUser.verifiedAt
          }
        });
        
      } catch (error: any) {
        console.error('❌ Error during sign-in:', error);
        
        if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          // Handle 2FA requirement
          authSession.is2FARequired = true;
          
          res.status(200).json({ 
            success: false, 
            message: 'Two-factor authentication is enabled. Please provide your password.',
            requires2FA: true,
            phoneNumber: cleanNumber
          });
          return;
        } else if (error.message.includes('PHONE_CODE_INVALID')) {
          res.status(400).json({ 
            success: false, 
            message: 'Invalid OTP code.' 
          });
        } else if (error.message.includes('PHONE_CODE_EXPIRED')) {
          res.status(400).json({ 
            success: false, 
            message: 'OTP code has expired. Please request a new one.' 
          });
        } else {
          res.status(500).json({ 
            success: false, 
            message: 'Failed to verify OTP: ' + error.message 
          });
        }
        
        // Clean up failed session only if it's not a 2FA case
        if (error.errorMessage !== 'SESSION_PASSWORD_NEEDED') {
          authSession.client.destroy();
          authSessions.delete(cleanNumber);
        }
      }
      
    } catch (error: any) {
      console.error('❌ Unexpected error in verifyLoginOtp:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error during OTP verification.' 
      });
    }
  };

  // Step 3: Verify 2FA Password
  static verify2FAPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, password } = req.body;
      
      if (!phoneNumber || !password) {
        res.status(400).json({ 
          success: false, 
          message: 'Phone number and password are required.' 
        });
        return;
      }
      
      const cleanNumber = normalizePhoneNumber(phoneNumber);
      const authSession = authSessions.get(cleanNumber);
      
      if (!authSession || !authSession.is2FARequired) {
        res.status(400).json({ 
          success: false, 
          message: 'No active 2FA session found. Please complete OTP verification first.' 
        });
        return;
      }
      
      try {
        // Sign in with password for 2FA
        await authSession.client.signInWithPassword(
          {
            apiId: TELEGRAM_API_ID,
            apiHash: TELEGRAM_API_HASH,
          },
          {
            password: async (hint?: string) => password,
            onError: async (error: any) => {
              console.error('2FA password error:', error);
              throw error;
            }
          }
        );
        
        // Save the session
        const sessionString = authSession.client.session.save();
        saveUserSession(cleanNumber, sessionString);
        
        // Clean up
        authSession.client.destroy();
        authSessions.delete(cleanNumber);
        
        // Save or update user
        let telegramUser = await TelegramUser.findOne({ phoneNumber: cleanNumber });
        if (!telegramUser) {
          telegramUser = new TelegramUser({
            phoneNumber: cleanNumber,
            verified: true,
            verifiedAt: new Date()
          });
        } else {
          telegramUser.verified = true;
          telegramUser.verifiedAt = new Date();
        }
        
        await telegramUser.save();
        
        // Fetch user channels
        const channels = await TelegramController.fetchUserChannels(cleanNumber);
        
        res.json({ 
          success: true, 
          message: 'Login successful!',
          verified: true,
          authenticated: true,
          channels: channels,
          totalChannels: channels.length,
          user: {
            phoneNumber: cleanNumber,
            verifiedAt: telegramUser.verifiedAt
          }
        });
        
      } catch (error: any) {
        console.error('❌ Error during 2FA password verification:', error);
        
        // Clean up failed session
        authSession.client.destroy();
        authSessions.delete(cleanNumber);
        
        if (error.message.includes('PASSWORD_HASH_INVALID')) {
          res.status(400).json({ 
            success: false, 
            message: 'Invalid password. Please try again.' 
          });
        } else {
          res.status(500).json({ 
            success: false, 
            message: 'Failed to verify password: ' + error.message 
          });
        }
      }
      
    } catch (error: any) {
      console.error('❌ Unexpected error in verify2FAPassword:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error during password verification.' 
      });
    }
  };

  // Fetch user channels
  static fetchUserChannels = async (phoneNumber: string): Promise<ChannelInfo[]> => {
    try {
      const sessionString = loadUserSession(phoneNumber);
      if (!sessionString) {
        throw new Error('No session found for user');
      }
      
      const stringSession = new StringSession(sessionString);
      const client = new TelegramClient(
        stringSession,
        TELEGRAM_API_ID,
        TELEGRAM_API_HASH,
        { 
          connectionRetries: 3,
          timeout: 15000
        }
      );
      
      await client.connect();
      
      const result: any = await client.invoke(
        new Api.messages.GetDialogs({
          offsetDate: 0,
          offsetId: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          limit: 500,
          hash: bigInt(0)
        })
      );
      
      const channels: ChannelInfo[] = [];
      
      for (const chat of result.chats) {
        if (chat.className === 'Channel' || chat.className === 'Chat') {
          let memberCount = 0;
          let isAdmin = false;
          let isCreator = false;
          let inviteLink = null;
          
          try {
            if (chat.className === 'Channel') {
              const fullChannel = await client.invoke(
                new Api.channels.GetFullChannel({
                  channel: chat.id
                })
              ) as any;
              
              memberCount = fullChannel.fullChat.participantsCount || 0;
              
              // Check admin status
              const participant = await client.invoke(
                new Api.channels.GetParticipant({
                  channel: chat.id,
                  participant: 'me'
                })
              ).catch((): any => null) as any;
              
              if (participant) {
                isCreator = participant.participant.className === 'ChannelParticipantCreator';
                isAdmin = isCreator || participant.participant.className === 'ChannelParticipantAdmin';
              }
              
              // Get invite link if admin/creator
              if (isAdmin) {
                try {
                  const exportedInvite = await client.invoke(
                    new Api.messages.ExportChatInvite({
                      peer: chat.id,
                      legacyRevokePermanent: false
                    })
                  ) as any;
                  
                  inviteLink = exportedInvite.link;
                } catch (inviteError) {
                  // Silent fail for invite link
                }
              }
            } else {
              memberCount = (chat as any).participantsCount || 0;
            }
          } catch (err) {
            console.log(`Could not get full info for: ${(chat as any).title}`);
          }
          
          channels.push({
            id: chat.id.toString(),
            title: (chat as any).title,
            type: chat.className === 'Channel' ? ((chat as any).broadcast ? 'channel' : 'supergroup') : 'group',
            username: (chat as any).username || null,
            memberCount: memberCount,
            isAdmin: isAdmin,
            isCreator: isCreator,
            isVerified: (chat as any).verified || false,
            isScam: (chat as any).scam || false,
            isFake: (chat as any).fake || false,
            date: (chat as any).date,
            description: null,
            inviteLink: inviteLink
          });
        }
      }
      
      await client.disconnect();
      
      // Sort by: Creator first, then admin, then by member count
      return channels.sort((a, b) => {
        if (a.isCreator !== b.isCreator) return a.isCreator ? -1 : 1;
        if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
        return b.memberCount - a.memberCount;
      });
      
    } catch (error) {
      console.error('❌ Error fetching channels:', error);
      throw error;
    }
  };

  // Get user channels endpoint
  static getUserChannels = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.params;
      
      if (!phoneNumber) {
        res.status(400).json({ 
          success: false, 
          message: 'Phone number is required' 
        });
        return;
      }
      
      const cleanNumber = normalizePhoneNumber(phoneNumber);
      
      // Check if user has an active session
      const sessionString = loadUserSession(cleanNumber);
      if (!sessionString) {
        res.status(401).json({ 
          success: false, 
          message: 'No active session found. Please login first.' 
        });
        return;
      }
      
      const channels = await TelegramController.fetchUserChannels(cleanNumber);
      
      res.json({ 
        success: true, 
        channels: channels,
        totalChannels: channels.length
      });
      
    } catch (error: any) {
      console.error('❌ Error fetching user channels:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch channels: ' + error.message 
      });
    }
  };

  // Logout endpoint
  static logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        res.status(400).json({ 
          success: false, 
          message: 'Phone number is required' 
        });
        return;
      }
      
      const cleanNumber = normalizePhoneNumber(phoneNumber);
      
      // Remove session files
      const sessionFile = path.join(sessionsDir, `${cleanNumber.replace(/[^0-9+]/g, '')}.session`);
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }
      
      // Remove from memory
      userSessions.delete(cleanNumber);
      authSessions.delete(cleanNumber);
      
      // Update user record
      await TelegramUser.findOneAndUpdate(
        { phoneNumber: cleanNumber },
        { verified: false, verifiedAt: null }
      );
      
      res.json({ 
        success: true, 
        message: 'Logged out successfully' 
      });
      
    } catch (error: any) {
      console.error('❌ Error during logout:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to logout: ' + error.message 
      });
    }
  };

  // Check session status
  static checkSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.params;
      
      if (!phoneNumber) {
        res.status(400).json({ 
          success: false, 
          message: 'Phone number is required' 
        });
        return;
      }
      
      const cleanNumber = normalizePhoneNumber(phoneNumber);
      const hasSession = !!loadUserSession(cleanNumber);
      const hasAuthSession = authSessions.has(cleanNumber);
      
      const user = await TelegramUser.findOne({ phoneNumber: cleanNumber });
      
      res.json({ 
        success: true, 
        hasSession,
        hasAuthSession,
        verified: user?.verified || false,
        verifiedAt: user?.verifiedAt
      });
      
    } catch (error: any) {
      console.error('❌ Error checking session:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to check session status' 
      });
    }
  };
}