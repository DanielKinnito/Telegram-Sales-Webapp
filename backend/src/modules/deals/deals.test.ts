import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as crypto from "crypto";
import type { Server } from "http";
import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { DealsService } from "./dealsService.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { MockStorageProvider } from "../../services/storage/mockStorage.js";

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

describe("Deals API Endpoints (/api/deals)", () => {
  let server: Server;
  let baseUrl: string;
  let mockDealsService: Partial<DealsService>;
  let mockSalesRepsService: Partial<SalesRepsService>;
  let mockStorageProvider: MockStorageProvider;

  const repUserId = 998877;
  const repAuthHeader = `tma ${generateTestInitData(repUserId, "Rep Daniel", env.TELEGRAM_BOT_TOKEN)}`;

  beforeAll(async () => {
    mockDealsService = {
      submitPaymentProof: vi.fn(),
      getDeal: vi.fn(),
    };

    mockSalesRepsService = {
      findSalesRepByTelegramId: vi.fn(),
    };

    mockStorageProvider = new MockStorageProvider();

    const app = createApp({
      dealsService: mockDealsService as DealsService,
      salesRepsService: mockSalesRepsService as SalesRepsService,
      storageProvider: mockStorageProvider,
    });

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

  describe("POST /api/deals/:id/payment-proof", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${baseUrl}/api/deals/deal_123/payment-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositRef: "CBE-998811",
          proofUrl: "https://storage.example.com/receipt.jpg",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects inactive callers with 403 Forbidden", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(null);

      const res = await fetch(`${baseUrl}/api/deals/deal_123/payment-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: repAuthHeader,
        },
        body: JSON.stringify({
          depositRef: "CBE-998811",
          proofUrl: "https://storage.example.com/receipt.jpg",
        }),
      });

      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.error).toMatch(/Forbidden/i);
    });

    it("rejects missing transaction link with 400 Bad Request", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "998877",
        fullName: "Daniel Rep",
        status: "Active",
      });

      const res = await fetch(`${baseUrl}/api/deals/deal_123/payment-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: repAuthHeader,
        },
        body: JSON.stringify({
          depositRef: "CBE-TX-12345",
        }),
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toMatch(/valid transaction link/i);
    });

    it("rejects invalid proof URL with 400 Bad Request", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "998877",
        fullName: "Daniel Rep",
        status: "Active",
      });

      const res = await fetch(`${baseUrl}/api/deals/deal_123/payment-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: repAuthHeader,
        },
        body: JSON.stringify({
          depositRef: "CBE-998811",
          proofUrl: "not-a-url",
        }),
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toMatch(/valid transaction link/i);
    });

    it("returns 404 Not Found if deal is not found in Notion", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "998877",
        fullName: "Daniel Rep",
        status: "Active",
      });

      (mockDealsService.submitPaymentProof as any).mockRejectedValue(
        new Error("Deal not found: deal_missing")
      );

      const res = await fetch(`${baseUrl}/api/deals/deal_missing/payment-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: repAuthHeader,
        },
        body: JSON.stringify({
          depositRef: "CBE-998811",
          proofUrl: "https://storage.example.com/receipt.jpg",
        }),
      });

      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.error).toBe("Not Found");
    });

    it("successfully progresses deal and returns 200 with verification details", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "998877",
        fullName: "Daniel Rep",
        status: "Active",
      });

      (mockDealsService.submitPaymentProof as any).mockResolvedValue({
        success: true,
        deal: {
          pageId: "deal_p500",
          title: "Hardware Upgrade Agreement",
          stage: "Payment Pending Verification",
          amount: 600000,
          depositRef: "CBE-TX-554433",
          proofUrl: "https://storage.example.com/receipt-500.jpg",
        },
        managersNotified: 3,
      });

      const res = await fetch(`${baseUrl}/api/deals/deal_p500/payment-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: repAuthHeader,
        },
        body: JSON.stringify({
          depositRef: "CBE-TX-554433",
          proofUrl: "https://storage.example.com/receipt-500.jpg",
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.deal.stage).toBe("Payment Pending Verification");
      expect(data.deal.depositRef).toBe("CBE-TX-554433");
      expect(data.managersNotified).toBe(3);

      expect(mockDealsService.submitPaymentProof).toHaveBeenCalledWith({
        dealId: "deal_p500",
        depositRef: "CBE-TX-554433",
        proofUrl: "https://storage.example.com/receipt-500.jpg",
        submittedByTelegramId: 998877,
        submittedByName: "Daniel Rep",
      });
    });

    it("successfully progresses deal when depositRef is omitted (defaults to Bank Share Link)", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "998877",
        fullName: "Daniel Rep",
        status: "Active",
      });

      (mockDealsService.submitPaymentProof as any).mockResolvedValue({
        success: true,
        deal: {
          pageId: "deal_p501",
          title: "Fleet Fuel Agreement",
          stage: "Payment Pending Verification",
          amount: 300000,
          depositRef: "Bank Share Link",
          proofUrl: "https://cbe.et/tx/FT123456",
        },
        managersNotified: 2,
      });

      const res = await fetch(`${baseUrl}/api/deals/deal_p501/payment-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: repAuthHeader,
        },
        body: JSON.stringify({
          proofUrl: "https://cbe.et/tx/FT123456",
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.deal.depositRef).toBe("Bank Share Link");
    });
  });

  describe("GET /api/deals/:id", () => {
    it("returns deal details for authenticated user", async () => {
      (mockDealsService.getDeal as any).mockResolvedValue({
        pageId: "deal_123",
        title: "Coffee Export Contract",
        stage: "Proposal",
        amount: 800000,
        depositRef: null,
        proofUrl: null,
      });

      const res = await fetch(`${baseUrl}/api/deals/deal_123`, {
        headers: { Authorization: repAuthHeader },
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.deal.title).toBe("Coffee Export Contract");
    });
  });
});
