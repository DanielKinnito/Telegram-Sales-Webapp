import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadsService } from "./leadsService.js";
import { TinCache } from "./tinCache.js";
import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService, SalesRepRecord } from "../notion/salesRepsService.js";

describe("LeadsService", () => {
  let service: LeadsService;
  let cache: TinCache;
  let mockNotionClient: Partial<ResilientNotionClient>;
  let mockSalesRepsService: Partial<SalesRepsService>;

  beforeEach(() => {
    cache = new TinCache();
    mockNotionClient = {
      queryDatabase: vi.fn(),
      createPage: vi.fn(),
      retrievePage: vi.fn(),
    };
    mockSalesRepsService = {
      findSalesRepByTelegramId: vi.fn(),
    };
    service = new LeadsService({
      notionClient: mockNotionClient as ResilientNotionClient,
      salesRepsService: mockSalesRepsService as SalesRepsService,
      tinCache: cache,
      accountsDbId: "test_accounts_db",
    });
  });

  describe("checkTin", () => {
    it("rejects invalid TIN format (not 10 digits) with ValidationError", async () => {
      await expect(service.checkTin("12345")).rejects.toThrow(/10 numeric digits/i);
      await expect(service.checkTin("abcdefghij")).rejects.toThrow(/10 numeric digits/i);
    });

    it("returns available = true for an unregistered 10-digit TIN", async () => {
      (mockNotionClient.queryDatabase as any).mockResolvedValue({ results: [] });

      const result = await service.checkTin("0012345678");

      expect(result.available).toBe(true);
      expect(result.message).toMatch(/available/i);
    });

    it("detects conflict from in-memory cache and returns exact block message", async () => {
      cache.set("0012345678", {
        companyName: "Zenith Tech",
        ownerName: "Helen Bekele",
        assignedDate: "2026-09-20",
        pageId: "page_zenith",
      });

      const result = await service.checkTin("0012345678");

      expect(result.available).toBe(false);
      expect(result.conflict?.companyName).toBe("Zenith Tech");
      expect(result.conflict?.ownerName).toBe("Helen Bekele");
      expect(result.message).toContain("Company registered under Helen Bekele on 2026-09-20");
      expect(result.message).toContain("Duplicate registration blocked");

      // Verifies zero Notion queries made when cache hits
      expect(mockNotionClient.queryDatabase).not.toHaveBeenCalled();
    });

    it("detects conflict from Notion if not yet in cache and populates cache", async () => {
      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "page_omega",
            properties: {
              "Company Name": { title: [{ plain_text: "Omega PLC" }] },
              "TIN Number": { rich_text: [{ plain_text: "9988776655" }] },
              "Assigned Date": { date: { start: "2026-10-05" } },
              "Owner": { relation: [{ id: "rep_page_omega" }] },
            },
          },
        ],
      });
      (mockNotionClient.retrievePage as any).mockResolvedValue({
        id: "rep_page_omega",
        properties: {
          "Full Name": { rich_text: [{ plain_text: "Yonas Alemu" }] },
        },
      });

      const result = await service.checkTin("9988776655");

      expect(result.available).toBe(false);
      expect(result.conflict?.companyName).toBe("Omega PLC");
      expect(result.conflict?.ownerName).toBe("Yonas Alemu");

      // Verifies it is now cached in memory
      expect(cache.has("9988776655")).toBe(true);
    });
  });

  describe("registerLead", () => {
    const activeRep: SalesRepRecord = {
      pageId: "rep_page_10",
      telegramId: "123456",
      fullName: "Kassahun Desta",
      phone: "+251911112233",
      role: "Sales Rep",
      status: "Active",
    };

    it("rejects registration if the caller is not an Active sales rep", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(null);

      await expect(
        service.registerLead({
          telegramUserId: 999,
          companyName: "New Corp",
          tin: "0012345678",
        })
      ).rejects.toThrow(/active sales representative/i);
    });

    it("rejects registration if the caller is Pending Approval", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        ...activeRep,
        status: "Pending Approval",
      });

      await expect(
        service.registerLead({
          telegramUserId: 123456,
          companyName: "New Corp",
          tin: "0012345678",
        })
      ).rejects.toThrow(/active sales representative/i);
    });

    it("rejects registration if TIN is already taken", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(activeRep);
      cache.set("0012345678", {
        companyName: "Existing Corp",
        ownerName: "Other Rep",
        assignedDate: "2026-10-01",
        pageId: "page_exist",
      });

      await expect(
        service.registerLead({
          telegramUserId: 123456,
          companyName: "Duplicate Attempt",
          tin: "0012345678",
        })
      ).rejects.toThrow(/Duplicate registration blocked/i);
    });

    it("creates Account in Notion, links to calling Rep, and seeds the cache", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(activeRep);
      (mockNotionClient.queryDatabase as any).mockResolvedValue({ results: [] });
      (mockNotionClient.createPage as any).mockResolvedValue({ id: "new_account_page_1" });

      const account = await service.registerLead({
        telegramUserId: 123456,
        companyName: "Abyssinia Trading",
        tin: "0012345678",
        address: "Bole Medhanialem, Addis Ababa",
        industry: "Retail",
      });

      expect(account.pageId).toBe("new_account_page_1");
      expect(account.companyName).toBe("Abyssinia Trading");
      expect(account.tin).toBe("0012345678");
      expect(account.owner.fullName).toBe("Kassahun Desta");

      // Verified Notion createPage payload
      expect(mockNotionClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { database_id: "test_accounts_db" },
          properties: expect.objectContaining({
            "Name": {
              title: [{ text: { content: "Abyssinia Trading" } }],
            },
            "TIN Number": {
              rich_text: [{ text: { content: "0012345678" } }],
            },
            "Owner": {
              relation: [{ id: "rep_page_10" }],
            },
          }),
        })
      );

      // Verifies cache is updated immediately
      expect(cache.has("0012345678")).toBe(true);
      expect(cache.get("0012345678")?.companyName).toBe("Abyssinia Trading");
      expect(cache.get("0012345678")?.ownerName).toBe("Kassahun Desta");
    });
  });
});
