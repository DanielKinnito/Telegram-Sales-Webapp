import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as crypto from "crypto";
import type { Server } from "http";
import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { InventoryService } from "./inventoryService.js";

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

describe("Inventory API Endpoints (/api/inventory)", () => {
  let server: Server;
  let baseUrl: string;
  let mockInventoryService: any;
  let mockSalesRepsService: any;

  beforeAll(async () => {
    mockInventoryService = new InventoryService();
    mockSalesRepsService = {
      findSalesRepByTelegramId: vi.fn().mockImplementation((id: number) => {
        if (id === 1001) {
          return Promise.resolve({
            fullName: "Selamawit Tadesse",
            role: "Front Desk",
            status: "Active",
          });
        }
        if (id === 9999) {
          return Promise.resolve({
            fullName: "Daniel Mekonnen",
            role: "Manager",
            status: "Active",
          });
        }
        return Promise.resolve(null);
      }),
    };

    const app = createApp({
      inventoryService: mockInventoryService,
      salesRepsService: mockSalesRepsService,
      bot: {
        api: {
          sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
        },
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("GET /api/inventory returns catalog items for authenticated staff", async () => {
    const initData = generateTestInitData(1001, "Selamawit", env.TELEGRAM_BOT_TOKEN);
    const res = await fetch(`${baseUrl}/api/inventory`, {
      headers: {
        Authorization: `tma ${initData}`,
      },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.catalog)).toBe(true);
    expect(body.catalog.length).toBeGreaterThan(0);
    expect(body.catalog.some((i: any) => i.itemCode === "YC345GF")).toBe(true);
  });

  it("POST /api/inventory/adjust-request allows Front Desk to submit adjustment request", async () => {
    const initData = generateTestInitData(1001, "Selamawit", env.TELEGRAM_BOT_TOKEN);
    const res = await fetch(`${baseUrl}/api/inventory/adjust-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `tma ${initData}`,
      },
      body: JSON.stringify({
        itemCode: "YC345GF",
        delta: 2,
        reason: "New delivery from factory",
      }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.adjustment).toBeDefined();
    expect(body.adjustment.itemCode).toBe("YC345GF");
    expect(body.adjustment.delta).toBe(2);
    expect(body.adjustment.status).toBe("Pending");
  });

  it("POST /api/inventory/adjust-direct allows Manager to directly adjust stock", async () => {
    const initData = generateTestInitData(9999, "Daniel", env.TELEGRAM_BOT_TOKEN);
    const res = await fetch(`${baseUrl}/api/inventory/adjust-direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `tma ${initData}`,
      },
      body: JSON.stringify({
        itemCode: "YC345GF",
        newQuantity: 15,
        reason: "Annual audit recount",
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.item.quantityInStock).toBe(15);
  });
});
