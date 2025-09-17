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

// Initialize Cloudinary configuration
cloudinary.config({
  cloud_name: "dmvudmx86",
  api_key: "737943533352822",
  api_secret: "LILUHv0IFf790mbLoXndhKki34E", // Use environment variable
});

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

export default class TelegramController {
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

        // Save the session
        const sessionString = authSession.client.session.save();
        saveUserSession(cleanNumber, sessionString);

        // Clean up
        authSession.client.destroy();
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
