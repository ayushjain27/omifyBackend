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

// const TELEGRAM_API_ID = 23351709;

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

// Session management functions
function saveUserSession(phoneNumber: any, sessionString: any): void {
  const sessionFile = path.join(sessionsDir, `${phoneNumber.replace(/[^0-9+]/g, '')}.session`);
  fs.writeFileSync(sessionFile, sessionString);
  userSessions.set(phoneNumber, sessionString);
}

function loadUserSession(phoneNumber: string): string {
  const sessionFile = path.join(sessionsDir, `${phoneNumber.replace(/[^0-9+]/g, '')}.session`);
  if (fs.existsSync(sessionFile)) {
    const sessionString = fs.readFileSync(sessionFile, 'utf8');
    userSessions.set(phoneNumber, sessionString);
    return sessionString;
  }
  return '';
}

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
      let cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
      if (!cleanNumber.startsWith('+')) {
        if (cleanNumber.length === 10) {
          cleanNumber = `+91${cleanNumber}`;
        } else {
          cleanNumber = `+${cleanNumber}`;
        }
      }
      
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
      
      // Set timeout to clean up session after 10 minutes
      setTimeout(() => {
        if (authSessions.has(cleanNumber)) {
          const session = authSessions.get(cleanNumber);
          if (session) {
            session.client.destroy();
          }
          authSessions.delete(cleanNumber);
        }
      }, 10 * 60 * 1000);
      
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
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to initiate login process' 
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
      
      const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
      const authSession = authSessions.get(cleanNumber);
      
      if (!authSession) {
        res.status(400).json({ 
          success: false, 
          message: 'No active session found for this phone number. Please request a new OTP.' 
        });
        return;
      }
      
      // Sign in with the code
      const result = await authSession.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: cleanNumber,
          phoneCodeHash: authSession.phoneCodeHash,
          phoneCode: otp,
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
      console.error('❌ Error verifying OTP:', error);
      
      if (error.message.includes('PHONE_CODE_INVALID')) {
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
          message: 'Failed to verify OTP.' 
        });
      }
    }
  };

  // Fetch user channels (same as before)
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

  // Other methods (getUserChannels, getChannelDetails, etc.) remain the same
  // ...
}