"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChannelMembersViaChannelId = exports.removeUserFromChannel = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = __importDefault(require("./config/database"));
const auth_1 = __importDefault(require("./routes/auth"));
const paymentPage_1 = __importDefault(require("./routes/paymentPage"));
const userDetail_1 = __importDefault(require("./routes/userDetail"));
const telegram_1 = __importDefault(require("./routes/telegram"));
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const telegramPage_1 = __importDefault(require("./models/telegramPage"));
const telegramNewUser_1 = __importDefault(require("./models/telegramNewUser"));
const common_1 = require("./utils/common");
const sessions_1 = require("telegram/sessions");
const telegram_2 = require("telegram");
const fs_1 = __importDefault(require("fs"));
const big_integer_1 = __importDefault(require("big-integer"));
const tl_1 = require("telegram/tl");
const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "23351709");
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || "0c736ebb3f791b108a9539f83b8ff73e";
const botToken = "8343683334:AAE8RnQAJ28npHfR9gNWME9LrGktIsPOk0E";
const app = (0, express_1.default)();
// Connect to MongoDB
(0, database_1.default)();
app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "Server is running",
        timestamp: new Date().toISOString(),
    });
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use("/auth", auth_1.default);
app.use("/paymentPage", paymentPage_1.default);
app.use("/userPaymentDetails", userDetail_1.default);
app.use("/telegram", telegram_1.default);
// cron.schedule('* * * * * *', async () => {
//   console.log("⏳ Running channel members fetch...");
//   getChannelMembersViaChannelId();
// });
node_cron_1.default.schedule("0 23 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("🕚 Running daily days reduction cron job...");
    try {
        const result = yield telegramNewUser_1.default.updateMany({ totalDaysLeft: { $gt: 0 } }, // केवल positive days वाले users
        {
            $inc: { totalDaysLeft: -1 },
            $set: { lastUpdated: new Date() },
        });
        console.log(`✅ Reduced days for ${result.modifiedCount} users`);
    }
    catch (error) {
        console.error("❌ Cron job error:", error);
    }
}), {
    timezone: "Asia/Kolkata",
});
node_cron_1.default.schedule("0 2 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("🕚 Running daily days reduction cron job...");
    try {
        console.log("Starting daily check for users with totalDaysLeft = 0...");
        // Pehle sab users find karein jinka totalDaysLeft = 0 hai
        const usersToRemove = yield telegramNewUser_1.default.find({
            totalDaysLeft: 0,
            channelId: { $ne: "" }, // Sirf un users ko jo channel mein hain
        });
        console.log(`Found ${usersToRemove.length} users to remove`);
        if (usersToRemove.length === 0) {
            console.log("No users found with totalDaysLeft = 0");
            return;
        }
        for (const user of usersToRemove) {
            const channelId = user.channelId;
            const userId = user.userId.toString();
            yield (0, exports.removeUserFromChannel)(channelId, userId);
        }
    }
    catch (error) {
        console.error("Error in daily cron job:", error);
    }
}), {
    timezone: "Asia/Kolkata",
});
const removeUserFromChannel = (channelId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    try {
        console.log("Remove user request received with data:", {
            channelId,
            userId,
            botToken,
        });
        // Format channel ID correctly
        let formattedChannelId = channelId;
        if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
            formattedChannelId = `-100${channelId}`;
            console.log("Converting channel ID to:", formattedChannelId);
        }
        // Convert user ID to number
        const numericUserId = parseInt(userId, 10);
        if (isNaN(numericUserId)) {
            return {
                error: "Invalid User ID format",
                details: "User ID must be a valid number",
            };
        }
        // First, check if the bot is an admin and has permission to ban users
        try {
            const botInfoResponse = yield axios_1.default.get(`https://api.telegram.org/bot${botToken}/getMe`);
            const botId = botInfoResponse.data.result.id;
            console.log("Bot ID:", botId);
            // Check if bot is admin in the channel
            const chatMemberResponse = yield axios_1.default.get(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`);
            const botStatus = chatMemberResponse.data.result.status;
            console.log("Bot status in channel:", botStatus);
            if (botStatus !== "administrator" && botStatus !== "creator") {
                return {
                    error: "Bot is not an administrator in the specified channel",
                    details: "Please make sure the bot has been added as an admin with appropriate permissions",
                };
            }
            // Check if bot has permission to ban/restrict users
            const canRestrictMembers = chatMemberResponse.data.result.can_restrict_members;
            console.log("Bot can restrict members:", canRestrictMembers);
            if (!canRestrictMembers) {
                return {
                    error: "Bot does not have permission to remove users",
                    details: 'Please grant the bot "Ban Users" permission in the channel settings',
                };
            }
        }
        catch (error) {
            console.error("Error checking bot admin status:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.data.error_code) === 400) {
                return {
                    error: "Bot is not a member of the specified channel",
                    details: "Please add the bot to the channel first and make it an administrator",
                };
            }
            return {
                error: "Failed to verify bot permissions",
                details: ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.description) || error.message,
            };
        }
        // Check if user is actually a member of the channel
        try {
            const userStatusResponse = yield axios_1.default.get(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`);
            const userStatus = userStatusResponse.data.result.status;
            console.log("User status in channel:", userStatus);
            if (userStatus === "left" || userStatus === "kicked") {
                return {
                    error: "User is not a member of the channel",
                    details: `User status: ${userStatus}`,
                };
            }
        }
        catch (statusError) {
            console.log("Error checking user status:", ((_e = statusError.response) === null || _e === void 0 ? void 0 : _e.data) || statusError.message);
            return {
                error: "User is not a member of the channel or invalid user ID",
            };
        }
        // METHOD 1: Try to ban the user (permanently remove)
        try {
            console.log("Trying to ban user...");
            const response = yield axios_1.default.post(`https://api.telegram.org/bot${botToken}/banChatMember`, {
                chat_id: formattedChannelId,
                user_id: numericUserId,
                revoke_messages: false, // Set true to delete all messages from user
            });
            console.log("User banned successfully:", response.data);
            return {
                success: true,
                message: `User ${userId} successfully removed from channel ${channelId}`,
                data: response.data,
            };
        }
        catch (banError) {
            console.error("Error with banChatMember:", ((_f = banError.response) === null || _f === void 0 ? void 0 : _f.data) || banError.message);
            // METHOD 2: If ban fails, try to kick the user (temporary remove)
            try {
                console.log("Trying to kick user...");
                const response = yield axios_1.default.post(`https://api.telegram.org/bot${botToken}/banChatMember`, {
                    chat_id: formattedChannelId,
                    user_id: numericUserId,
                    until_date: Math.floor(Date.now() / 1000) + 30, // 30 seconds se ban
                    revoke_messages: false,
                });
                console.log("User kicked successfully:", response.data);
                return {
                    success: true,
                    message: `User ${userId} successfully kicked from channel ${channelId}`,
                    data: response.data,
                };
            }
            catch (kickError) {
                console.error("Error with kick:", ((_g = kickError.response) === null || _g === void 0 ? void 0 : _g.data) || kickError.message);
                // Return detailed error information
                return {
                    error: "Failed to remove user from channel",
                    details: ((_j = (_h = kickError.response) === null || _h === void 0 ? void 0 : _h.data) === null || _j === void 0 ? void 0 : _j.description) || kickError.message,
                    possibleReasons: [
                        "Bot might not have sufficient permissions",
                        "User might be the channel owner",
                        "User might be an admin with higher privileges than bot",
                    ],
                };
            }
        }
    }
    catch (error) {
        console.error("Unexpected error in RemoveUserFromChannel:", error);
        return {
            error: "Unexpected error occurred",
            details: error.message,
        };
    }
});
exports.removeUserFromChannel = removeUserFromChannel;
const getChannelMembersViaChannelId = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log(`Running getChannelMembersViaChannelId at: ${new Date().toISOString()}`);
        const telegramPages = yield telegramPage_1.default.find({ status: "ACTIVE" });
        console.log(`Found ${telegramPages.length} active Telegram pages`);
        if (!telegramPages || telegramPages.length === 0) {
            console.log("No active Telegram pages found");
            return;
        }
        for (const item of telegramPages) {
            if (!item.channelId || !item.phoneNumber) {
                console.warn(`Skipping channel - missing channelId or phoneNumber`, {
                    channelId: item.channelId,
                    phoneNumber: item.phoneNumber,
                });
                continue;
            }
            const cleanNumber = (0, common_1.normalizePhoneNumber)(item.phoneNumber);
            let sessionString = (0, common_1.loadUserSession)(cleanNumber);
            if (!sessionString) {
                console.error(`❌ No session found for ${item.phoneNumber}. Please log in first.`);
                continue;
            }
            const client = new telegram_2.TelegramClient(new sessions_1.StringSession(sessionString), TELEGRAM_API_ID, TELEGRAM_API_HASH, {
                connectionRetries: 3,
                useWSS: false,
                timeout: 10000,
            });
            try {
                yield client.connect();
                const isValid = yield (0, common_1.validateSession)(client);
                if (!isValid) {
                    console.error(`❌ Session expired or invalid for ${item.phoneNumber}. Clean up and skip.`);
                    // Clean up invalid session file
                    const sessionFile = (0, common_1.getSessionFilePath)(item.phoneNumber);
                    if (fs_1.default.existsSync(sessionFile)) {
                        fs_1.default.unlinkSync(sessionFile);
                    }
                    continue;
                }
                // Resolve channel entity
                let channelEntity;
                if (typeof item.channelId === "string" && isNaN(Number(item.channelId))) {
                    // It's a username like "mychannel"
                    channelEntity = yield client.getEntity(item.channelId);
                }
                else {
                    // It's a numeric ID (maybe with or without -100)
                    let numericId = item.channelId.toString();
                    if (numericId.startsWith("-100")) {
                        numericId = numericId.substring(4);
                    }
                    else if (numericId.startsWith("-")) {
                        numericId = numericId.substring(1);
                    }
                    const peer = new tl_1.Api.PeerChannel({ channelId: (0, big_integer_1.default)(numericId) });
                    channelEntity = yield client.getEntity(peer);
                }
                // Get participants
                let participants;
                try {
                    participants = yield client.getParticipants(channelEntity, {});
                }
                catch (e) {
                    console.warn(`⚠️ Cannot fetch full participant list for ${item.channelId}:`, e.message);
                    // Fallback: fetch only admins
                    try {
                        participants = yield client.getParticipants(channelEntity, {
                            filter: new tl_1.Api.ChannelParticipantsAdmins(),
                        });
                    }
                    catch (adminErr) {
                        console.error(`❌ Failed to fetch even admins for ${item.channelId}:`, adminErr);
                        continue;
                    }
                }
                const members = participants.map((p) => {
                    var _a;
                    const user = p.user || p;
                    return {
                        userId: (_a = user.id) === null || _a === void 0 ? void 0 : _a.toString(),
                        firstName: user.firstName || "",
                        lastName: user.lastName || "",
                        username: user.username || "",
                        phone: user.phone || "",
                        isBot: !!user.bot,
                        isPremium: !!user.premium,
                        status: p.status ? p.status.className : "unknown",
                        joinDate: p.date ? new Date(p.date * 1000) : null,
                    };
                });
                console.log(`✅ Fetched ${members.length} members for channel ${item.channelId}`);
                yield saveMembersToDatabase(item.channelId, members);
            }
            catch (error) {
                console.error(`🔥 Error processing channel ${item.channelId}:`, error.message || error);
                if ((_a = error === null || error === void 0 ? void 0 : error.errorMessage) === null || _a === void 0 ? void 0 : _a.includes("AUTH_KEY_UNREGISTERED")) {
                    console.error(`💀 Session for ${item.phoneNumber} is dead. Deleting session file.`);
                    const sessionFile = (0, common_1.getSessionFilePath)(item.phoneNumber);
                    if (fs_1.default.existsSync(sessionFile)) {
                        fs_1.default.unlinkSync(sessionFile);
                    }
                }
            }
            finally {
                try {
                    yield client.disconnect();
                }
                catch (e) {
                    console.warn("Error disconnecting client:", e);
                }
            }
        }
    }
    catch (error) {
        console.error("💥 Top-level error in cron job:", error.message);
    }
});
exports.getChannelMembersViaChannelId = getChannelMembersViaChannelId;
// Function to save members data to database
const saveMembersToDatabase = (channelId, responseData) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Save response data to database
        if (responseData && Array.isArray(responseData)) {
            // Update TelegramPage with member data
            for (const item of responseData) {
                if (item.phone) {
                    yield telegramNewUser_1.default.findOneAndUpdate({
                        channelId: channelId,
                        phoneNumber: `+91${item.phone.slice(-10)}`,
                    }, {
                        firstName: item.firstName,
                        lastName: item.lastName,
                        userId: item.userId,
                    }, { upsert: true });
                }
            }
            console.log(`✅ Saved ${responseData.length} members for channel ${channelId}`);
        }
    }
    catch (dbError) {
        console.error(`Error saving members for channel ${channelId}:`, dbError.message);
    }
});
// For local development
// if (process.env.NODE_ENV !== "production") {
const port = process.env.PORT || 15000;
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/`);
    console.log(`\nCron endpoints (for testing):`);
});
// }
// Export the Express app for Vercel
exports.default = app;
//# sourceMappingURL=index.js.map