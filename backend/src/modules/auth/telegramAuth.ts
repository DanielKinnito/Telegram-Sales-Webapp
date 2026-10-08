import type { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import { env } from "../../config/env.js";

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string | undefined;
  username?: string | undefined;
  languageCode?: string | undefined;
  isPremium?: boolean | undefined;
}

export interface AuthenticatedRequest extends Request {
  telegramUser?: TelegramUser | undefined;
}

export interface VerifyInitDataResult {
  valid: boolean;
  user?: TelegramUser | undefined;
  error?: string | undefined;
}

export interface TelegramAuthOptions {
  botToken?: string;
  maxAgeSeconds?: number;
}

/**
 * Pure cryptographic verification of Telegram Mini App initData string.
 * Uses HMAC-SHA256 with the bot token following official Telegram specs:
 * 1. secret_key = HMAC_SHA256("WebAppData", bot_token)
 * 2. data_check_string = sorted key=value pairs separated by \n (excluding hash)
 * 3. hash = HMAC_SHA256(secret_key, data_check_string)
 */
export function verifyTelegramInitData(
  rawInitData: string,
  botToken: string,
  options?: { maxAgeSeconds?: number }
): VerifyInitDataResult {
  try {
    if (!rawInitData || typeof rawInitData !== "string") {
      return { valid: false, error: "Empty or invalid initData string" };
    }

    const params = new URLSearchParams(rawInitData);
    const hash = params.get("hash");

    if (!hash) {
      return { valid: false, error: "Missing hash parameter in initData" };
    }

    params.delete("hash");

    // Sort remaining parameters alphabetically
    const dataCheckArr: string[] = [];
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of entries) {
      dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.join("\n");

    // Derive secret key: HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // Calculate signature: HMAC_SHA256(secretKey, dataCheckString)
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, "hex");
    const calculatedBuffer = Buffer.from(calculatedHash, "hex");

    if (
      hashBuffer.length !== calculatedBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)
    ) {
      return { valid: false, error: "Invalid Telegram signature: HMAC mismatch" };
    }

    // Check expiration if auth_date is present
    const maxAge = options?.maxAgeSeconds ?? 86400; // Default 24h
    const authDateStr = params.get("auth_date");
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Number.isFinite(authDate) && now - authDate > maxAge) {
        return { valid: false, error: "Telegram initData has expired" };
      }
    }

    // Parse user object
    const rawUser = params.get("user");
    if (!rawUser) {
      return { valid: false, error: "Missing user object in initData" };
    }

    const parsedUser = JSON.parse(rawUser);
    if (!parsedUser || typeof parsedUser.id !== "number") {
      return { valid: false, error: "Malformed user object in initData" };
    }

    const user: TelegramUser = {
      id: parsedUser.id,
      firstName: parsedUser.first_name || "",
      lastName: parsedUser.last_name || undefined,
      username: parsedUser.username || undefined,
      languageCode: parsedUser.language_code || undefined,
      isPremium: parsedUser.is_premium || undefined,
    };

    return { valid: true, user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to verify initData: ${message}` };
  }
}

/**
 * Factory creating Express middleware for Telegram initData authentication.
 */
export function createTelegramAuthMiddleware(options: TelegramAuthOptions = {}) {
  const botToken = options.botToken || env.TELEGRAM_BOT_TOKEN;
  const maxAgeSeconds = options.maxAgeSeconds ?? 86400;

  return function telegramAuthMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    const authHeader = req.headers.authorization;
    const fallbackHeader = req.headers["x-telegram-init-data"];

    let rawInitData: string | undefined;

    if (authHeader && authHeader.startsWith("tma ")) {
      rawInitData = authHeader.slice(4).trim();
    } else if (typeof fallbackHeader === "string" && fallbackHeader.trim()) {
      rawInitData = fallbackHeader.trim();
    }

    if (!rawInitData) {
      return res.status(401).json({
        error: "Missing or malformed Telegram authorization header. Expected 'Authorization: tma <initData>' or 'x-telegram-init-data'.",
      });
    }

    const verification = verifyTelegramInitData(rawInitData, botToken, { maxAgeSeconds });

    if (!verification.valid || !verification.user) {
      return res.status(401).json({
        error: "Unauthorized: Invalid Telegram signature",
        details: verification.error,
      });
    }

    req.telegramUser = verification.user;
    return next();
  };
}

/**
 * Default middleware instance bound to process environment configuration.
 */
export const verifyTelegramAuth = createTelegramAuthMiddleware();