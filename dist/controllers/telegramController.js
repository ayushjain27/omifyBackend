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
// const TELEGRAM_API_ID = 23351709;
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
// Session management functions
function saveUserSession(phoneNumber, sessionString) {
    const sessionFile = path_1.default.join(sessionsDir, `${phoneNumber.replace(/[^0-9+]/g, '')}.session`);
    fs_1.default.writeFileSync(sessionFile, sessionString);
    userSessions.set(phoneNumber, sessionString);
}
function loadUserSession(phoneNumber) {
    const sessionFile = path_1.default.join(sessionsDir, `${phoneNumber.replace(/[^0-9+]/g, '')}.session`);
    if (fs_1.default.existsSync(sessionFile)) {
        const sessionString = fs_1.default.readFileSync(sessionFile, 'utf8');
        userSessions.set(phoneNumber, sessionString);
        return sessionString;
    }
    return '';
}
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
        let cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
        if (!cleanNumber.startsWith('+')) {
            if (cleanNumber.length === 10) {
                cleanNumber = `+91${cleanNumber}`;
            }
            else {
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
        else {
            res.status(500).json({
                success: false,
                message: 'Failed to initiate login process'
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
        const result = yield authSession.client.invoke(new tl_1.Api.auth.SignIn({
            phoneNumber: cleanNumber,
            phoneCodeHash: authSession.phoneCodeHash,
            phoneCode: otp,
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
        // const channels = await TelegramController.fetchUserChannels(cleanNumber);
        res.json({
            success: true,
            message: 'Login successful!',
            verified: true,
            authenticated: true,
            // channels: channels,
            // totalChannels: channels.length,
            user: {
                phoneNumber: cleanNumber,
                verifiedAt: telegramUser.verifiedAt
            }
        });
    }
    catch (error) {
        console.error('❌ Error verifying OTP:', error);
        if (error.message.includes('PHONE_CODE_INVALID')) {
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
                message: 'Failed to verify OTP.'
            });
        }
    }
});
// Fetch user channels (same as before)
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
exports.default = TelegramController;
//# sourceMappingURL=telegramController.js.map