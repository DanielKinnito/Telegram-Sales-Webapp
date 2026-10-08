import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as crypto from "crypto";
import type { Server } from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

function generateTestInitData(userId: number, firstName: string, botToken: string) {
  const authDate = Math.floor(Date.now() / 1000);
  const user = { id: userId, first_name: firstName };

  const dataMap = new Map<string, string>();
  dataMap.set("auth_date", authDate.toString());
  dataMap.set("user", JSON.stringify(user));

  const sortedPairs = Array.from(dataMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);

  const dataCheckString = sortedPairs.join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const params = new URLSearchParams();
  for (const [key, val] of dataMap.entries()) {
    params.set(key, val);
  }
  params.set("hash", hash);
  return params.toString();
}

describe("Express App Integration (HTTP)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("GET /health returns 200 with service status", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("telegram-sales-backend");
  });

  it("GET /api/auth/me rejects unauthorized requests with 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);

    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/missing or malformed/i);
  });

  it("GET /api/auth/me allows requests with valid Telegram HMAC initData", async () => {
    const initData = generateTestInitData(445566, "Alice", env.TELEGRAM_BOT_TOKEN);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `tma ${initData}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; user: { id: number; firstName: string } };
    expect(body.success).toBe(true);
    expect(body.user.id).toBe(445566);
    expect(body.user.firstName).toBe("Alice");
  });
});
