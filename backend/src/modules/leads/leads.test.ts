import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as crypto from "crypto";
import type { Server } from "http";
import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { LeadsService } from "./leadsService.js";
import { TinCache } from "./tinCache.js";

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

describe("Leads API Endpoints (/api/leads)", () => {
  let server: Server;
  let baseUrl: string;
  let mockLeadsService: Partial<LeadsService>;

  const authHeader = `tma ${generateTestInitData(112233, "Tester Rep", env.TELEGRAM_BOT_TOKEN)}`;

  beforeAll(async () => {
    mockLeadsService = {
      checkTin: vi.fn(),
      registerLead: vi.fn(),
    };

    const app = createApp({ leadsService: mockLeadsService as LeadsService });

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

  describe("POST /api/leads/check-tin", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${baseUrl}/api/leads/check-tin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tin: "0012345678" }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects invalid TIN length with 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/api/leads/check-tin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ tin: "12345" }),
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toMatch(/10 numeric digits/i);
    });

    it("returns 200 available = true when TIN is unique", async () => {
      (mockLeadsService.checkTin as any).mockResolvedValue({
        available: true,
        message: "TIN is available for registration.",
      });

      const res = await fetch(`${baseUrl}/api/leads/check-tin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ tin: "0012345678" }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.available).toBe(true);
    });

    it("returns 409 Conflict with ownership details when TIN is duplicate", async () => {
      (mockLeadsService.checkTin as any).mockResolvedValue({
        available: false,
        message: "Company registered under Abebe Bikila on 2026-10-01. Duplicate registration blocked.",
        conflict: {
          companyName: "Horn Trade PLC",
          ownerName: "Abebe Bikila",
          assignedDate: "2026-10-01",
        },
      });

      const res = await fetch(`${baseUrl}/api/leads/check-tin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ tin: "0012345678" }),
      });

      expect(res.status).toBe(409);
      const data: any = await res.json();
      expect(data.available).toBe(false);
      expect(data.message).toContain("Duplicate registration blocked");
      expect(data.conflict.ownerName).toBe("Abebe Bikila");
    });
  });

  describe("POST /api/leads/register", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${baseUrl}/api/leads/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: "Addis Trading",
          tin: "0012345678",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects invalid TIN with 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/api/leads/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          companyName: "Addis Trading",
          tin: "123", // invalid
        }),
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toMatch(/10 numeric digits/i);
    });

    it("registers lead and returns 201 Created using authenticated Telegram ID", async () => {
      (mockLeadsService.registerLead as any).mockResolvedValue({
        pageId: "page_new_acc",
        companyName: "Addis Trading",
        tin: "0012345678",
        assignedDate: "2026-10-08",
        owner: {
          telegramId: "112233",
          fullName: "Tester Rep",
        },
      });

      const res = await fetch(`${baseUrl}/api/leads/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          companyName: "Addis Trading",
          tin: "0012345678",
          address: "Bole",
          industry: "Technology",
        }),
      });

      expect(res.status).toBe(201);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.account.companyName).toBe("Addis Trading");
      expect(data.account.owner.telegramId).toBe("112233");

      expect(mockLeadsService.registerLead).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: 112233,
          companyName: "Addis Trading",
          tin: "0012345678",
        })
      );
    });
  });
});
