import express from "express";
import cors from "cors";
import connectToMongo from "./config/database";
import auth from "./routes/auth";
import paymentPage from "./routes/paymentPage";
import userPaymentDetailsPage from "./routes/userDetail";
import telegram from "./routes/telegram";
import cron from "node-cron";
import axios from "axios";
import TelegramPage from "./models/telegramPage";
import TelegramNewUser from "./models/telegramNewUser";
import { loadUserSession, normalizePhoneNumber, sessionsDir, userSessions, validateSession } from "./utils/common";
import { StringSession } from "telegram/sessions";
import { TelegramClient } from "telegram";
import fs from "fs";
import path from "path";
import bigInt from "big-integer";
import { Api } from "telegram/tl";

const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "23351709");
const TELEGRAM_API_HASH =
  process.env.TELEGRAM_API_HASH || "0c736ebb3f791b108a9539f83b8ff73e";

const app = express();
const port = 15000;

connectToMongo();

app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", auth);
app.use("/paymentPage", paymentPage);
app.use("/userPaymentDetails", userPaymentDetailsPage);
app.use("/telegram", telegram);

cron.schedule("*/5 * * * *", () => {
  console.log("⏳ Running channel members fetch...");
  getChannelMembersViaChannelId();
});

cron.schedule('0 23 * * *', async () => {
  console.log('🕚 Running daily days reduction cron job...');
  
  try {
    const result = await TelegramNewUser.updateMany(
      { totalDaysLeft: { $gt: 0 } }, // केवल positive days वाले users
      { 
        $inc: { totalDaysLeft: -1 },
        $set: { lastUpdated: new Date() }
      }
    );
    
    console.log(`✅ Reduced days for ${result.modifiedCount} users`);
  } catch (error) {
    console.error('❌ Cron job error:', error);
  }
}, {
  timezone: "Asia/Kolkata"
});

const getChannelMembersViaChannelId = async () => {
  try {
    console.log(
      `Running getChannelMembersViaUserApi at: ${new Date().toISOString()}`
    );
    // Get all active Telegram pages
    const telegramPages = await TelegramPage.find({ status: "ACTIVE" });
    console.log(telegramPages, "AFlew;kmlf");
    
    // Check if there are any active pages
    if (!telegramPages || telegramPages.length === 0) {
      console.log("No active Telegram pages found");
      return;
    }
    
    console.log(`Processing ${telegramPages.length} active channels`);
    
    // Process each channel sequentially
    for (const item of telegramPages) {
      try {
        // Validate required fields
        if (!item.channelId || !item.phoneNumber) {
          console.warn(`Skipping channel - missing channelId or phoneNumber:`, {
            channelId: item.channelId,
            phoneNumber: item.phoneNumber,
          });
          continue;
        }
        
        const requestData = {
          channelId: item.channelId,
          phoneNumber: item.phoneNumber,
        };
        
        let newResponse: any = [];
        console.log(`Fetching members for channel: ${item.channelId}`);
        
        try {
          const { phoneNumber, channelId } = requestData;
    
          const cleanNumber = normalizePhoneNumber(phoneNumber);
          const sessionString = loadUserSession(cleanNumber);
    
          if (!sessionString) {
            console.error("No active session found. Please login first.");
            continue;
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
    
              console.error("Session expired. Please login again.");
              continue;
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
              continue;
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
                };
              });
    
              newResponse = members;
              console.log(`Successfully fetched ${members.length} members`);
              
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
                console.log(adminList, "Admin List");
                newResponse = adminList;
                
              } catch (adminError) {
                console.error("Error getting admins:", adminError);
                console.error("Insufficient permissions to view channel members");
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
            console.error("Session expired. Please login again.");
          } else if (
            error.message.includes("CHANNEL_INVALID") ||
            error.message.includes("CHANNEL_PRIVATE")
          ) {
            console.error("Channel not found or you don't have access to it");
          } else {
            console.error("Failed to get channel members: " + error.message);
          }
        }

        console.log(newResponse, "New Response");
        
        // Save the result to database
        if (newResponse && newResponse.length > 0) {
          await saveMembersToDatabase(item.channelId, newResponse);
        }
      } catch (error: any) {
        console.error(
          `❌ Error processing channel ${item.channelId}:`,
          error.message
        );
        // Continue with next channel even if one fails
        continue;
      }
    }
  } catch (error: any) {
    console.error("Cron job error:", error.message);
  }
};

// Function to save members data to database
const saveMembersToDatabase = async (channelId: any, responseData: any) => {
  try {
    // Save response data to database
    if (responseData && Array.isArray(responseData)) {
      // Update TelegramPage with member data
      for (const item of responseData) {
        if (item.phone) {
          await TelegramNewUser.findOneAndUpdate(
            { channelId: channelId, phoneNumber: `+91${item.phone.slice(-10)}` },
            {
              firstName: item.firstName,
              lastName: item.lastName,
              userId: item.userId,
            },
            { upsert: true }
          );
        }
      }
      console.log(`✅ Saved ${responseData.length} members for channel ${channelId}`);
    }
  } catch (dbError: any) {
    console.error(
      `Error saving members for channel ${channelId}:`,
      dbError.message
    );
  }
};

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
