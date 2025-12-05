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
const telegramNewUser_1 = __importDefault(require("../models/telegramNewUser"));
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
const sessionsDir = '/tmp';
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
    try {
        // Store in memory
        userSessions.set(normalizedNumber, sessionString);
        // Write to /tmp without creating subdirectories
        const sessionFile = `/tmp/tg_session_${normalizedNumber.replace(/[^0-9+]/g, "")}.dat`;
        fs_1.default.writeFileSync(sessionFile, sessionString);
        console.log("Session saved to:", sessionFile);
    }
    catch (error) {
        console.warn("Could not save session to filesystem, using memory only:", error.message);
        // Still store in memory even if file write fails
        userSessions.set(normalizedNumber, sessionString);
    }
}
function loadUserSession(phoneNumber) {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    // Check memory first
    if (userSessions.has(normalizedNumber)) {
        return userSessions.get(normalizedNumber);
    }
    // Try to load from /tmp
    try {
        const sessionFile = `/tmp/tg_session_${normalizedNumber.replace(/[^0-9+]/g, "")}.dat`;
        if (fs_1.default.existsSync(sessionFile)) {
            const sessionString = fs_1.default.readFileSync(sessionFile, "utf8");
            userSessions.set(normalizedNumber, sessionString);
            return sessionString;
        }
    }
    catch (error) {
        // File doesn't exist or can't be read
        console.warn("Could not load session from filesystem:", error.message);
    }
    return "";
}
function validateSession(client) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Try to get our own user info to validate the session
            yield client.getMe();
            return true;
        }
        catch (error) {
            console.error("Session validation failed:", error);
            return false;
        }
    });
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
// static getChannelMemberCount = async (req: any, res: any) => {
//   try {
//     const { channelId, apiToken } = req.body;
//     if (!channelId || !apiToken) {
//       return res.status(400).json({
//         error: 'Channel ID and API Token are required'
//       });
//     }
//     // Format channel ID correctly
//     let formattedChannelId = channelId;
//     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
//       formattedChannelId = `-100${channelId}`;
//     }
//     try {
//       const response = await axios.get(
//         `https://api.telegram.org/bot${apiToken}/getChatMemberCount?chat_id=${formattedChannelId}`
//       );
//       return res.json({
//         success: true,
//         channelId: formattedChannelId,
//         memberCount: response.data.result,
//         message: `Channel has ${response.data.result} members`
//       });
//     } catch (error) {
//       console.error('Error getting member count:', error.response?.data || error.message);
//       return res.status(500).json({
//         error: 'Failed to get member count',
//         details: error.response?.data?.description || error.message
//       });
//     }
//   } catch (error) {
//     console.error('Unexpected error:', error);
//     return res.status(500).json({
//       error: 'Unexpected error occurred',
//       details: error.message
//     });
//   }
// };
// /**
//  * Get channel information including member count
//  */
// static getChannelInfo = async (req: any, res: any) => {
//   try {
//     const { channelId, apiToken } = req.body;
//     if (!channelId || !apiToken) {
//       return res.status(400).json({
//         error: 'Channel ID and API Token are required'
//       });
//     }
//     // Format channel ID correctly
//     let formattedChannelId = channelId;
//     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
//       formattedChannelId = `-100${channelId}`;
//     }
//     try {
//       // Get basic chat info
//       const chatResponse = await axios.get(
//         `https://api.telegram.org/bot${apiToken}/getChat?chat_id=${formattedChannelId}`
//       );
//       // Get member count
//       const memberCountResponse = await axios.get(
//         `https://api.telegram.org/bot${apiToken}/getChatMemberCount?chat_id=${formattedChannelId}`
//       );
//       const chatInfo = chatResponse.data.result;
//       const memberCount = memberCountResponse.data.result;
//       return res.json({
//         success: true,
//         channelInfo: {
//           id: chatInfo.id,
//           title: chatInfo.title,
//           username: chatInfo.username || null,
//           description: chatInfo.description || null,
//           type: chatInfo.type,
//           memberCount: memberCount,
//           inviteLink: chatInfo.invite_link || null,
//           pinnedMessage: chatInfo.pinned_message || null,
//           permissions: chatInfo.permissions || null
//         }
//       });
//     } catch (error) {
//       console.error('Error getting channel info:', error.response?.data || error.message);
//       return res.status(500).json({
//         error: 'Failed to get channel info',
//         details: error.response?.data?.description || error.message
//       });
//     }
//   } catch (error) {
//     console.error('Unexpected error:', error);
//     return res.status(500).json({
//       error: 'Unexpected error occurred',
//       details: error.message
//     });
//   }
// };
// /**
//  * Get channel administrators list
//  * Note: This only works if your bot has admin privileges
//  */
// static getChannelAdministrators = async (req: any, res: any) => {
//   try {
//     const { channelId, apiToken } = req.body;
//     if (!channelId || !apiToken) {
//       return res.status(400).json({
//         error: 'Channel ID and API Token are required'
//       });
//     }
//     // Format channel ID correctly
//     let formattedChannelId = channelId;
//     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
//       formattedChannelId = `-100${channelId}`;
//     }
//     try {
//       const response = await axios.get(
//         `https://api.telegram.org/bot${apiToken}/getChatAdministrators?chat_id=${formattedChannelId}`
//       );
//       const administrators = response.data.result.map((admin: any) => ({
//         userId: admin.user.id,
//         firstName: admin.user.first_name,
//         lastName: admin.user.last_name || null,
//         username: admin.user.username || null,
//         status: admin.status,
//         isBot: admin.user.is_bot,
//         canBeEdited: admin.can_be_edited || false,
//         canManageChat: admin.can_manage_chat || false,
//         canDeleteMessages: admin.can_delete_messages || false,
//         canManageVideoChats: admin.can_manage_video_chats || false,
//         canRestrictMembers: admin.can_restrict_members || false,
//         canPromoteMembers: admin.can_promote_members || false,
//         canChangeInfo: admin.can_change_info || false,
//         canInviteUsers: admin.can_invite_users || false,
//         canPostMessages: admin.can_post_messages || false,
//         canEditMessages: admin.can_edit_messages || false,
//         canPinMessages: admin.can_pin_messages || false,
//         customTitle: admin.custom_title || null
//       }));
//       return res.json({
//         success: true,
//         channelId: formattedChannelId,
//         administratorCount: administrators.length,
//         administrators: administrators
//       });
//     } catch (error) {
//       console.error('Error getting administrators:', error.response?.data || error.message);
//       return res.status(500).json({
//         error: 'Failed to get administrators',
//         details: error.response?.data?.description || error.message,
//         note: 'Bot must be an administrator to access this information'
//       });
//     }
//   } catch (error) {
//     console.error('Unexpected error:', error);
//     return res.status(500).json({
//       error: 'Unexpected error occurred',
//       details: error.message
//     });
//   }
// };
// /**
//  * Check if a specific user is a member of the channel
//  */
// static checkUserMembership = async (req: any, res: any) => {
//   try {
//     const { channelId, userId, apiToken } = req.body;
//     if (!channelId || !userId || !apiToken) {
//       return res.status(400).json({
//         error: 'Channel ID, User ID, and API Token are required'
//       });
//     }
//     // Format channel ID correctly
//     let formattedChannelId = channelId;
//     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
//       formattedChannelId = `-100${channelId}`;
//     }
//     // Convert user ID to number
//     const numericUserId = parseInt(userId, 10);
//     if (isNaN(numericUserId)) {
//       return res.status(400).json({
//         error: 'Invalid User ID format'
//       });
//     }
//     try {
//       const response = await axios.get(
//         `https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`
//       );
//       const memberInfo = response.data.result;
//       const isMember = memberInfo.status !== 'left' && memberInfo.status !== 'kicked';
//       return res.json({
//         success: true,
//         channelId: formattedChannelId,
//         userId: numericUserId,
//         isMember: isMember,
//         memberInfo: {
//           userId: memberInfo.user.id,
//           firstName: memberInfo.user.first_name,
//           lastName: memberInfo.user.last_name || null,
//           username: memberInfo.user.username || null,
//           status: memberInfo.status,
//           isBot: memberInfo.user.is_bot,
//           joinedDate: memberInfo.until_date || null
//         }
//       });
//     } catch (error) {
//       console.error('Error checking membership:', error.response?.data || error.message);
//       if (error.response?.data.error_code === 400) {
//         return res.status(404).json({
//           success: true,
//           channelId: formattedChannelId,
//           userId: numericUserId,
//           isMember: false,
//           message: 'User is not a member of this channel'
//         });
//       }
//       return res.status(500).json({
//         error: 'Failed to check membership',
//         details: error.response?.data?.description || error.message
//       });
//     }
//   } catch (error) {
//     console.error('Unexpected error:', error);
//     return res.status(500).json({
//       error: 'Unexpected error occurred',
//       details: error.message
//     });
//   }
// };
// /**
//  * Get recent channel members (limited functionality)
//  * Note: This is very limited due to Telegram Bot API restrictions
//  * You can only get admin list, not all members list
//  */
// static getChannelMembersLimited = async (req: any, res: any) => {
//   try {
//     const { channelId, apiToken } = req.body;
//     if (!channelId || !apiToken) {
//       return res.status(400).json({
//         error: 'Channel ID and API Token are required'
//       });
//     }
//     // Format channel ID correctly
//     let formattedChannelId = channelId;
//     if (!channelId.startsWith('-100') && parseInt(channelId) > 0) {
//       formattedChannelId = `-100${channelId}`;
//     }
//     try {
//       // Get basic channel info
//       const channelInfoResponse = await axios.get(
//         `https://api.telegram.org/bot${apiToken}/getChat?chat_id=${formattedChannelId}`
//       );
//       // Get member count
//       const memberCountResponse = await axios.get(
//         `https://api.telegram.org/bot${apiToken}/getChatMemberCount?chat_id=${formattedChannelId}`
//       );
//       // Get administrators (this is the only member list we can get via Bot API)
//       const adminsResponse = await axios.get(
//         `https://api.telegram.org/bot${apiToken}/getChatAdministrators?chat_id=${formattedChannelId}`
//       );
//       const channelInfo = channelInfoResponse.data.result;
//       const memberCount = memberCountResponse.data.result;
//       const administrators = adminsResponse.data.result;
//       return res.json({
//         success: true,
//         limitation: 'Bot API can only fetch administrators list, not all members',
//         channelInfo: {
//           id: channelInfo.id,
//           title: channelInfo.title,
//           username: channelInfo.username || null,
//           description: channelInfo.description || null,
//           memberCount: memberCount
//         },
//         administrators: administrators.map((admin: any) => ({
//           userId: admin.user.id,
//           firstName: admin.user.first_name,
//           lastName: admin.user.last_name || null,
//           username: admin.user.username || null,
//           status: admin.status,
//           isBot: admin.user.is_bot
//         })),
//         totalMembers: memberCount,
//         accessibleMembers: administrators.length,
//         note: 'To get all member details, you need to use Telegram Client API (not Bot API) or have special permissions'
//       });
//     } catch (error) {
//       console.error('Error getting limited member info:', error.response?.data || error.message);
//       return res.status(500).json({
//         error: 'Failed to get member information',
//         details: error.response?.data?.description || error.message
//       });
//     }
//   } catch (error) {
//     console.error('Unexpected error:', error);
//     return res.status(500).json({
//       error: 'Unexpected error occurred',
//       details: error.message
//     });
//   }
// };
// Add this new method to your TelegramController class
/**
 * Get all channel members using Telegram Client API
 * This requires user login session (not bot token)
 */
// static getAllChannelMembers = async (req: any, res: any) => {
//   try {
//     const { channelId, phoneNumber } = req.body;
//     if (!channelId || !phoneNumber) {
//       return res.status(400).json({
//         error: "Channel ID and Phone Number are required",
//       });
//     }
//     const cleanNumber = normalizePhoneNumber(phoneNumber);
//     // Check if user has an active session
//     const sessionString = loadUserSession(cleanNumber);
//     if (!sessionString) {
//       return res.status(401).json({
//         success: false,
//         message: "No active session found. Please login first.",
//       });
//     }
//     // Create Telegram client
//     const stringSession = new StringSession(sessionString);
//     const client = new TelegramClient(
//       stringSession,
//       TELEGRAM_API_ID,
//       TELEGRAM_API_HASH,
//       {
//         connectionRetries: 3,
//         timeout: 15000,
//       }
//     );
//     await client.connect();
//     try {
//       // Convert channel ID to proper format
//       let formattedChannelId = channelId;
//       if (typeof channelId === "string" && channelId.startsWith("-100")) {
//         formattedChannelId = bigInt(channelId.replace("-100", ""));
//       } else if (
//         typeof channelId === "number" ||
//         !isNaN(parseInt(channelId))
//       ) {
//         formattedChannelId = bigInt(channelId);
//       }
//       // Get channel entity
//       const channel = await client.getEntity(formattedChannelId);
//       console.log("Channel found:", channel);
//       // Get all participants (members)
//       const participants = await client.getParticipants(channel, {
//         limit: 10000, // Maximum limit
//       });
//       // Format member data
//       const members = participants.map((participant: any) => {
//         const user = participant;
//         return {
//           userId: user.id?.toString() || null,
//           firstName: user.firstName || null,
//           lastName: user.lastName || null,
//           username: user.username || null,
//           phone: user.phone || null,
//           isBot: user.bot || false,
//           isPremium: user.premium || false,
//           isVerified: user.verified || false,
//           isRestricted: user.restricted || false,
//           isDeleted: user.deleted || false,
//           languageCode: user.langCode || null,
//           accessHash: user.accessHash ? user.accessHash.toString() : null,
//           status: user.status
//             ? {
//                 className: user.status.className || "Unknown",
//                 online: user.status.className === "UserStatusOnline",
//                 lastOnline: user.status.wasOnline || null,
//               }
//             : null,
//         };
//       });
//       // Get channel info with proper type checking
//       const channelInfo = {
//         id: (channel as any).id?.toString() || channelId.toString(),
//         title: (channel as any).title || "Unknown Channel",
//         username: (channel as any).username || null,
//         memberCount: (channel as any).participantsCount || members.length,
//         about: (channel as any).about || null,
//         date: (channel as any).date || null,
//         verified: (channel as any).verified || false,
//         restricted: (channel as any).restricted || false,
//         scam: (channel as any).scam || false,
//         fake: (channel as any).fake || false,
//       };
//       await client.disconnect();
//       return res.json({
//         success: true,
//         channelInfo: channelInfo,
//         members: members,
//         totalMembers: members.length,
//         fetchedAt: new Date().toISOString(),
//         note: "Complete member list fetched using Telegram Client API",
//       });
//     } catch (error: any) {
//       await client.disconnect();
//       console.error("Error fetching members:", error);
//       if (error.message.includes("CHANNEL_PRIVATE")) {
//         return res.status(403).json({
//           error: "Cannot access private channel",
//           details: "You need to be a member of this channel",
//         });
//       } else if (error.message.includes("CHANNEL_INVALID")) {
//         return res.status(404).json({
//           error: "Channel not found",
//           details: "Invalid channel ID or channel does not exist",
//         });
//       } else {
//         return res.status(500).json({
//           error: "Failed to fetch channel members",
//           details: error.message,
//         });
//       }
//     }
//   } catch (error: any) {
//     console.error("Unexpected error:", error);
//     return res.status(500).json({
//       error: "Unexpected error occurred",
//       details: error.message,
//     });
//   }
// };
// /**
//  * Get specific member details from channel
//  */
// static getChannelMemberDetails = async (req: any, res: any) => {
//   try {
//     const { channelId, phoneNumber, targetUserId } = req.body;
//     if (!channelId || !phoneNumber || !targetUserId) {
//       return res.status(400).json({
//         error: "Channel ID, Phone Number, and Target User ID are required",
//       });
//     }
//     const cleanNumber = normalizePhoneNumber(phoneNumber);
//     // Check if user has an active session
//     const sessionString = loadUserSession(cleanNumber);
//     if (!sessionString) {
//       return res.status(401).json({
//         success: false,
//         message: "No active session found. Please login first.",
//       });
//     }
//     // Create Telegram client
//     const stringSession = new StringSession(sessionString);
//     const client = new TelegramClient(
//       stringSession,
//       TELEGRAM_API_ID,
//       TELEGRAM_API_HASH,
//       {
//         connectionRetries: 3,
//         timeout: 15000,
//       }
//     );
//     await client.connect();
//     try {
//       // Get channel and user entities
//       const channel = await client.getEntity(bigInt(channelId));
//       const targetUser = await client.getEntity(bigInt(targetUserId));
//       // Get participant info
//       const participantResult = await client.invoke(
//         new Api.channels.GetParticipant({
//           channel: channel,
//           participant: targetUser,
//         })
//       );
//       // Type assertion for participant data
//       const participantData = participantResult as any;
//       const participant = participantData.participant;
//       const userInfo = {
//         userId: (targetUser as any).id?.toString() || null,
//         firstName: (targetUser as any).firstName || null,
//         lastName: (targetUser as any).lastName || null,
//         username: (targetUser as any).username || null,
//         phone: (targetUser as any).phone || null,
//         isBot: (targetUser as any).bot || false,
//         isPremium: (targetUser as any).premium || false,
//         isVerified: (targetUser as any).verified || false,
//         participantInfo: {
//           status: participant?.className || "Unknown",
//           joinedDate: participant?.date || null,
//           isAdmin: participant?.className?.includes("Admin") || false,
//           isCreator: participant?.className?.includes("Creator") || false,
//           adminRights: participant?.adminRights || null,
//           bannedRights: participant?.bannedRights || null,
//         },
//       };
//       await client.disconnect();
//       return res.json({
//         success: true,
//         userInfo: userInfo,
//         channelTitle: (channel as any).title || "Unknown Channel",
//       });
//     } catch (error: any) {
//       await client.disconnect();
//       console.error("Error fetching member details:", error);
//       if (error.message.includes("USER_NOT_PARTICIPANT")) {
//         return res.status(404).json({
//           error: "User is not a member of this channel",
//         });
//       } else {
//         return res.status(500).json({
//           error: "Failed to fetch member details",
//           details: error.message,
//         });
//       }
//     }
//   } catch (error: any) {
//     console.error("Unexpected error:", error);
//     return res.status(500).json({
//       error: "Unexpected error occurred",
//       details: error.message,
//     });
//   }
// };
// /**
//  * Get channel members with pagination and filters
//  */
// static getChannelMembersPaginated = async (req: any, res: any) => {
//   try {
//     const {
//       channelId,
//       phoneNumber,
//       limit = 100,
//       offset = 0,
//       filter = "recent",
//     } = req.body;
//     if (!channelId || !phoneNumber) {
//       return res.status(400).json({
//         error: "Channel ID and Phone Number are required",
//       });
//     }
//     const cleanNumber = normalizePhoneNumber(phoneNumber);
//     // Check if user has an active session
//     const sessionString = loadUserSession(cleanNumber);
//     if (!sessionString) {
//       return res.status(401).json({
//         success: false,
//         message: "No active session found. Please login first.",
//       });
//     }
//     // Create Telegram client
//     const stringSession = new StringSession(sessionString);
//     const client = new TelegramClient(
//       stringSession,
//       TELEGRAM_API_ID,
//       TELEGRAM_API_HASH,
//       {
//         connectionRetries: 3,
//         timeout: 15000,
//       }
//     );
//     await client.connect();
//     try {
//       const channel = await client.getEntity(bigInt(channelId));
//       // Set filter type
//       let filterType;
//       switch (filter) {
//         case "admins":
//           filterType = new Api.ChannelParticipantsAdmins();
//           break;
//         case "bots":
//           filterType = new Api.ChannelParticipantsBots();
//           break;
//         case "banned":
//           filterType = new Api.ChannelParticipantsBanned({
//             q: "",
//           });
//           break;
//         case "recent":
//         default:
//           filterType = new Api.ChannelParticipantsRecent();
//           break;
//       }
//       // Get participants with pagination
//       const participantsResult = await client.invoke(
//         new Api.channels.GetParticipants({
//           channel: channel,
//           filter: filterType,
//           offset: offset,
//           limit: Math.min(limit, 200), // Max 200 per request
//           hash: bigInt(0),
//         })
//       );
//       // Type assertion and null checks
//       const participantsData = participantsResult as any;
//       const users = participantsData.users || [];
//       const totalCount = participantsData.count || 0;
//       const members = users.map((user: any) => ({
//         userId: user.id?.toString() || null,
//         firstName: user.firstName || null,
//         lastName: user.lastName || null,
//         username: user.username || null,
//         isBot: user.bot || false,
//         isPremium: user.premium || false,
//         isVerified: user.verified || false,
//         status: user.status
//           ? {
//               className: user.status.className || "Unknown",
//               online: user.status.className === "UserStatusOnline",
//             }
//           : null,
//       }));
//       await client.disconnect();
//       return res.json({
//         success: true,
//         channelTitle: (channel as any).title || "Unknown Channel",
//         members: members,
//         pagination: {
//           offset: offset,
//           limit: limit,
//           fetched: members.length,
//           hasMore: members.length === limit,
//           filter: filter,
//         },
//         totalCount: totalCount,
//       });
//     } catch (error: any) {
//       await client.disconnect();
//       throw error;
//     }
//   } catch (error: any) {
//     console.error("Unexpected error:", error);
//     return res.status(500).json({
//       error: "Unexpected error occurred",
//       details: error.message,
//     });
//   }
// };
TelegramController.getChannelMembers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e;
    try {
        const { channelId, apiToken } = req.body;
        // Validate required parameters
        if (!channelId || !apiToken) {
            return res.status(400).json({
                error: "Channel ID and API Token are required",
            });
        }
        // Format channel ID correctly
        let formattedChannelId = channelId;
        if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
            formattedChannelId = `-100${channelId}`;
        }
        // Verify the bot is an admin in the channel
        try {
            const botInfoResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getMe`);
            const botId = botInfoResponse.data.result.id;
            const chatMemberResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`);
            const botStatus = chatMemberResponse.data.result.status;
            if (botStatus !== "administrator" && botStatus !== "creator") {
                return res.status(403).json({
                    error: "Bot is not an administrator in the specified channel",
                });
            }
        }
        catch (error) {
            return res.status(403).json({
                error: "Failed to verify bot permissions",
                details: ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.description) || error.message,
            });
        }
        // Get total member count first
        const chatInfo = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getChat?chat_id=${formattedChannelId}`);
        const totalMembers = chatInfo.data.result.members_count;
        console.log(`Channel has ${totalMembers} members`);
        // Get administrators list
        const adminsResponse = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getChatAdministrators?chat_id=${formattedChannelId}`);
        const administrators = adminsResponse.data.result.map((admin) => ({
            userId: admin.user.id,
            firstName: admin.user.first_name,
            lastName: admin.user.last_name || "",
            username: admin.user.username || "",
            status: admin.status,
            isBot: admin.user.is_bot,
            canBeEdited: admin.can_be_edited || false,
            // Add other admin permissions as needed
        }));
        // For large channels, we need to be careful about getting all members
        // as the Telegram API doesn't provide a direct way to get all members via bot
        // We can only get administrators and information about specific members
        // Return the information we can gather
        return res.json({
            success: true,
            channelInfo: {
                id: formattedChannelId,
                title: chatInfo.data.result.title,
                username: chatInfo.data.result.username || "",
                totalMembers: totalMembers,
                description: chatInfo.data.result.description || "",
            },
            administrators: administrators,
            note: "Due to Telegram API limitations, bots can only retrieve administrator lists, not full member lists. For full member details, you would need to use user API (not bot API) with proper authentication.",
        });
    }
    catch (error) {
        console.error("Error getting channel members:", error);
        return res.status(500).json({
            error: "Failed to get channel members",
            details: ((_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.description) || error.message,
        });
    }
});
TelegramController.getChannelMembersViaUserApi = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phoneNumber, channelId } = req.body;
        if (!channelId) {
            res.status(400).json({
                success: false,
                message: "Phone number and channel ID are required",
            });
            return;
        }
        const cleanNumber = normalizePhoneNumber(phoneNumber);
        const sessionString = loadUserSession(cleanNumber);
        if (!sessionString) {
            res.status(401).json({
                success: false,
                message: "No active session found. Please login first.",
            });
            return;
        }
        const stringSession = new sessions_1.StringSession(sessionString);
        const client = new telegram_1.TelegramClient(stringSession, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
            connectionRetries: 3,
            useWSS: false,
            timeout: 10000,
        });
        try {
            yield client.connect();
            // Validate the session first
            const isValid = yield validateSession(client);
            if (!isValid) {
                // Clean up invalid session
                const sessionFile = path_1.default.join(sessionsDir, `${cleanNumber.replace(/[^0-9+]/g, "")}.session`);
                if (fs_1.default.existsSync(sessionFile)) {
                    fs_1.default.unlinkSync(sessionFile);
                }
                userSessions.delete(cleanNumber);
                res.status(401).json({
                    success: false,
                    message: "Session expired. Please login again.",
                });
                return;
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
                res.status(400).json({
                    success: false,
                    message: "Invalid channel ID or not a member of this channel",
                });
                return;
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
                        // Add other fields you need
                    };
                });
                res.json({
                    success: true,
                    totalMembers: members.length,
                    members: members,
                });
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
                    res.json({
                        success: true,
                        message: "Could not get all members, but retrieved admin list",
                        totalAdmins: adminList.length,
                        admins: adminList,
                        note: "Bot may not have permission to view all channel members",
                    });
                }
                catch (adminError) {
                    console.error("Error getting admins:", adminError);
                    res.status(403).json({
                        success: false,
                        message: "Insufficient permissions to view channel members",
                    });
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
            res.status(401).json({
                success: false,
                message: "Session expired. Please login again.",
            });
        }
        else if (error.message.includes("CHANNEL_INVALID") ||
            error.message.includes("CHANNEL_PRIVATE")) {
            res.status(404).json({
                success: false,
                message: "Channel not found or you don't have access to it",
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: "Failed to get channel members: " + error.message,
            });
        }
    }
});
TelegramController.AddUserToChannel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k;
    try {
        const { channelId, phoneNumber, username, selectedPlan } = req.body;
        console.log("Request received with data:", {
            channelId,
            phoneNumber,
            selectedPlan,
        });
        // Validate required parameters
        if (!channelId || !phoneNumber) {
            return res.status(400).json({
                error: "Channel ID and Phone Number are required",
            });
        }
        const newPhoneNumber = `+91${phoneNumber.slice(-10)}`;
        // Format channel ID correctly
        let formattedChannelId = channelId;
        if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
            formattedChannelId = `-100${channelId}`;
            console.log("Converting channel ID to:", formattedChannelId);
        }
        // First, check if the bot is an admin in the channel
        try {
            const botInfoResponse = yield axios_1.default.get(`https://api.telegram.org/bot${botToken}/getMe`);
            const botId = botInfoResponse.data.result.id;
            console.log("Bot ID:", botId);
            // Check if bot is admin in the channel
            const chatMemberResponse = yield axios_1.default.get(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`);
            const botStatus = chatMemberResponse.data.result.status;
            console.log("Bot status in channel:", botStatus);
            if (botStatus !== "administrator" && botStatus !== "creator") {
                return res.status(403).json({
                    error: "Bot is not an administrator in the specified channel",
                    details: "Please connect to owner and make sure the bot has been added as an admin with appropriate permissions",
                });
            }
            // Check if bot has permission to create invite links
            const canInviteUsers = chatMemberResponse.data.result.can_invite_users;
            console.log("Bot can invite users:", canInviteUsers);
            if (!canInviteUsers) {
                return res.status(403).json({
                    error: "Bot does not have permission to create invite links",
                    details: 'Please grant the bot "Invite Users" permission in the channel settings',
                });
            }
        }
        catch (error) {
            console.error("Error checking bot admin status:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            // Handle the specific case where bot is not a member
            if (((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error_code) === 400) {
                const errorDescription = error.response.data.description || '';
                if (errorDescription.includes("bot is not a member") ||
                    errorDescription.includes("bot is not a member of the supergroup") ||
                    errorDescription.includes("chat not found") ||
                    errorDescription.includes("Bad Request: bot is not a member")) {
                    console.log("Bot is not a member of the channel. Not creating any data.");
                    return res.status(404).json({
                        error: "Bot is not a member of the specified channel",
                        details: "Please add the bot to the channel first and make it an administrator",
                        actionRequired: "1. Add bot to channel\n2. Make bot an administrator\n3. Grant 'Invite Users' permission",
                        doNotCreateData: true // Flag to indicate no data was created
                    });
                }
            }
            // Handle other errors
            return res.status(500).json({
                error: "Failed to verify bot permissions",
                details: ((_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.description) || error.message,
            });
        }
        // Only proceed with data creation if bot verification passed
        // Check if user already exists for this channel
        const existingUser = yield telegramNewUser_1.default.findOne({
            phoneNumber: newPhoneNumber,
            channelId: channelId,
        });
        console.log(existingUser, "existingUser", selectedPlan);
        let totalDaysToAdd = 0;
        const joinDate = new Date();
        // Calculate days based on selected plan
        if (selectedPlan) {
            const planValue = ((_g = selectedPlan.value) === null || _g === void 0 ? void 0 : _g.toLowerCase()) || selectedPlan.toLowerCase();
            const totalNumber = selectedPlan.totalNumber || 1; // Default to 1 if not specified
            let daysPerUnit = 0;
            console.log(planValue, "planValue");
            switch (planValue) {
                case "day":
                    daysPerUnit = 1;
                    break;
                case "week":
                    daysPerUnit = 7;
                    break;
                case "month":
                    daysPerUnit = 30;
                    break;
                case "year":
                    daysPerUnit = 365;
                    break;
                case "lifetime":
                    daysPerUnit = 10000000; // 1 crore days for lifetime
                    break;
                default:
                    // If it's a number, use it directly
                    if (!isNaN(planValue)) {
                        daysPerUnit = parseInt(planValue);
                    }
                    break;
            }
            console.log(daysPerUnit, "daysPerUnit", totalNumber);
            totalDaysToAdd += daysPerUnit * totalNumber;
            console.log(`Plan calculation: ${totalNumber} ${planValue} = ${daysPerUnit * totalNumber} days`);
        }
        console.log(`Total days to add: ${totalDaysToAdd}`);
        let finalTotalDaysLeft = totalDaysToAdd;
        let updatedUser;
        if (existingUser) {
            console.log("User exists, updating plan");
            // User exists, update the selectedPlan and totalDaysLeft
            finalTotalDaysLeft = existingUser.totalDaysLeft + totalDaysToAdd;
            console.log(finalTotalDaysLeft, "finalTotalDaysLeft");
            updatedUser = yield telegramNewUser_1.default.findByIdAndUpdate(existingUser._id, {
                $push: { selectedPlan: selectedPlan },
                $set: {
                    totalDaysLeft: finalTotalDaysLeft,
                    lastUpdated: new Date(),
                    updatedAt: new Date(),
                },
            }, { new: true });
            console.log("User plan updated:", {
                phoneNumber: newPhoneNumber,
                channelId,
                previousDays: existingUser.totalDaysLeft,
                addedDays: totalDaysToAdd,
                newTotalDays: finalTotalDaysLeft,
            });
        }
        else {
            // Create new user only if bot is verified as admin
            updatedUser = yield telegramNewUser_1.default.create({
                phoneNumber: newPhoneNumber,
                channelId: channelId,
                username: username || "",
                selectedPlan: selectedPlan || [],
                totalDaysLeft: finalTotalDaysLeft,
                registeredAt: joinDate,
                lastUpdated: joinDate,
            });
            console.log("New user created:", {
                phoneNumber: newPhoneNumber,
                channelId,
                totalDaysLeft: finalTotalDaysLeft,
            });
        }
        // Create single-use invite link specifically for the phone number
        try {
            console.log("Creating single-use invite link for phone number:", phoneNumber);
            const response = yield axios_1.default.post(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
                chat_id: formattedChannelId,
                member_limit: 1, // Only one user can join
                name: `invite-for-${`+91${phoneNumber.slice(-10)}`}-${Date.now()}`,
                creates_join_request: false,
            });
            const inviteLink = response.data.result.invite_link;
            console.log("Single-use invite link created successfully:", {
                inviteLink,
                member_limit: response.data.result.member_limit,
                phone_number: phoneNumber,
                totalDaysAdded: totalDaysToAdd,
                finalTotalDays: finalTotalDaysLeft,
            });
            return res.json({
                success: true,
                message: `Single-use invite link created successfully for ${phoneNumber}`,
                invite_link: inviteLink,
                plan_details: {
                    selected_plans: selectedPlan || [],
                    days_added: totalDaysToAdd,
                    total_days_left: finalTotalDaysLeft,
                },
                link_details: {
                    phone_number: phoneNumber,
                    member_limit: response.data.result.member_limit,
                    creator: response.data.result.creator,
                    is_revoked: response.data.result.is_revoked,
                    is_primary: response.data.result.is_primary,
                    name: response.data.result.name,
                },
                usage_instructions: [
                    `1. This link is exclusively for phone number: ${phoneNumber}`,
                    "2. The link can only be used ONCE (member_limit: 1)",
                    "3. Share this link only with the intended user",
                    "4. After one user joins, the link becomes invalid automatically",
                    "5. No one else can use this link once it's used",
                ],
                security_note: "This invite link is tied to the specified phone number and cannot be used by anyone else",
            });
        }
        catch (createError) {
            console.error("Error creating invite link:", ((_h = createError.response) === null || _h === void 0 ? void 0 : _h.data) || createError.message);
            // Rollback user creation if invite link fails
            if (!existingUser && updatedUser) {
                console.log("Rolling back user creation due to invite link failure");
                yield telegramNewUser_1.default.findByIdAndDelete(updatedUser._id);
            }
            return res.status(500).json({
                error: "Failed to create invite link",
                details: ((_k = (_j = createError.response) === null || _j === void 0 ? void 0 : _j.data) === null || _k === void 0 ? void 0 : _k.description) || createError.message,
                possibleReasons: [
                    "Bot might not have sufficient permissions to create invite links",
                    "Channel might have restrictions on invite link creation",
                    "Invalid channel ID or bot token",
                ],
                rollback: !existingUser ? "User data was rolled back" : "No rollback needed for existing user",
            });
        }
    }
    catch (error) {
        console.error("Unexpected error in AddUserToChannel:", error);
        return res.status(500).json({
            error: "Unexpected error occurred",
            details: error.message,
        });
    }
});
TelegramController.RemoveUserFromChannel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k;
    try {
        const { channelId, userId } = req.body;
        console.log("Remove user request received with data:", {
            channelId,
            userId,
            botToken,
        });
        // Validate required parameters
        if (!channelId || !userId || !botToken) {
            return res.status(400).json({
                error: "Channel ID, User ID, and API Token are required",
            });
        }
        // Format channel ID correctly
        let formattedChannelId = channelId;
        if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
            formattedChannelId = `-100${channelId}`;
            console.log("Converting channel ID to:", formattedChannelId);
        }
        // Convert user ID to number
        const numericUserId = parseInt(userId, 10);
        if (isNaN(numericUserId)) {
            return res.status(400).json({
                error: "Invalid User ID format",
                details: "User ID must be a valid number",
            });
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
                return res.status(403).json({
                    error: "Bot is not an administrator in the specified channel",
                    details: "Please make sure the bot has been added as an admin with appropriate permissions",
                });
            }
            // Check if bot has permission to ban/restrict users
            const canRestrictMembers = chatMemberResponse.data.result.can_restrict_members;
            console.log("Bot can restrict members:", canRestrictMembers);
            if (!canRestrictMembers) {
                return res.status(403).json({
                    error: "Bot does not have permission to remove users",
                    details: 'Please grant the bot "Ban Users" permission in the channel settings',
                });
            }
        }
        catch (error) {
            console.error("Error checking bot admin status:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.data.error_code) === 400) {
                return res.status(404).json({
                    error: "Bot is not a member of the specified channel",
                    details: "Please add the bot to the channel first and make it an administrator",
                });
            }
            return res.status(500).json({
                error: "Failed to verify bot permissions",
                details: ((_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.description) || error.message,
            });
        }
        // Check if user is actually a member of the channel
        try {
            const userStatusResponse = yield axios_1.default.get(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${numericUserId}`);
            const userStatus = userStatusResponse.data.result.status;
            console.log("User status in channel:", userStatus);
            if (userStatus === "left" || userStatus === "kicked") {
                return res.status(400).json({
                    error: "User is not a member of the channel",
                    details: `User status: ${userStatus}`,
                });
            }
        }
        catch (statusError) {
            console.log("Error checking user status:", ((_f = statusError.response) === null || _f === void 0 ? void 0 : _f.data) || statusError.message);
            return res.status(400).json({
                error: "User is not a member of the channel or invalid user ID",
            });
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
            return res.json({
                success: true,
                message: `User ${userId} successfully removed from channel ${channelId}`,
                data: response.data,
            });
        }
        catch (banError) {
            console.error("Error with banChatMember:", ((_g = banError.response) === null || _g === void 0 ? void 0 : _g.data) || banError.message);
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
                return res.json({
                    success: true,
                    message: `User ${userId} successfully kicked from channel ${channelId}`,
                    data: response.data,
                });
            }
            catch (kickError) {
                console.error("Error with kick:", ((_h = kickError.response) === null || _h === void 0 ? void 0 : _h.data) || kickError.message);
                // Return detailed error information
                return res.status(500).json({
                    error: "Failed to remove user from channel",
                    details: ((_k = (_j = kickError.response) === null || _j === void 0 ? void 0 : _j.data) === null || _k === void 0 ? void 0 : _k.description) || kickError.message,
                    possibleReasons: [
                        "Bot might not have sufficient permissions",
                        "User might be the channel owner",
                        "User might be an admin with higher privileges than bot",
                    ],
                });
            }
        }
    }
    catch (error) {
        console.error("Unexpected error in RemoveUserFromChannel:", error);
        return res.status(500).json({
            error: "Unexpected error occurred",
            details: error.message,
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
            message: "Use the following link to add the bot as an administrator to your channel",
            deepLink: deepLink,
            instructions: [
                "1. Open the link above in a web browser",
                "2. Select your channel from the options",
                "3. Grant all administrator privileges to the bot",
                "4. Confirm the action",
            ],
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
        return res.status(400).json({ error: "API token is required" });
    }
    try {
        // Verify the token is valid by calling getMe
        const response = yield axios_1.default.get(`https://api.telegram.org/bot${apiToken}/getMe`);
        console.log((_b = response.data) === null || _b === void 0 ? void 0 : _b.result, "Dwkl");
        req.botInfo = response.data.result;
        // next();
    }
    catch (error) {
        return res.status(401).json({ error: "Invalid API token" });
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
                message: "Invalid phone number format",
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
    var _b, _c, _d, _e, _f, _g, _h;
    console.log(req.body, "Dewlkm");
    const requestPayload = req.body;
    const { channelId } = requestPayload;
    console.log(botToken, "bottoen");
    try {
        // Check if bot is a member of the specified channel
        if (channelId && botToken) {
            let formattedChannelId = channelId;
            // Format channel ID correctly
            if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
                formattedChannelId = `-100${channelId}`;
            }
            try {
                // Get bot info first
                const botInfoResponse = yield axios_1.default.get(`https://api.telegram.org/bot${botToken}/getMe`);
                const botId = botInfoResponse.data.result.id;
                // Check if bot is a member of the channel
                yield axios_1.default.get(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`);
                console.log("✅ Bot verification successful - Bot is member of channel");
            }
            catch (error) {
                console.error("Bot channel membership check failed:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
                let errorMessage = "Bot is not a member of the specified channel";
                let errorDetails = "Please add bot to the channel first";
                if (((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error_code) === 400) {
                    errorMessage = "Bot is not a member of the specified channel";
                    errorDetails = "The bot needs to be added to the channel as a member before creating a telegram page";
                }
                else if (((_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.error_code) === 403) {
                    errorMessage = "Bot doesn't have access to the channel";
                    errorDetails = "Please make sure the bot is added to the channel and has proper permissions";
                }
                return res.status(400).json({
                    success: false,
                    message: errorMessage,
                    details: errorDetails,
                    telegramError: (_h = (_g = error.response) === null || _g === void 0 ? void 0 : _g.data) === null || _h === void 0 ? void 0 : _h.description
                });
            }
        }
        // Create the page if bot verification passes
        const newTelegramPage = yield telegramPage_1.default.create(requestPayload);
        res.json({
            success: true,
            result: newTelegramPage,
            message: channelId && botToken ? "Telegram page created successfully with bot verification" : "Telegram page created successfully"
        });
    }
    catch (err) {
        console.error("Error in createTelegramPage:", err);
        res.status(400).json({
            success: false,
            message: "Failed to create telegram page",
            error: err.message || err,
        });
    }
});
TelegramController.updateTelegramPage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g, _h;
    console.log(req.body, "Update payload");
    console.log(req.params, "Request params");
    const requestPayload = req.body;
    const { id } = req.params; // Assuming the page ID comes from URL params
    const { channelId } = requestPayload;
    try {
        // Validate ID exists
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Telegram page ID is required"
            });
        }
        // Check if page exists
        const existingPage = yield telegramPage_1.default.findById(id);
        if (!existingPage) {
            return res.status(404).json({
                success: false,
                message: "Telegram page not found"
            });
        }
        // Determine which bot token to use for verification
        const tokenToUse = botToken;
        // Perform bot verification if channelId is being updated/changed
        const isChannelUpdated = channelId && channelId !== existingPage.channelId;
        if (isChannelUpdated && tokenToUse) {
            let formattedChannelId = channelId;
            // Format channel ID correctly
            if (!channelId.startsWith("-100") && parseInt(channelId) > 0) {
                formattedChannelId = `-100${channelId}`;
            }
            try {
                // Get bot info first
                const botInfoResponse = yield axios_1.default.get(`https://api.telegram.org/bot${tokenToUse}/getMe`);
                const botId = botInfoResponse.data.result.id;
                // Check if bot is a member of the channel
                yield axios_1.default.get(`https://api.telegram.org/bot${tokenToUse}/getChatMember?chat_id=${formattedChannelId}&user_id=${botId}`);
                console.log("✅ Bot verification successful for updated channel");
            }
            catch (error) {
                console.error("Bot channel membership check failed:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
                let errorMessage = "Bot is not a member of the specified channel";
                let errorDetails = "Please add bot to the channel first";
                if (((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error_code) === 400) {
                    errorMessage = "Bot is not a member of the specified channel";
                    errorDetails = "The bot needs to be added to the channel as a member before updating the telegram page";
                }
                else if (((_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.error_code) === 403) {
                    errorMessage = "Bot doesn't have access to the channel";
                    errorDetails = "Please make sure the bot is added to the channel and has proper permissions";
                }
                return res.status(400).json({
                    success: false,
                    message: errorMessage,
                    details: errorDetails,
                    telegramError: (_h = (_g = error.response) === null || _g === void 0 ? void 0 : _g.data) === null || _h === void 0 ? void 0 : _h.description
                });
            }
        }
        // Update the page
        const updatedPage = yield telegramPage_1.default.findByIdAndUpdate(id, Object.assign(Object.assign({}, requestPayload), { updatedAt: new Date() // Ensure updated timestamp is set
         }), {
            new: true, // Return the updated document
            runValidators: true // Run model validators
        });
        console.log("✅ Telegram page updated successfully");
        res.json({
            success: true,
            result: updatedPage,
            message: isChannelUpdated ?
                "Telegram page updated successfully with bot verification" :
                "Telegram page updated successfully"
        });
    }
    catch (err) {
        console.error("Error in updateTelegramPage:", err);
        // Handle duplicate key errors (if you have unique constraints)
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Duplicate entry",
                error: "A page with similar details already exists",
                field: Object.keys(err.keyPattern)[0]
            });
        }
        // Handle validation errors
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                error: Object.values(err.errors).map((e) => e.message).join(', ')
            });
        }
        res.status(400).json({
            success: false,
            message: "Failed to update telegram page",
            error: err.message || err,
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
TelegramController.countAllTelegramUsersByChannelId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { channelId } = req.query;
        // Validate channelId
        if (!channelId) {
            return res.status(400).json({
                success: false,
                message: 'channelId is required in query parameters'
            });
        }
        // Find all users with the given channelId
        const users = yield telegramNewUser_1.default.find({ channelId });
        // Count active and inactive users
        const activeUsers = users.filter(user => user.totalDaysLeft > 0).length;
        const inactiveUsers = users.filter(user => user.totalDaysLeft <= 0).length;
        // Return the counts
        return res.status(200).json({
            success: true,
            data: {
                channelId,
                activeUsers,
                inactiveUsers,
                totalUsers: users.length
            }
        });
    }
    catch (error) {
        console.error('Error counting users:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while counting users',
            error: error.message
        });
    }
});
TelegramController.getAllTelegramUsersByChannelId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = req.body;
    const query = {
        channelId: payload.channelId
    };
    if (payload.status === 'ACTIVE') {
        query.totalDaysLeft = { $gt: 0 };
    }
    else {
        query.totalDaysLeft = { $lte: 0 };
    }
    const pageNo = payload === null || payload === void 0 ? void 0 : payload.pageNo;
    const pageSize = payload === null || payload === void 0 ? void 0 : payload.pageSize;
    const result = yield telegramNewUser_1.default.find(query)
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