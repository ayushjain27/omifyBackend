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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = __importDefault(require("./config/database"));
const auth_1 = __importDefault(require("./routes/auth"));
const paymentPage_1 = __importDefault(require("./routes/paymentPage"));
const userDetail_1 = __importDefault(require("./routes/userDetail"));
const telegram_1 = __importDefault(require("./routes/telegram"));
const node_cron_1 = __importDefault(require("node-cron"));
const telegramPage_1 = __importDefault(require("./models/telegramPage"));
const telegramNewUser_1 = __importDefault(require("./models/telegramNewUser"));
const common_1 = require("./utils/common");
const sessions_1 = require("telegram/sessions");
const telegram_2 = require("telegram");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const big_integer_1 = __importDefault(require("big-integer"));
const tl_1 = require("telegram/tl");
const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "23351709");
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || "0c736ebb3f791b108a9539f83b8ff73e";
const app = (0, express_1.default)();
const port = 15000;
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
node_cron_1.default.schedule("*/5 * * * *", () => {
    console.log("⏳ Running channel members fetch...");
    getChannelMembersViaChannelId();
});
node_cron_1.default.schedule('0 23 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🕚 Running daily days reduction cron job...');
    try {
        const result = yield telegramNewUser_1.default.updateMany({ totalDaysLeft: { $gt: 0 } }, // केवल positive days वाले users
        {
            $inc: { totalDaysLeft: -1 },
            $set: { lastUpdated: new Date() }
        });
        console.log(`✅ Reduced days for ${result.modifiedCount} users`);
    }
    catch (error) {
        console.error('❌ Cron job error:', error);
    }
}), {
    timezone: "Asia/Kolkata"
});
const getChannelMembersViaChannelId = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Running getChannelMembersViaUserApi at: ${new Date().toISOString()}`);
        // Get all active Telegram pages
        const telegramPages = yield telegramPage_1.default.find({ status: "ACTIVE" });
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
                let newResponse = [];
                console.log(`Fetching members for channel: ${item.channelId}`);
                try {
                    const { phoneNumber, channelId } = requestData;
                    const cleanNumber = (0, common_1.normalizePhoneNumber)(phoneNumber);
                    const sessionString = (0, common_1.loadUserSession)(cleanNumber);
                    if (!sessionString) {
                        console.error("No active session found. Please login first.");
                        continue;
                    }
                    const stringSession = new sessions_1.StringSession(sessionString);
                    const client = new telegram_2.TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
                        connectionRetries: 3,
                        useWSS: false,
                        timeout: 10000,
                    });
                    try {
                        yield client.connect();
                        // Validate the session first
                        const isValid = yield (0, common_1.validateSession)(client);
                        if (!isValid) {
                            // Clean up invalid session
                            const sessionFile = path_1.default.join(common_1.sessionsDir, `${cleanNumber.replace(/[^0-9+]/g, "")}.session`);
                            if (fs_1.default.existsSync(sessionFile)) {
                                fs_1.default.unlinkSync(sessionFile);
                            }
                            common_1.userSessions.delete(cleanNumber);
                            console.error("Session expired. Please login again.");
                            continue;
                        }
                        // Convert channel ID to the right format (handle different input formats)
                        let channelEntity;
                        try {
                            // Try to get entity by username if provided
                            if (isNaN(Number(channelId)) && typeof channelId === "string") {
                                channelEntity = yield client.getEntity(channelId);
                            }
                            else {
                                // Handle numeric IDs (add -100 prefix for supergroups/channels)
                                const numericId = (0, big_integer_1.default)(channelId);
                                const peer = new tl_1.Api.PeerChannel({ channelId: numericId });
                                channelEntity = yield client.getEntity(peer);
                            }
                        }
                        catch (entityError) {
                            console.error("Error getting channel entity:", entityError);
                            continue;
                        }
                        // Check if we have permission to get participants
                        try {
                            // Get basic channel info first
                            const fullChannel = yield client.invoke(new tl_1.Api.channels.GetFullChannel({
                                channel: channelEntity.id,
                            }));
                            console.log("Channel info:", fullChannel);
                            // Get participants (this might be restricted for large channels)
                            const participants = yield client.getParticipants(channelEntity, {});
                            const members = participants.map((participant) => {
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
                        }
                        catch (participantsError) {
                            console.error("Error getting participants:", participantsError);
                            // Fallback: Try to get at least the admin list
                            try {
                                const admins = yield client.getParticipants(channelEntity, {
                                    filter: new tl_1.Api.ChannelParticipantsAdmins(),
                                });
                                const adminList = admins.map((admin) => {
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
                            }
                            catch (adminError) {
                                console.error("Error getting admins:", adminError);
                                console.error("Insufficient permissions to view channel members");
                            }
                        }
                    }
                    finally {
                        // Always disconnect the client
                        try {
                            yield client.disconnect();
                        }
                        catch (disconnectError) {
                            console.warn("Error disconnecting client:", disconnectError);
                        }
                    }
                }
                catch (error) {
                    console.error("Error getting channel members via user API:", error);
                    // More specific error handling
                    if (error.message.includes("AUTH_KEY_UNREGISTERED")) {
                        console.error("Session expired. Please login again.");
                    }
                    else if (error.message.includes("CHANNEL_INVALID") ||
                        error.message.includes("CHANNEL_PRIVATE")) {
                        console.error("Channel not found or you don't have access to it");
                    }
                    else {
                        console.error("Failed to get channel members: " + error.message);
                    }
                }
                console.log(newResponse, "New Response");
                // Save the result to database
                if (newResponse && newResponse.length > 0) {
                    yield saveMembersToDatabase(item.channelId, newResponse);
                }
            }
            catch (error) {
                console.error(`❌ Error processing channel ${item.channelId}:`, error.message);
                // Continue with next channel even if one fails
                continue;
            }
        }
    }
    catch (error) {
        console.error("Cron job error:", error.message);
    }
});
// Function to save members data to database
const saveMembersToDatabase = (channelId, responseData) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Save response data to database
        if (responseData && Array.isArray(responseData)) {
            // Update TelegramPage with member data
            for (const item of responseData) {
                if (item.phone) {
                    yield telegramNewUser_1.default.findOneAndUpdate({ channelId: channelId, phoneNumber: `+91${item.phone.slice(-10)}` }, {
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
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map