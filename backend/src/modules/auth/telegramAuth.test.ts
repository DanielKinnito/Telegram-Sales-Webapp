import { describe, it, expect, vi } from "vitest";
import * as crypto from "crypto";
import {
  createTelegramAuthMiddleware,
  verifyTelegramInitData,
  type AuthenticatedRequest,
} from "./telegramAuth.js";
import type { Response, NextFunction } from "express";

function createMockResponse() {
  const res: Partial<Response> = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((data: unknown) => {
    return data;
  });
  return res as Response & { statusCode: number; json: ReturnType<typeof vi.fn> };
}

function generateValidInitData(params: {
  botToken: string;
  userId?: number;
  firstName?: string;
  username?: string;
  authDate?: number;
  tamper?: boolean;
}) {
  const authDate = params.authDate ?? Math.floor(Date.now() / 1000);
  const user = {
    id: params.userId ?? 999888,
    first_name: params.firstName ?? "John",
    username: params.username ?? "john_sales",
  };

  const dataMap = new Map<string, string>();
  dataMap.set("auth_date", authDate.toString());
  dataMap.set("query_id", "AAHdF6IQAAAAAN0XohDhrP_3");
  dataMap.set("user", JSON.stringify(user));

  const sortedPairs = Array.from(dataMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);

  const dataCheckString = sortedPairs.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(params.botToken)
    .digest();

  let hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (params.tamper) {
    hash = "tampered_bad_hash_" + hash.slice(18);
  }

  // Construct raw query string
  const rawParams = new URLSearchParams();
  for (const [key, val] of dataMap.entries()) {
    rawParams.set(key, val);
  }
  rawParams.set("hash", hash);

  return rawParams.toString();
}

describe("Telegram initData HMAC Verification", () => {
  const testBotToken = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ";

  describe("verifyTelegramInitData pure helper", () => {
    it("successfully verifies valid initData and extracts user", () => {
      const rawInitData = generateValidInitData({
        botToken: testBotToken,
        userId: 123456,
        firstName: "Sarah",
        username: "sarah_rep",
      });

      const result = verifyTelegramInitData(rawInitData, testBotToken);
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe(123456);
      expect(result.user?.firstName).toBe("Sarah");
      expect(result.user?.username).toBe("sarah_rep");
    });

    it("fails verification when hash is tampered", () => {
      const rawInitData = generateValidInitData({
        botToken: testBotToken,
        tamper: true,
      });

      const result = verifyTelegramInitData(rawInitData, testBotToken);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/signature/i);
    });

    it("fails verification when signed with a different bot token", () => {
      const rawInitData = generateValidInitData({
        botToken: "different_bot_token:ABC",
      });

      const result = verifyTelegramInitData(rawInitData, testBotToken);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/signature/i);
    });

    it("fails verification when auth_date is older than maxAgeSeconds", () => {
      const expiredDate = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
      const rawInitData = generateValidInitData({
        botToken: testBotToken,
        authDate: expiredDate,
      });

      const result = verifyTelegramInitData(rawInitData, testBotToken, {
        maxAgeSeconds: 86400,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/expired/i);
    });
  });

  describe("Telegram Auth Express Middleware", () => {
    const authMiddleware = createTelegramAuthMiddleware({
      botToken: testBotToken,
      maxAgeSeconds: 86400,
    });

    it("calls next() and attaches telegramUser on valid Authorization header", () => {
      const rawInitData = generateValidInitData({
        botToken: testBotToken,
        userId: 777123,
        firstName: "Michael",
        username: "michael_rep",
      });

      const req = {
        headers: {
          authorization: `tma ${rawInitData}`,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.telegramUser).toBeDefined();
      expect(req.telegramUser?.id).toBe(777123);
      expect(req.telegramUser?.firstName).toBe("Michael");
      expect(req.telegramUser?.username).toBe("michael_rep");
      expect(res.status).not.toHaveBeenCalled();
    });

    it("supports x-telegram-init-data header fallback", () => {
      const rawInitData = generateValidInitData({
        botToken: testBotToken,
        userId: 888123,
        firstName: "David",
      });

      const req = {
        headers: {
          "x-telegram-init-data": rawInitData,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.telegramUser?.id).toBe(888123);
    });

    it("returns 401 when authorization header is completely missing", () => {
      const req = {
        headers: {},
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/missing or malformed/i),
        })
      );
    });

    it("returns 401 when header format does not start with 'tma ' and no fallback", () => {
      const req = {
        headers: {
          authorization: "Bearer some_bearer_token",
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 401 when HMAC signature is forged/invalid", () => {
      const tamperedInitData = generateValidInitData({
        botToken: testBotToken,
        tamper: true,
      });

      const req = {
        headers: {
          authorization: `tma ${tamperedInitData}`,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/invalid telegram signature|unauthorized/i),
        })
      );
    });

    it("returns 401 when initData has expired", () => {
      const expiredInitData = generateValidInitData({
        botToken: testBotToken,
        authDate: Math.floor(Date.now() / 1000) - 100000,
      });

      const req = {
        headers: {
          authorization: `tma ${expiredInitData}`,
        },
      } as unknown as AuthenticatedRequest;

      const res = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
