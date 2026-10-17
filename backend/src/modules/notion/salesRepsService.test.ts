import { describe, it, expect, vi, beforeEach } from "vitest";
import { SalesRepsService } from "./salesRepsService.js";
import type { ResilientNotionClient } from "./notionClient.js";

describe("SalesRepsService", () => {
  let mockNotionClient: Partial<ResilientNotionClient>;
  let service: SalesRepsService;
  const mockDbId = "sales_reps_db_test_id";

  beforeEach(() => {
    mockNotionClient = {
      queryDatabase: vi.fn(),
      createPage: vi.fn(),
      updatePage: vi.fn(),
    };
    service = new SalesRepsService(mockNotionClient as ResilientNotionClient, mockDbId);
  });

  describe("findSalesRepByTelegramId", () => {
    it("returns null when no sales rep exists with matching telegramId", async () => {
      (mockNotionClient.queryDatabase as any).mockResolvedValue({ results: [] });

      const result = await service.findSalesRepByTelegramId("12345678");

      expect(result).toBeNull();
      expect(mockNotionClient.queryDatabase).toHaveBeenCalledWith(
        mockDbId,
        expect.objectContaining({
          filter: {
            or: [
              {
                property: "Telegram User ID",
                rich_text: {
                  equals: "12345678",
                },
              },
              {
                property: "Telegram ID",
                title: {
                  equals: "12345678",
                },
              },
            ],
          },
        })
      );
    });

    it("parses and returns sales rep record when found", async () => {
      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "page_rep_1",
            properties: {
              "Telegram ID": {
                title: [{ plain_text: "John Doe" }],
              },
              "Telegram User ID": {
                rich_text: [{ plain_text: "12345678" }],
              },
              "Full Name": {
                rich_text: [{ plain_text: "John Doe" }],
              },
              "Phone": {
                phone_number: "+1234567890",
              },
              "Role": {
                select: { name: "Sales Rep" },
              },
              "Status": {
                select: { name: "Active" },
              },
            },
          },
        ],
      });

      const rep = await service.findSalesRepByTelegramId("12345678");

      expect(rep).not.toBeNull();
      expect(rep?.pageId).toBe("page_rep_1");
      expect(rep?.telegramId).toBe("12345678");
      expect(rep?.fullName).toBe("John Doe");
      expect(rep?.phone).toBe("+1234567890");
      expect(rep?.role).toBe("Sales Rep");
      expect(rep?.status).toBe("Active");
    });
  });

  describe("createSalesRep", () => {
    it("creates a page in Notion with Pending Approval status and returns record", async () => {
      (mockNotionClient.createPage as any).mockResolvedValue({
        id: "new_page_rep_2",
      });

      const rep = await service.createSalesRep({
        telegramId: "98765432",
        fullName: "Sarah Connor",
        phone: "+9876543210",
        role: "Front Desk",
      });

      expect(rep.pageId).toBe("new_page_rep_2");
      expect(rep.telegramId).toBe("98765432");
      expect(rep.fullName).toBe("Sarah Connor");
      expect(rep.phone).toBe("+9876543210");
      expect(rep.role).toBe("Front Desk");
      expect(rep.status).toBe("Pending Approval");

      expect(mockNotionClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { database_id: mockDbId },
          properties: expect.objectContaining({
            "Telegram ID": {
              title: [{ text: { content: "Sarah Connor" } }],
            },
            "Telegram User ID": {
              rich_text: [{ text: { content: "98765432" } }],
            },
            "Full Name": {
              rich_text: [{ text: { content: "Sarah Connor" } }],
            },
            "Phone": {
              phone_number: "+9876543210",
            },
            "Role": {
              select: { name: "Front Desk" },
            },
            "Status": {
              select: { name: "Pending Approval" },
            },
          }),
        })
      );
    });
  });

  describe("updateSalesRepStatus", () => {
    it("updates Notion page status to Active", async () => {
      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "page_rep_1" });

      await service.updateSalesRepStatus("page_rep_1", "Active");

      expect(mockNotionClient.updatePage).toHaveBeenCalledWith({
        page_id: "page_rep_1",
        properties: {
          Status: {
            select: { name: "Active" },
          },
        },
      });
    });
  });

  describe("getActiveManagerChatIds & isManager", () => {
    it("queries Notion for active managers and caches results", async () => {
      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "mgr_page_1",
            properties: {
              "Telegram User ID": { rich_text: [{ plain_text: "777001" }] },
              "Role": { select: { name: "Manager" } },
              "Status": { select: { name: "Active" } },
            },
          },
          {
            id: "mgr_page_2",
            properties: {
              "Telegram ID": { rich_text: [{ plain_text: "777002" }] },
              "Role": { select: { name: "Manager" } },
              "Status": { select: { name: "Active" } },
            },
          },
        ],
      });

      const managerIds = await service.getActiveManagerChatIds([999001]);

      expect(managerIds).toContain(777001);
      expect(managerIds).toContain(777002);
      expect(managerIds).toContain(999001);

      // Verify filter passed to Notion
      expect(mockNotionClient.queryDatabase).toHaveBeenCalledWith(
        mockDbId,
        expect.objectContaining({
          filter: {
            and: [
              { property: "Status", select: { equals: "Active" } },
              { property: "Role", select: { equals: "Manager" } },
            ],
          },
        })
      );

      // Second call should hit in-memory cache without calling Notion again
      (mockNotionClient.queryDatabase as any).mockClear();
      const cachedManagerIds = await service.getActiveManagerChatIds([999001]);
      expect(mockNotionClient.queryDatabase).not.toHaveBeenCalled();
      expect(cachedManagerIds).toEqual(managerIds);

      // After cache invalidation, next call queries Notion again
      service.invalidateManagerCache();
      await service.getActiveManagerChatIds([999001]);
      expect(mockNotionClient.queryDatabase).toHaveBeenCalledTimes(1);
    });

    it("falls back to fallbackIds if Notion query fails", async () => {
      service.invalidateManagerCache();
      (mockNotionClient.queryDatabase as any).mockRejectedValue(new Error("Notion network timeout"));

      const fallbackIds = [888001, 888002];
      const managerIds = await service.getActiveManagerChatIds(fallbackIds);

      expect(managerIds).toEqual(fallbackIds);
    });

    it("evaluates isManager correctly for fallback IDs, Notion managers, and non-managers", async () => {
      service.invalidateManagerCache();
      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "mgr_page_1",
            properties: {
              "Telegram User ID": { rich_text: [{ plain_text: "777001" }] },
            },
          },
        ],
      });

      // 1. Fallback ID from .env
      expect(await service.isManager(999001, [999001])).toBe(true);

      // 2. Dynamic Notion Manager
      expect(await service.isManager(777001, [999001])).toBe(true);

      // 3. Regular Rep (not a manager)
      (mockNotionClient.queryDatabase as any).mockResolvedValueOnce({ results: [] }); // For findSalesRep fallback
      expect(await service.isManager(12345, [999001])).toBe(false);
    });
  });
});
