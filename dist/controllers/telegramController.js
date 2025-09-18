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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const telegramUser_1 = __importDefault(require("../models/telegramUser"));
const telegram_1 = require("telegram");
const sessions_1 = require("telegram/sessions");
const tl_1 = require("telegram/tl");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const big_integer_1 = __importDefault(require("big-integer"));
const telegramPage_1 = __importDefault(require("../models/telegramPage"));
const cloudinary_1 = require("cloudinary");
const axios_1 = __importDefault(require("axios"));
// Initialize Cloudinary configuration
cloudinary_1.v2.config({
    cloud_name: "dmvudmx86",
    api_key: "737943533352822",
    api_secret: "LILUHv0IFf790mbLoXndhKki34E", // Use environment variable
});
const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "23351709");
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || "0c736ebb3f791b108a9539f83b8ff73e";
// Storage for authentication sessions
const authSessions = new Map();
const userSessions = new Map();
// Ensure directories exist
const sessionsDir = path_1.default.join(process.cwd(), "telegram-sessions");
if (!fs_1.default.existsSync(sessionsDir)) {
    fs_1.default.mkdirSync(sessionsDir, { recursive: true });
}
// Helper function to normalize phone number format
function normalizePhoneNumber(phoneNumber) {
    let cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
    if (!cleanNumber.startsWith("+")) {
        if (cleanNumber.length === 10) {
            cleanNumber = `+91${cleanNumber}`;
        }
        else {
            cleanNumber = `+${cleanNumber}`;
        }
    }
    return cleanNumber;
}
// Session management functions
function saveUserSession(phoneNumber, sessionString) {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    const sessionFile = path_1.default.join(sessionsDir, `${normalizedNumber.replace(/[^0-9+]/g, "")}.session`);
    fs_1.default.writeFileSync(sessionFile, sessionString);
    userSessions.set(normalizedNumber, sessionString);
}
function loadUserSession(phoneNumber) {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    const sessionFile = path_1.default.join(sessionsDir, `${normalizedNumber.replace(/[^0-9+]/g, "")}.session`);
    if (fs_1.default.existsSync(sessionFile)) {
        const sessionString = fs_1.default.readFileSync(sessionFile, "utf8");
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
            }
            catch (error) {
                console.error("Error destroying client:", error);
            }
            authSessions.delete(phoneNumber);
        }
    }
}, 60 * 1000); // Check every minute
const botToken = "8343683334:AAE8RnQAJ28npHfR9gNWME9LrGktIsPOk0E";
const baseUrl = `https://api.telegram.org/bot${botToken}`;
class TelegramController {
}
_a = TelegramController;
TelegramController.AddUserToChannel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
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
            const botInfoResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getMe`);
            const botId = botInfoResponse.data.result.id;
            console.log("Bot ID:", botId);
            // Check if bot is admin in the channel
            const chatMemberResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`);
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
        }
        catch (error) {
            console.error('Error checking bot admin status:', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.data.error_code) === 400) {
                return res.status(404).json({
                    error: 'Bot is not a member of the specified channel',
                    details: 'Please add the bot to the channel first and make it an administrator'
                });
            }
            return res.status(500).json({
                error: 'Failed to verify bot permissions',
                details: ((_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.description) || error.message
            });
        }
        // Check if user is already a member of the channel
        try {
            const userStatusResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`);
            const userStatus = userStatusResponse.data.result.status;
            console.log("User status in channel:", userStatus);
            if (userStatus !== 'left' && userStatus !== 'kicked') {
                return res.status(400).json({
                    error: 'User is already a member of the channel',
                    details: `User status: ${userStatus}`
                });
            }
        }
        catch (statusError) {
            console.log("User is not a member of the channel or error checking status:", ((_f = statusError.response) === null || _f === void 0 ? void 0 : _f.data) || statusError.message);
        }
        // METHOD 1: First try to add user directly using inviteChatMember
        try {
            console.log("Trying to add user directly with inviteChatMember...");
            const response = yield axios_1.default.post(`https://api.telegram.org/bot${apiToken}/inviteChatMember`, {
                chat_id: formattedChannelId,
                user_id: numericUserId
            });
            console.log("User added successfully with inviteChatMember:", response.data);
            return res.json({
                success: true,
                message: `User ${userId} successfully added to channel ${channelId}`,
                data: response.data
            });
        }
        catch (inviteError) {
            console.error('Error with inviteChatMember:', ((_g = inviteError.response) === null || _g === void 0 ? void 0 : _g.data) || inviteError.message);
            // METHOD 2: If direct add fails, try to use approveChatJoinRequest
            // (This will work if user has sent a join request)
            try {
                console.log("Trying approveChatJoinRequest method...");
                console.log(numericUserId, "feklwmlk", formattedChannelId);
                const response = yield axios_1.default.post(`https://api.telegram.org/bot${apiToken}/approveChatJoinRequest`, {
                    chat_id: formattedChannelId,
                    user_id: numericUserId,
                    hide_requester: false // ✅ Yeh parameter add kar
                });
                console.log("Join request approved successfully:", response.data);
                return res.json({
                    success: true,
                    message: `User ${userId} added to channel ${channelId} by approving their join request`,
                    data: response.data
                });
            }
            catch (approveError) {
                console.error('Error with approveChatJoinRequest:', ((_h = approveError.response) === null || _h === void 0 ? void 0 : _h.data) || approveError.message);
                // METHOD 3: If both fail, create an invite link and approve it automatically
                try {
                    console.log("Creating special invite link for user...");
                    const inviteLinkResponse = yield axios_1.default.post(`https://api.telegram.org/bot${apiToken}/createChatInviteLink`, {
                        chat_id: formattedChannelId,
                        member_limit: 1,
                        name: `invite-for-${userId}`,
                        creates_join_request: false
                    });
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
                }
                catch (finalError) {
                    console.error('All methods failed:', ((_j = finalError.response) === null || _j === void 0 ? void 0 : _j.data) || finalError.message);
                    // Return detailed error information
                    return res.status(500).json({
                        error: 'All methods failed to add user to channel',
                        details: ((_l = (_k = finalError.response) === null || _k === void 0 ? void 0 : _k.data) === null || _l === void 0 ? void 0 : _l.description) || finalError.message,
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
    }
    catch (error) {
        console.error('Unexpected error in AddUserToChannel:', error);
        return res.status(500).json({
            error: 'Unexpected error occurred',
            details: error.message
        });
    }
});
TelegramController.RemoveUserFromChannel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k;
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
            const botInfoResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getMe`);
            const botId = botInfoResponse.data.result.id;
            console.log("Bot ID:", botId);
            // Check if bot is admin in the channel
            const chatMemberResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`);
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
        }
        catch (error) {
            console.error('Error checking bot admin status:', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.data.error_code) === 400) {
                return res.status(404).json({
                    error: 'Bot is not a member of the specified channel',
                    details: 'Please add the bot to the channel first and make it an administrator'
                });
            }
            return res.status(500).json({
                error: 'Failed to verify bot permissions',
                details: ((_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.description) || error.message
            });
        }
        // Check if user is actually a member of the channel
        try {
            const userStatusResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`);
            const userStatus = userStatusResponse.data.result.status;
            console.log("User status in channel:", userStatus);
            if (userStatus === 'left' || userStatus === 'kicked') {
                return res.status(400).json({
                    error: 'User is not a member of the channel',
                    details: `User status: ${userStatus}`
                });
            }
        }
        catch (statusError) {
            console.log("Error checking user status:", ((_f = statusError.response) === null || _f === void 0 ? void 0 : _f.data) || statusError.message);
            return res.status(400).json({
                error: 'User is not a member of the channel or invalid user ID'
            });
        }
        // METHOD 1: Try to ban the user (permanently remove)
        try {
            console.log("Trying to ban user...");
            const response = yield axios_1.default.post(`https://api.telegram.org/bot${apiToken}/banChatMember`, {
                chat_id: formattedChannelId,
                user_id: numericUserId,
                revoke_messages: false // Set true to delete all messages from user
            });
            console.log("User banned successfully:", response.data);
            return res.json({
                success: true,
                message: `User ${userId} successfully removed from channel ${channelId}`,
                data: response.data
            });
        }
        catch (banError) {
            console.error('Error with banChatMember:', ((_g = banError.response) === null || _g === void 0 ? void 0 : _g.data) || banError.message);
            // METHOD 2: If ban fails, try to kick the user (temporary remove)
            try {
                console.log("Trying to kick user...");
                const response = yield axios_1.default.post(`https://api.telegram.org/bot${apiToken}/banChatMember`, {
                    chat_id: formattedChannelId,
                    user_id: numericUserId,
                    until_date: Math.floor(Date.now() / 1000) + 30, // 30 seconds se ban
                    revoke_messages: false
                });
                console.log("User kicked successfully:", response.data);
                return res.json({
                    success: true,
                    message: `User ${userId} successfully kicked from channel ${channelId}`,
                    data: response.data
                });
            }
            catch (kickError) {
                console.error('Error with kick:', ((_h = kickError.response) === null || _h === void 0 ? void 0 : _h.data) || kickError.message);
                // Return detailed error information
                return res.status(500).json({
                    error: 'Failed to remove user from channel',
                    details: ((_k = (_j = kickError.response) === null || _j === void 0 ? void 0 : _j.data) === null || _k === void 0 ? void 0 : _k.description) || kickError.message,
                    possibleReasons: [
                        'Bot might not have sufficient permissions',
                        'User might be the channel owner',
                        'User might be an admin with higher privileges than bot'
                    ]
                });
            }
        }
    }
    catch (error) {
        console.error('Unexpected error in RemoveUserFromChannel:', error);
        return res.status(500).json({
            error: 'Unexpected error occurred',
            details: error.message
        });
    }
});
TelegramController.getBotInfo = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(baseUrl, "Saflkew");
        const response = yield axios_1.default.get(`${baseUrl}/getMe`);
        console.log(response.data, "Delkwnd");
        return response.data;
    }
    catch (error) {
        console.log("d;kmelw");
        throw new Error(`Failed to get bot info: ${error.message}`);
    }
});
/**
 * Add bot to a channel as an administrator
 */
TelegramController.addBotToChannel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { channelId } = req.body;
        // First, we need to get the bot's information
        const botInfo = yield _a.getBotInfo();
        console.log(botInfo, "Demw, ");
        console.log(botInfo === null || botInfo === void 0 ? void 0 : botInfo.result, "Dqrdelkemw, ");
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
    }
    catch (error) {
        throw new Error(`Failed to generate bot addition link: ${error.message}`);
    }
});
TelegramController.validateToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    console.log(req.body, "Dewlmk");
    const { apiToken } = req.body;
    console.log(apiToken, "Fewm,,");
    if (!apiToken) {
        return res.status(400).json({ error: 'API token is required' });
    }
    try {
        // Verify the token is valid by calling getMe
        const response = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getMe`);
        console.log((_b = response.data) === null || _b === void 0 ? void 0 : _b.result, "Dwkl");
        req.botInfo = response.data.result;
        // next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid API token' });
    }
});
// Step 1: Initiate login process
TelegramController.sendOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const existingUser = yield telegramUser_1.default.findOne({
            phoneNumber: cleanNumber,
            userName: userName,
        });
        if (existingUser &&
            existingUser.verified &&
            loadUserSession(cleanNumber)) {
            try {
                // Fetch user's created channels
                const channels = yield _a.fetchUserChannels(cleanNumber);
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
            }
            catch (error) {
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
        const stringSession = new sessions_1.StringSession("");
        const client = new telegram_1.TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
            connectionRetries: 5,
            useWSS: false,
            timeout: 10000,
        });
        yield client.connect();
        // Send code request
        const { phoneCodeHash } = yield client.sendCode({
            apiId: TELEGRAM_API_ID,
            apiHash: TELEGRAM_API_HASH,
        }, cleanNumber);
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
    }
    catch (error) {
        console.error("❌ Error initiating login:", error);
        if (error.message.includes("PHONE_NUMBER_INVALID")) {
            res.status(400).json({
                success: false,
                message: "Invalid phone number format.",
            });
        }
        else if (error.message.includes("PHONE_NUMBER_FLOOD")) {
            res.status(400).json({
                success: false,
                message: "Too many attempts. Please try again later.",
            });
        }
        else if (error.message.includes("PHONE_NUMBER_BANNED")) {
            res.status(400).json({
                success: false,
                message: "This phone number is banned from Telegram.",
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: "Failed to initiate login process: " + error.message,
            });
        }
    }
});
// Step 2: Verify OTP
TelegramController.verifyLoginOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
                message: "No active session found for this phone number. Please request a new OTP.",
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
            const result = yield authSession.client.invoke(new tl_1.Api.auth.SignIn({
                phoneNumber: cleanNumber,
                phoneCodeHash: authSession.phoneCodeHash,
                phoneCode: otp,
            }));
            console.log(result, "Sdlkwenkj");
            // Save the session
            const sessionString = authSession.client.session.save();
            saveUserSession(cleanNumber, sessionString);
            // DON'T destroy the client immediately - this prevents notifications
            // Instead, just remove from authSessions and let it remain connected
            authSessions.delete(cleanNumber);
            // Save or update user
            let telegramUser = yield telegramUser_1.default.findOne({
                phoneNumber: cleanNumber,
                userName: userName,
            });
            if (!telegramUser) {
                telegramUser = new telegramUser_1.default({
                    phoneNumber: cleanNumber,
                    userName: userName,
                    verified: true,
                    verifiedAt: new Date(),
                });
            }
            else {
                telegramUser.verified = true;
                telegramUser.verifiedAt = new Date();
            }
            yield telegramUser.save();
            // Fetch user channels
            const channels = yield _a.fetchUserChannels(cleanNumber);
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
        }
        catch (error) {
            console.error("❌ Error during sign-in:", error);
            // Clean up failed session
            authSession.client.destroy();
            authSessions.delete(cleanNumber);
            if (error.message.includes("PHONE_CODE_INVALID")) {
                res.status(400).json({
                    success: false,
                    message: "Invalid OTP code.",
                });
            }
            else if (error.message.includes("PHONE_CODE_EXPIRED")) {
                res.status(400).json({
                    success: false,
                    message: "OTP code has expired. Please request a new one.",
                });
            }
            else if (error.message.includes("SESSION_PASSWORD_NEEDED")) {
                res.status(400).json({
                    success: false,
                    message: "Two-factor authentication is enabled. Please provide your password.",
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: "Failed to verify OTP: " + error.message,
                });
            }
        }
    }
    catch (error) {
        console.error("❌ Unexpected error in verifyLoginOtp:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error during OTP verification.",
        });
    }
});
// Fetch user channels
// Optimized fetchUserChannels function
TelegramController.fetchUserChannels = (phoneNumber) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionString = loadUserSession(phoneNumber);
        if (!sessionString) {
            throw new Error("No session found for user");
        }
        const stringSession = new sessions_1.StringSession(sessionString);
        const client = new telegram_1.TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
            connectionRetries: 2, // Reduced from 3
            timeout: 8000, // Reduced from 15000
        });
        yield client.connect();
        // Get current user info once
        const me = yield client.getMe();
        const myId = me.id;
        const result = yield client.invoke(new tl_1.Api.messages.GetDialogs({
            offsetDate: 0,
            offsetId: 0,
            offsetPeer: new tl_1.Api.InputPeerEmpty(),
            limit: 200, // Reduced from 500 for faster response
            hash: (0, big_integer_1.default)(0),
        }));
        const channels = [];
        const channelPromises = [];
        // Pre-filter to only process channels (not groups/chats)
        const relevantChats = result.chats.filter((chat) => {
            return (chat.className === "Channel" &&
                !chat.left && // Skip left chats
                !chat.deactivated); // Skip deactivated chats
        });
        // Process chats in parallel with concurrency limit
        const CONCURRENCY_LIMIT = 5;
        const semaphore = new Array(CONCURRENCY_LIMIT).fill(Promise.resolve());
        for (const chat of relevantChats) {
            const promise = semaphore.shift().then(() => __awaiter(void 0, void 0, void 0, function* () {
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
                        }
                        else {
                            // Only do detailed check if basic info suggests user might be creator/admin
                            try {
                                const participant = (yield Promise.race([
                                    client.invoke(new tl_1.Api.channels.GetParticipant({
                                        channel: chat.id,
                                        participant: myId,
                                    })),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000)),
                                ]));
                                if (participant) {
                                    isCreator =
                                        participant.participant.className ===
                                            "ChannelParticipantCreator";
                                    isAdmin =
                                        isCreator ||
                                            participant.participant.className ===
                                                "ChannelParticipantAdmin";
                                }
                            }
                            catch (err) {
                                // Skip if can't determine status quickly
                                return;
                            }
                        }
                        // Only get detailed info for creator channels
                        if (isCreator) {
                            try {
                                const fullChannel = (yield Promise.race([
                                    client.invoke(new tl_1.Api.channels.GetFullChannel({ channel: chat.id })),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000)),
                                ]));
                                memberCount = fullChannel.fullChat.participantsCount || 0;
                                // Get invite link only if needed
                                if (isAdmin) {
                                    try {
                                        const exportedInvite = (yield Promise.race([
                                            client.invoke(new tl_1.Api.messages.ExportChatInvite({
                                                peer: chat.id,
                                                legacyRevokePermanent: false,
                                            })),
                                            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500)),
                                        ]));
                                        inviteLink = exportedInvite.link;
                                    }
                                    catch (inviteError) {
                                        // Silent fail for invite link
                                    }
                                }
                            }
                            catch (err) {
                                // Use fallback data if full channel info fails
                                memberCount = chat.participantsCount || 0;
                            }
                        }
                    }
                    // Only add channels/groups where the user is the creator
                    if (isCreator) {
                        channels.push({
                            id: chat.id.toString(),
                            title: chat.title,
                            type: chat.className === "Channel"
                                ? chat.broadcast
                                    ? "channel"
                                    : "supergroup"
                                : "group",
                            username: chat.username || null,
                            memberCount: memberCount,
                            isAdmin: isAdmin,
                            isCreator: isCreator,
                            isVerified: chat.verified || false,
                            isScam: chat.scam || false,
                            isFake: chat.fake || false,
                            date: chat.date,
                            description: null,
                            inviteLink: inviteLink,
                        });
                    }
                }
                catch (err) {
                    console.log(`Skipped chat due to error: ${chat.title}`);
                }
            }));
            channelPromises.push(promise);
            semaphore.push(promise);
        }
        // Wait for all promises with overall timeout
        yield Promise.race([
            Promise.allSettled(channelPromises),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Overall timeout")), 5000)),
        ]);
        yield client.disconnect();
        // Sort by member count (descending)
        return channels.sort((a, b) => b.memberCount - a.memberCount);
    }
    catch (error) {
        console.error("❌ Error fetching channels:", error);
        throw error;
    }
});
// Get user channels endpoint
TelegramController.getUserChannels = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const channels = yield _a.fetchUserChannels(cleanNumber);
        res.json({
            success: true,
            channels: channels,
            totalChannels: channels.length,
        });
    }
    catch (error) {
        console.error("❌ Error fetching user channels:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch channels: " + error.message,
        });
    }
});
TelegramController.createChannel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phoneNumber, channelName, channelDescription, isPublic } = req.body;
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
        const stringSession = new sessions_1.StringSession(sessionString);
        const client = new telegram_1.TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
            connectionRetries: 3,
            timeout: 15000,
        });
        yield client.connect();
        try {
            // Create the channel
            const result = yield client.invoke(new tl_1.Api.channels.CreateChannel({
                title: channelName,
                about: channelDescription || "",
                megagroup: false,
                broadcast: true,
                forImport: false,
            }));
            const channel = result.chats[0];
            // If it's a public channel, try to set a username
            if (isPublic && channel) {
                try {
                    // Generate a simple username from channel name
                    const username = channelName
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "_")
                        .substring(0, 20) +
                        "_" +
                        Math.random().toString(36).substring(2, 7);
                    yield client.invoke(new tl_1.Api.channels.UpdateUsername({
                        channel: channel.id,
                        username: username,
                    }));
                }
                catch (usernameError) {
                    console.warn("Could not set username for channel:", usernameError);
                    // Continue without username - channel will be private
                }
            }
            // Update channel description if provided - FIXED THE ERROR HERE
            if (channelDescription) {
                try {
                    // Use the correct API method for setting channel description
                    yield client.invoke(new tl_1.Api.messages.EditChatAbout({
                        peer: channel.id,
                        about: channelDescription,
                    }));
                }
                catch (descriptionError) {
                    console.warn("Could not set channel description:", descriptionError);
                    // Alternative approach for some channel types
                    try {
                        yield client.invoke(new tl_1.Api.channels.EditTitle({
                            channel: channel.id,
                            title: channelName,
                        }));
                    }
                    catch (titleError) {
                        console.warn("Could not update channel title either:", titleError);
                    }
                }
            }
            // Get the invite link for the new channel
            let inviteLink = null;
            try {
                const exportedInvite = (yield client.invoke(new tl_1.Api.messages.ExportChatInvite({
                    peer: channel.id,
                    legacyRevokePermanent: false,
                })));
                inviteLink = exportedInvite.link;
            }
            catch (inviteError) {
                console.warn("Could not get invite link:", inviteError);
            }
            yield client.disconnect();
            // Return the created channel info
            res.json({
                success: true,
                message: "Channel created successfully",
                channel: {
                    id: channel.id.toString(),
                    title: channelName,
                    type: "channel",
                    username: channel.username || null,
                    inviteLink: inviteLink,
                    isPublic: isPublic || false,
                },
            });
        }
        catch (error) {
            // Ensure client is properly disconnected even on errors
            try {
                yield client.disconnect();
            }
            catch (disconnectError) {
                console.warn("Error disconnecting client:", disconnectError);
            }
            console.error("❌ Error creating channel:", error);
            // More specific error handling
            if (error.errorMessage) {
                switch (error.errorMessage) {
                    case "CHANNELS_TOO_MUCH":
                        res.status(400).json({
                            success: false,
                            message: "You have created too many channels. Please wait before creating more.",
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
            }
            else {
                res.status(500).json({
                    success: false,
                    message: "Failed to create channel: Unknown error occurred",
                });
            }
        }
    }
    catch (error) {
        console.error("❌ Unexpected error in createChannel:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error during channel creation.",
        });
    }
});
TelegramController.createTelegramPage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const requestPayload = req.body;
    try {
        const newTelegramPage = yield telegramPage_1.default.create(requestPayload);
        res.json({
            success: true,
            result: newTelegramPage,
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            message: err,
        });
    }
});
TelegramController.imageUpload = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        // console.log(fileStr,"ASd;lwek")
        const uploadResult = yield cloudinary_1.v2.uploader.upload(fileStr, {
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
        const telegramImage = yield telegramPage_1.default.findOneAndUpdate({ _id: req.body.telegramId }, { $set: { imageUrl: uploadResult === null || uploadResult === void 0 ? void 0 : uploadResult.secure_url } }, { new: true });
        console.log(telegramImage, "dewkl");
        return res.status(200).json({
            message: "File uploaded successfully",
            url: uploadResult.secure_url,
        });
    }
    catch (err) {
        console.error("Upload error:", err);
        return res.status(500).json({ error: err.message });
    }
});
TelegramController.countAllTelegramPagesByUserName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j;
    const userName = req.query.userName;
    const query = {};
    if (userName !== "ADMIN") {
        query.userName = userName;
    }
    const counts = yield telegramPage_1.default.aggregate([
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
        total: ((_c = (_b = counts[0]) === null || _b === void 0 ? void 0 : _b.total[0]) === null || _c === void 0 ? void 0 : _c.count) || 0,
        active: ((_e = (_d = counts[0]) === null || _d === void 0 ? void 0 : _d.active[0]) === null || _e === void 0 ? void 0 : _e.count) || 0,
        inActive: ((_g = (_f = counts[0]) === null || _f === void 0 ? void 0 : _f.inactive[0]) === null || _g === void 0 ? void 0 : _g.count) || 0,
        rejected: ((_j = (_h = counts[0]) === null || _h === void 0 ? void 0 : _h.rejected[0]) === null || _j === void 0 ? void 0 : _j.count) || 0,
    };
    return res.send(result);
});
TelegramController.getAllTelegramPagesPaginated = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = req.body;
    const query = {
        status: payload.status,
    };
    if (payload.userName !== "ADMIN") {
        query.userName = payload.userName;
    }
    const pageNo = payload === null || payload === void 0 ? void 0 : payload.pageNo;
    const pageSize = payload === null || payload === void 0 ? void 0 : payload.pageSize;
    const result = yield telegramPage_1.default.find(query)
        .sort({ createdAt: -1 }) // Sort in descending order
        .skip(pageNo * pageSize)
        .limit(pageSize);
    return res.send(result);
});
TelegramController.getTelegramPageDetailsById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = req.query.telegramId;
    const result = yield telegramPage_1.default.findOne({ _id: payload });
    return res.send(result);
});
// Logout endpoint
TelegramController.logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const sessionFile = path_1.default.join(sessionsDir, `${cleanNumber.replace(/[^0-9+]/g, "")}.session`);
        if (fs_1.default.existsSync(sessionFile)) {
            fs_1.default.unlinkSync(sessionFile);
        }
        // Remove from memory
        userSessions.delete(cleanNumber);
        authSessions.delete(cleanNumber);
        // Update user record
        yield telegramUser_1.default.findOneAndUpdate({ phoneNumber: cleanNumber, userName: userName }, { verified: false, verifiedAt: null });
        res.json({
            success: true,
            message: "Logged out successfully",
        });
    }
    catch (error) {
        console.error("❌ Error during logout:", error);
        res.status(500).json({
            success: false,
            message: "Failed to logout: " + error.message,
        });
    }
});
// Check session status
TelegramController.checkSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const user = yield telegramUser_1.default.findOne({
            phoneNumber: cleanNumber,
            userName: userName,
        });
        res.json({
            success: true,
            hasSession,
            hasAuthSession,
            verified: (user === null || user === void 0 ? void 0 : user.verified) || false,
            verifiedAt: user === null || user === void 0 ? void 0 : user.verifiedAt,
        });
    }
    catch (error) {
        console.error("❌ Error checking session:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check session status",
        });
    }
});
exports.default = TelegramController;
//# sourceMappingURL=telegramController.js.map