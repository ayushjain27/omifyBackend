import express from "express";
import cors from "cors";
import connectToMongo from "./config/database";
import auth from "./routes/auth";
import paymentPage from "./routes/paymentPage";
import userPaymentDetailsPage from "./routes/userDetail";
import telegram from "./routes/telegram";
import axios from "axios";
import TelegramPage from "./models/telegramPage";
import TelegramNewUser from "./models/telegramNewUser";
import {
  loadUserSession,
  normalizePhoneNumber,
  sessionsDir,
  userSessions,
  validateSession,
} from "./utils/common";
import { StringSession } from "telegram/sessions";
import { TelegramClient } from "telegram";
import fs from "fs";
import path from "path";
import bigInt from "big-integer";
import { Api } from "telegram/tl";

const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "23351709");
const TELEGRAM_API_HASH =
  process.env.TELEGRAM_API_HASH || "0c736ebb3f791b108a9539f83b8ff73e";
const botToken = "8343683334:AAE8RnQAJ28npHfR9gNWME9LrGktIsPOk0E";

const app = express();

// Connect to MongoDB
connectToMongo();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/auth", auth);
app.use("/paymentPage", paymentPage);
app.use("/userPaymentDetails", userPaymentDetailsPage);
app.use("/telegram", telegram);

// ==================== CRON JOB ENDPOINTS ====================

// Cron Job 1: Fetch channel members (runs at 6 AM and 6 PM)
app.post("/api/cron/channel-members", async (req, res) => {
  try {
    // Security check - verify cron secret
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("⏳ Running channel members fetch...");
    await getChannelMembersViaChannelId();
    
    res.status(200).json({ 
      success: true, 
      message: "Channel members fetched successfully" 
    });
  } catch (error: any) {
    console.error("Error in channel members cron:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Cron Job 2: Reduce days for users (runs at 11 PM)
app.post("/api/cron/reduce-days", async (req, res) => {
  try {
    // Security check
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("🕚 Running daily days reduction cron job...");
    
    const result = await TelegramNewUser.updateMany(
      { totalDaysLeft: { $gt: 0 } },
      {
        $inc: { totalDaysLeft: -1 },
        $set: { lastUpdated: new Date() },
      }
    );
    
    console.log(`✅ Reduced days for ${result.modifiedCount} users`);
    
    res.status(200).json({ 
      success: true, 
      message: `Reduced days for ${result.modifiedCount} users` 
    });
  } catch (error: any) {
    console.error("❌ Cron job error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Cron Job 3: Remove users with 0 days left (runs at 2 AM)
app.post("/api/cron/remove-expired-users", async (req, res) => {
  try {
    // Security check
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("🕚 Running expired users removal cron job...");
    
    const usersToRemove = await TelegramNewUser.find({
      totalDaysLeft: 0,
      channelId: { $ne: "" },
    });
    
    console.log(`Found ${usersToRemove.length} users to remove`);
    
    if (usersToRemove.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "No users found with totalDaysLeft = 0" 
      });
    }
    
    const results = [];
    for (const user of usersToRemove) {
      const channelId = user.channelId;
      const userId = user.userId.toString();
      const result = await removeUserFromChannel(channelId, userId);
      results.push({ userId, channelId, result });
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Processed ${usersToRemove.length} users`,
      results 
    });
  } catch (error: any) {
    console.error("Error in remove expired users cron:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

export const removeUserFromChannel = async (
  channelId: string,
  userId: string
) => {
  try {
    console.log("Remove user request received with data:", {
      channelId,
      userId,
      botToken,
    });

    let formattedChannelId = channelId;
    if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
      formattedChannelId = `-100${channelId}`;
      console.log("Converting channel ID to:", formattedChannelId);
    }

    const numericUserId = parseInt(userId, 10);
    if (isNaN(numericUserId)) {
      return {
        error: "Invalid User ID format",
        details: "User ID must be a valid number",
      };
    }

    try {
      const botInfoResponse = await axios.get(
        `https://api.telegram.org/bot${botToken}/getMe`
      );
      const botId = botInfoResponse.data.result.id;
      console.log("Bot ID:", botId);

      const chatMemberResponse = await axios.get(
        `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`
      );
      const botStatus = chatMemberResponse.data.result.status;
      console.log("Bot status in channel:", botStatus);

      if (botStatus !== "administrator" && botStatus !== "creator") {
        return {
          error: "Bot is not an administrator in the specified channel",
          details:
            "Please make sure the bot has been added as an admin with appropriate permissions",
        };
      }

      const canRestrictMembers =
        chatMemberResponse.data.result.can_restrict_members;
      console.log("Bot can restrict members:", canRestrictMembers);

      if (!canRestrictMembers) {
        return {
          error: "Bot does not have permission to remove users",
          details:
            'Please grant the bot "Ban Users" permission in the channel settings',
        };
      }
    } catch (error: any) {
      console.error(
        "Error checking bot admin status:",
        error.response?.data || error.message
      );
      if (error.response?.data.error_code === 400) {
        return {
          error: "Bot is not a member of the specified channel",
          details:
            "Please add the bot to the channel first and make it an administrator",
        };
      }
      return {
        error: "Failed to verify bot permissions",
        details: error.response?.data?.description || error.message,
      };
    }

    try {
      const userStatusResponse = await axios.get(
        `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`
      );
      const userStatus = userStatusResponse.data.result.status;
      console.log("User status in channel:", userStatus);

      if (userStatus === "left" || userStatus === "kicked") {
        return {
          error: "User is not a member of the channel",
          details: `User status: ${userStatus}`,
        };
      }
    } catch (statusError: any) {
      console.log(
        "Error checking user status:",
        statusError.response?.data || statusError.message
      );
      return {
        error: "User is not a member of the channel or invalid user ID",
      };
    }

    try {
      console.log("Trying to ban user...");
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/banChatMember`,
        {
          chat_id: formattedChannelId,
          user_id: numericUserId,
          revoke_messages: false,
        }
      );
      console.log("User banned successfully:", response.data);
      return {
        success: true,
        message: `User ${userId} successfully removed from channel ${channelId}`,
        data: response.data,
      };
    } catch (banError: any) {
      console.error(
        "Error with banChatMember:",
        banError.response?.data || banError.message
      );

      try {
        console.log("Trying to kick user...");
        const response = await axios.post(
          `https://api.telegram.org/bot${botToken}/banChatMember`,
          {
            chat_id: formattedChannelId,
            user_id: numericUserId,
            until_date: Math.floor(Date.now() / 1000) + 30,
            revoke_messages: false,
          }
        );
        console.log("User kicked successfully:", response.data);
        return {
          success: true,
          message: `User ${userId} successfully kicked from channel ${channelId}`,
          data: response.data,
        };
      } catch (kickError: any) {
        console.error(
          "Error with kick:",
          kickError.response?.data || kickError.message
        );
        return {
          error: "Failed to remove user from channel",
          details: kickError.response?.data?.description || kickError.message,
          possibleReasons: [
            "Bot might not have sufficient permissions",
            "User might be the channel owner",
            "User might be an admin with higher privileges than bot",
          ],
        };
      }
    }
  } catch (error: any) {
    console.error("Unexpected error in RemoveUserFromChannel:", error);
    return {
      error: "Unexpected error occurred",
      details: error.message,
    };
  }
};

const getChannelMembersViaChannelId = async () => {
  try {
    console.log(
      `Running getChannelMembersViaUserApi at: ${new Date().toISOString()}`
    );

    const telegramPages = await TelegramPage.find({ status: "ACTIVE" });
    console.log(telegramPages, "Active Telegram Pages");

    if (!telegramPages || telegramPages.length === 0) {
      console.log("No active Telegram pages found");
      return;
    }

    console.log(`Processing ${telegramPages.length} active channels`);

    for (const item of telegramPages) {
      try {
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

            const isValid = await validateSession(client);
            if (!isValid) {
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

            let channelEntity;
            try {
              if (isNaN(Number(channelId)) && typeof channelId === "string") {
                channelEntity = await client.getEntity(channelId);
              } else {
                const numericId = bigInt(channelId);
                const peer = new Api.PeerChannel({ channelId: numericId });
                channelEntity = await client.getEntity(peer);
              }
            } catch (entityError) {
              console.error("Error getting channel entity:", entityError);
              continue;
            }

            try {
              const fullChannel = await client.invoke(
                new Api.channels.GetFullChannel({
                  channel: channelEntity.id,
                })
              );
              console.log("Channel info:", fullChannel);

              const participants = await client.getParticipants(
                channelEntity,
                {}
              );

              const members = participants.map((participant: any) => {
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
                console.error(
                  "Insufficient permissions to view channel members"
                );
              }
            }
          } finally {
            try {
              await client.disconnect();
            } catch (disconnectError) {
              console.warn("Error disconnecting client:", disconnectError);
            }
          }
        } catch (error: any) {
          console.error("Error getting channel members via user API:", error);

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

        if (newResponse && newResponse.length > 0) {
          await saveMembersToDatabase(item.channelId, newResponse);
        }
      } catch (error: any) {
        console.error(
          `❌ Error processing channel ${item.channelId}:`,
          error.message
        );
        continue;
      }
    }
  } catch (error: any) {
    console.error("Cron job error:", error.message);
  }
};

const saveMembersToDatabase = async (channelId: any, responseData: any) => {
  try {
    if (responseData && Array.isArray(responseData)) {
      for (const item of responseData) {
        if (item.phone) {
          await TelegramNewUser.findOneAndUpdate(
            {
              channelId: channelId,
              phoneNumber: `+91${item.phone.slice(-10)}`,
            },
            {
              firstName: item.firstName,
              lastName: item.lastName,
              userId: item.userId,
            },
            { upsert: true }
          );
        }
      }
      console.log(
        `✅ Saved ${responseData.length} members for channel ${channelId}`
      );
    }
  } catch (dbError: any) {
    console.error(
      `Error saving members for channel ${channelId}:`,
      dbError.message
    );
  }
};

// For local development
// if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 15000;
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/`);
    console.log(`\nCron endpoints (for testing):`);
    console.log(`  POST http://localhost:${port}/api/cron/channel-members`);
    console.log(`  POST http://localhost:${port}/api/cron/reduce-days`);
    console.log(`  POST http://localhost:${port}/api/cron/remove-expired-users`);
  });
// }

// Export the Express app for Vercel
export default app;