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
const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || '23351709');
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || '0c736ebb3f791b108a9539f83b8ff73e';
// Storage for authentication sessions
const authSessions = new Map();
const userSessions = new Map();
// Ensure directories exist
const sessionsDir = path_1.default.join(process.cwd(), 'telegram-sessions');
if (!fs_1.default.existsSync(sessionsDir)) {
    fs_1.default.mkdirSync(sessionsDir, { recursive: true });
}
// Helper function to normalize phone number format
function normalizePhoneNumber(phoneNumber) {
    let cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    if (!cleanNumber.startsWith('+')) {
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
    const sessionFile = path_1.default.join(sessionsDir, `${normalizedNumber.replace(/[^0-9+]/g, '')}.session`);
    fs_1.default.writeFileSync(sessionFile, sessionString);
    userSessions.set(normalizedNumber, sessionString);
}
function loadUserSession(phoneNumber) {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    const sessionFile = path_1.default.join(sessionsDir, `${normalizedNumber.replace(/[^0-9+]/g, '')}.session`);
    if (fs_1.default.existsSync(sessionFile)) {
        const sessionString = fs_1.default.readFileSync(sessionFile, 'utf8');
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
            }
            catch (error) {
                console.error('Error destroying client:', error);
            }
            authSessions.delete(phoneNumber);
        }
    }
}, 60 * 1000); // Check every minute
class TelegramController {
}
_a = TelegramController;
// Step 1: Initiate login process
TelegramController.sendOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const existingUser = yield telegramUser_1.default.findOne({ phoneNumber: cleanNumber });
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
        const stringSession = new sessions_1.StringSession('');
        const client = new telegram_1.TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
            connectionRetries: 5,
            useWSS: false,
            timeout: 10000
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
    }
    catch (error) {
        console.error('❌ Error initiating login:', error);
        if (error.message.includes('PHONE_NUMBER_INVALID')) {
            res.status(400).json({
                success: false,
                message: 'Invalid phone number format.'
            });
        }
        else if (error.message.includes('PHONE_NUMBER_FLOOD')) {
            res.status(400).json({
                success: false,
                message: 'Too many attempts. Please try again later.'
            });
        }
        else if (error.message.includes('PHONE_NUMBER_BANNED')) {
            res.status(400).json({
                success: false,
                message: 'This phone number is banned from Telegram.'
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: 'Failed to initiate login process: ' + error.message
            });
        }
    }
});
// Step 2: Verify OTP
TelegramController.verifyLoginOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            yield authSession.client.invoke(new tl_1.Api.auth.SignIn({
                phoneNumber: cleanNumber,
                phoneCode: otp,
                phoneCodeHash: authSession.phoneCodeHash,
            }));
            // Save the session
            const sessionString = authSession.client.session.save();
            saveUserSession(cleanNumber, sessionString);
            // Clean up
            authSession.client.destroy();
            authSessions.delete(cleanNumber);
            // Save or update user
            let telegramUser = yield telegramUser_1.default.findOne({ phoneNumber: cleanNumber });
            if (!telegramUser) {
                telegramUser = new telegramUser_1.default({
                    phoneNumber: cleanNumber,
                    verified: true,
                    verifiedAt: new Date()
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
        }
        catch (error) {
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
            }
            else if (error.message.includes('PHONE_CODE_INVALID')) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid OTP code.'
                });
            }
            else if (error.message.includes('PHONE_CODE_EXPIRED')) {
                res.status(400).json({
                    success: false,
                    message: 'OTP code has expired. Please request a new one.'
                });
            }
            else {
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
    }
    catch (error) {
        console.error('❌ Unexpected error in verifyLoginOtp:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during OTP verification.'
        });
    }
});
// Step 3: Verify 2FA Password
TelegramController.verify2FAPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            yield authSession.client.signInWithPassword({
                apiId: TELEGRAM_API_ID,
                apiHash: TELEGRAM_API_HASH,
            }, {
                password: (hint) => __awaiter(void 0, void 0, void 0, function* () { return password; }),
                onError: (error) => __awaiter(void 0, void 0, void 0, function* () {
                    console.error('2FA password error:', error);
                    throw error;
                })
            });
            // Save the session
            const sessionString = authSession.client.session.save();
            saveUserSession(cleanNumber, sessionString);
            // Clean up
            authSession.client.destroy();
            authSessions.delete(cleanNumber);
            // Save or update user
            let telegramUser = yield telegramUser_1.default.findOne({ phoneNumber: cleanNumber });
            if (!telegramUser) {
                telegramUser = new telegramUser_1.default({
                    phoneNumber: cleanNumber,
                    verified: true,
                    verifiedAt: new Date()
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
        }
        catch (error) {
            console.error('❌ Error during 2FA password verification:', error);
            // Clean up failed session
            authSession.client.destroy();
            authSessions.delete(cleanNumber);
            if (error.message.includes('PASSWORD_HASH_INVALID')) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid password. Please try again.'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to verify password: ' + error.message
                });
            }
        }
    }
    catch (error) {
        console.error('❌ Unexpected error in verify2FAPassword:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during password verification.'
        });
    }
});
// Fetch user channels
TelegramController.fetchUserChannels = (phoneNumber) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionString = loadUserSession(phoneNumber);
        if (!sessionString) {
            throw new Error('No session found for user');
        }
        const stringSession = new sessions_1.StringSession(sessionString);
        const client = new telegram_1.TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
            connectionRetries: 3,
            timeout: 15000
        });
        yield client.connect();
        const result = yield client.invoke(new tl_1.Api.messages.GetDialogs({
            offsetDate: 0,
            offsetId: 0,
            offsetPeer: new tl_1.Api.InputPeerEmpty(),
            limit: 500,
            hash: (0, big_integer_1.default)(0)
        }));
        const channels = [];
        for (const chat of result.chats) {
            if (chat.className === 'Channel' || chat.className === 'Chat') {
                let memberCount = 0;
                let isAdmin = false;
                let isCreator = false;
                let inviteLink = null;
                try {
                    if (chat.className === 'Channel') {
                        const fullChannel = yield client.invoke(new tl_1.Api.channels.GetFullChannel({
                            channel: chat.id
                        }));
                        memberCount = fullChannel.fullChat.participantsCount || 0;
                        // Check admin status
                        const participant = yield client.invoke(new tl_1.Api.channels.GetParticipant({
                            channel: chat.id,
                            participant: 'me'
                        })).catch(() => null);
                        if (participant) {
                            isCreator = participant.participant.className === 'ChannelParticipantCreator';
                            isAdmin = isCreator || participant.participant.className === 'ChannelParticipantAdmin';
                        }
                        // Get invite link if admin/creator
                        if (isAdmin) {
                            try {
                                const exportedInvite = yield client.invoke(new tl_1.Api.messages.ExportChatInvite({
                                    peer: chat.id,
                                    legacyRevokePermanent: false
                                }));
                                inviteLink = exportedInvite.link;
                            }
                            catch (inviteError) {
                                // Silent fail for invite link
                            }
                        }
                    }
                    else {
                        memberCount = chat.participantsCount || 0;
                    }
                }
                catch (err) {
                    console.log(`Could not get full info for: ${chat.title}`);
                }
                channels.push({
                    id: chat.id.toString(),
                    title: chat.title,
                    type: chat.className === 'Channel' ? (chat.broadcast ? 'channel' : 'supergroup') : 'group',
                    username: chat.username || null,
                    memberCount: memberCount,
                    isAdmin: isAdmin,
                    isCreator: isCreator,
                    isVerified: chat.verified || false,
                    isScam: chat.scam || false,
                    isFake: chat.fake || false,
                    date: chat.date,
                    description: null,
                    inviteLink: inviteLink
                });
            }
        }
        yield client.disconnect();
        // Sort by: Creator first, then admin, then by member count
        return channels.sort((a, b) => {
            if (a.isCreator !== b.isCreator)
                return a.isCreator ? -1 : 1;
            if (a.isAdmin !== b.isAdmin)
                return a.isAdmin ? -1 : 1;
            return b.memberCount - a.memberCount;
        });
    }
    catch (error) {
        console.error('❌ Error fetching channels:', error);
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
        const channels = yield _a.fetchUserChannels(cleanNumber);
        res.json({
            success: true,
            channels: channels,
            totalChannels: channels.length
        });
    }
    catch (error) {
        console.error('❌ Error fetching user channels:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch channels: ' + error.message
        });
    }
});
// Logout endpoint
TelegramController.logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const sessionFile = path_1.default.join(sessionsDir, `${cleanNumber.replace(/[^0-9+]/g, '')}.session`);
        if (fs_1.default.existsSync(sessionFile)) {
            fs_1.default.unlinkSync(sessionFile);
        }
        // Remove from memory
        userSessions.delete(cleanNumber);
        authSessions.delete(cleanNumber);
        // Update user record
        yield telegramUser_1.default.findOneAndUpdate({ phoneNumber: cleanNumber }, { verified: false, verifiedAt: null });
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('❌ Error during logout:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to logout: ' + error.message
        });
    }
});
// Check session status
TelegramController.checkSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const user = yield telegramUser_1.default.findOne({ phoneNumber: cleanNumber });
        res.json({
            success: true,
            hasSession,
            hasAuthSession,
            verified: (user === null || user === void 0 ? void 0 : user.verified) || false,
            verifiedAt: user === null || user === void 0 ? void 0 : user.verifiedAt
        });
    }
    catch (error) {
        console.error('❌ Error checking session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check session status'
        });
    }
});
exports.default = TelegramController;
//# sourceMappingURL=telegramController.js.map