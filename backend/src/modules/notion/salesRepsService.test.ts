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
            property: "Telegram ID",
            title: {
              equals: "12345678",
            },
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
                title: [{ plain_text: "12345678" }],
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
              title: [{ text: { content: "98765432" } }],
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
});
