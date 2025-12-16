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
exports.sessionsDir = exports.userSessions = exports.authSessions = void 0;
exports.validateSession = validateSession;
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.getSessionFilePath = getSessionFilePath;
exports.loadUserSession = loadUserSession;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.authSessions = new Map();
exports.userSessions = new Map();
exports.sessionsDir = path_1.default.join(process.cwd(), 'telegram_sessions');
if (!fs_1.default.existsSync(exports.sessionsDir)) {
    fs_1.default.mkdirSync(exports.sessionsDir, { recursive: true });
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
function getSessionFilePath(phone) {
    const clean = normalizePhoneNumber(phone);
    return path_1.default.join(exports.sessionsDir, `${clean}.session`);
}
function loadUserSession(phoneNumber) {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    // Check memory first
    if (exports.userSessions.has(normalizedNumber)) {
        return exports.userSessions.get(normalizedNumber);
    }
    // Try to load from /tmp
    try {
        const sessionFile = path_1.default.join(exports.sessionsDir, `${normalizedNumber.replace(/[^0-9+]/g, "")}.session`);
        if (fs_1.default.existsSync(sessionFile)) {
            const sessionString = fs_1.default.readFileSync(sessionFile, "utf8");
            exports.userSessions.set(normalizedNumber, sessionString);
            return sessionString;
        }
    }
    catch (error) {
        // File doesn't exist or can't be read
        console.warn("Could not load session from filesystem:", error.message);
    }
    return "";
}
//# sourceMappingURL=common.js.map