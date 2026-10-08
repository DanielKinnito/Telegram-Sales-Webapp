import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as crypto from "crypto";
import type { Server } from "http";
import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { QueueService, NoAvailableRepsError } from "./queueService.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";

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

describe("Queue Walk-In API Endpoints (/api/queue)", () => {
  let server: Server;
  let baseUrl: string;
  let mockQueueService: Partial<QueueService>;
  let mockSalesRepsService: Partial<SalesRepsService>;

  const staffUserId = 556677;
  const staffAuthHeader = `tma ${generateTestInitData(staffUserId, "Front Desk Martha", env.TELEGRAM_BOT_TOKEN)}`;

  beforeAll(async () => {
    mockQueueService = {
      assignWalkIn: vi.fn(),
      getNextAvailableRep: vi.fn(),
    };

    mockSalesRepsService = {
      findSalesRepByTelegramId: vi.fn(),
    };

    const app = createApp({
      queueService: mockQueueService as QueueService,
      salesRepsService: mockSalesRepsService as SalesRepsService,
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

  describe("POST /api/queue/assign", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${baseUrl}/api/queue/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: "Blue Nile Transport",
          tin: "0011223344",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects non-active staff callers with 403 Forbidden", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(null);

      const res = await fetch(`${baseUrl}/api/queue/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: staffAuthHeader,
        },
        body: JSON.stringify({
          companyName: "Blue Nile Transport",
          tin: "0011223344",
        }),
      });

      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.error).toMatch(/Forbidden/i);
    });

    it("rejects missing companyName with 400 Bad Request", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "staff_page_1",
        telegramId: "556677",
        fullName: "Martha Receptionist",
        role: "Front Desk",
        status: "Active",
      });

      const res = await fetch(`${baseUrl}/api/queue/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: staffAuthHeader,
        },
        body: JSON.stringify({
          companyName: "   ",
          tin: "0011223344",
        }),
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toMatch(/Company Name is required/i);
    });

    it("rejects invalid TIN length with 400 Bad Request", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "staff_page_1",
        telegramId: "556677",
        fullName: "Martha Receptionist",
        role: "Front Desk",
        status: "Active",
      });

      const res = await fetch(`${baseUrl}/api/queue/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: staffAuthHeader,
        },
        body: JSON.stringify({
          companyName: "Blue Nile Transport",
          tin: "999", // invalid
        }),
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toMatch(/10 numeric digits/i);
    });

    it("returns 422 Unprocessable Entity when no sales reps are available in queue", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "staff_page_1",
        telegramId: "556677",
        fullName: "Martha Receptionist",
        role: "Front Desk",
        status: "Active",
      });

      (mockQueueService.assignWalkIn as any).mockRejectedValue(
        new NoAvailableRepsError("No sales representatives are currently available in the queue.")
      );

      const res = await fetch(`${baseUrl}/api/queue/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: staffAuthHeader,
        },
        body: JSON.stringify({
          companyName: "Blue Nile Transport",
          tin: "0011223344",
        }),
      });

      expect(res.status).toBe(422);
      const data: any = await res.json();
      expect(data.error).toBe("Unprocessable Entity");
      expect(data.message).toMatch(/No sales representatives are currently available/i);
    });

    it("returns 409 Conflict when TIN is duplicate", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "staff_page_1",
        telegramId: "556677",
        fullName: "Martha Receptionist",
        role: "Front Desk",
        status: "Active",
      });

      (mockQueueService.assignWalkIn as any).mockRejectedValue(
        new Error("Duplicate registration blocked. Registered under John Doe on 2026-10-01.")
      );

      const res = await fetch(`${baseUrl}/api/queue/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: staffAuthHeader,
        },
        body: JSON.stringify({
          companyName: "Blue Nile Transport",
          tin: "0011223344",
        }),
      });

      expect(res.status).toBe(409);
      const data: any = await res.json();
      expect(data.error).toBe("Conflict");
      expect(data.message).toContain("Duplicate registration blocked");
    });

    it("successfully assigns walk-in lead and returns 201 Created", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "staff_page_1",
        telegramId: "556677",
        fullName: "Martha Receptionist",
        role: "Front Desk",
        status: "Active",
      });

      (mockQueueService.assignWalkIn as any).mockResolvedValue({
        success: true,
        account: {
          pageId: "acc_page_walkin_99",
          companyName: "Blue Nile Transport",
          tin: "0011223344",
          address: "Bole Medhanialem",
          industry: "Logistics",
          assignedDate: "2026-10-08",
          assignedRep: {
            pageId: "rep_p123",
            telegramId: "123456",
            fullName: "Bereket Tadesse",
          },
        },
        notificationSent: true,
      });

      const res = await fetch(`${baseUrl}/api/queue/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: staffAuthHeader,
        },
        body: JSON.stringify({
          companyName: "Blue Nile Transport",
          tin: "0011223344",
          address: "Bole Medhanialem",
          industry: "Logistics",
          contactName: "Solomon K",
          contactPhone: "+251911334455",
        }),
      });

      expect(res.status).toBe(201);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.account.companyName).toBe("Blue Nile Transport");
      expect(data.account.assignedRep.fullName).toBe("Bereket Tadesse");
      expect(data.notificationSent).toBe(true);

      expect(mockQueueService.assignWalkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: "Blue Nile Transport",
          tin: "0011223344",
          address: "Bole Medhanialem",
          industry: "Logistics",
          assignedByStaffName: "Martha Receptionist",
        })
      );
    });
  });
});
