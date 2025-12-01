import fs from "fs";
import path from "path";
import { TelegramClient } from "telegram";

interface AuthSessionData {
  client: TelegramClient;
  phoneCodeHash: string;
  phoneNumber: string;
  createdAt: Date;
}

export const authSessions = new Map<string, AuthSessionData>();
export const userSessions = new Map<string, string>();

export const sessionsDir = path.join(process.cwd(), "telegram-sessions");
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

export async function validateSession(
  client: TelegramClient
): Promise<boolean> {
  try {
    // Try to get our own user info to validate the session
    await client.getMe();
    return true;
  } catch (error) {
    console.error("Session validation failed:", error);
    return false;
  }
}

export function normalizePhoneNumber(phoneNumber: string): string {
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

export function loadUserSession(phoneNumber: string): string {
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
