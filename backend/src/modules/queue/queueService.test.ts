import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueueService, NoAvailableRepsError } from "./queueService.js";
import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import type { LeadsService } from "../leads/leadsService.js";

describe("QueueService (Round-Robin Engine)", () => {
  let service: QueueService;
  let mockNotionClient: Partial<ResilientNotionClient>;
  let mockSalesRepsService: Partial<SalesRepsService>;
  let mockLeadsService: Partial<LeadsService>;
  let mockBot: any;

  beforeEach(() => {
    mockNotionClient = {
      queryDatabase: vi.fn(),
      updatePage: vi.fn(),
      createPage: vi.fn(),
    };
    mockSalesRepsService = {
      findSalesRepByTelegramId: vi.fn(),
    };
    mockLeadsService = {
      checkTin: vi.fn(),
    };
    mockBot = {
      api: {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 101 }),
      },
    };

    service = new QueueService({
      notionClient: mockNotionClient as ResilientNotionClient,
      salesRepsService: mockSalesRepsService as SalesRepsService,
      leadsService: mockLeadsService as LeadsService,
      queueDbId: "test_queue_db",
      accountsDbId: "test_accounts_db",
      bot: mockBot,
    });
  });

  describe("getNextAvailableRep", () => {
    it("throws NoAvailableRepsError if no reps are marked Available", async () => {
      (mockNotionClient.queryDatabase as any).mockResolvedValue({ results: [] });

      await expect(service.getNextAvailableRep()).rejects.toThrow(NoAvailableRepsError);
    });

    it("selects the rep with the oldest Last Assigned Timestamp", async () => {
      // Rep 1 assigned 2 hours ago, Rep 2 assigned yesterday, Rep 3 never assigned (null)
      const queueResults = [
        {
          id: "queue_page_rep1",
          properties: {
            "Rep ID": { title: [{ plain_text: "111" }] },
            "Availability Status": { select: { name: "Available" } },
            "Last Assigned Timestamp": { date: { start: "2026-10-08T14:00:00.000Z" } },
          },
        },
        {
          id: "queue_page_rep3",
          properties: {
            "Rep ID": { title: [{ plain_text: "333" }] },
            "Availability Status": { select: { name: "Available" } },
            "Last Assigned Timestamp": null, // Never assigned -> highest priority
          },
        },
        {
          id: "queue_page_rep2",
          properties: {
            "Rep ID": { title: [{ plain_text: "222" }] },
            "Availability Status": { select: { name: "Available" } },
            "Last Assigned Timestamp": { date: { start: "2026-10-07T10:00:00.000Z" } },
          },
        },
      ];

      (mockNotionClient.queryDatabase as any).mockResolvedValue({ results: queueResults });

      (mockSalesRepsService.findSalesRepByTelegramId as any).mockImplementation(async (id: string) => {
        return {
          pageId: `rep_page_${id}`,
          telegramId: id,
          fullName: `Rep ${id}`,
          phone: "+251911000000",
          role: "Sales Rep",
          status: "Active",
        };
      });

      const chosen = await service.getNextAvailableRep();

      // Rep 333 had null timestamp, so it should be picked first!
      expect(chosen.telegramId).toBe("333");
      expect(chosen.queuePageId).toBe("queue_page_rep3");
      expect(chosen.fullName).toBe("Rep 333");
    });
  });

  describe("assignWalkIn", () => {
    it("rejects non-10 digit TINs", async () => {
      await expect(
        service.assignWalkIn({
          companyName: "Ethio Coffee",
          tin: "12345", // invalid
          assignedByStaffName: "Front Desk Receptionist",
        })
      ).rejects.toThrow(/10 numeric digits/i);
    });

    it("rejects duplicate TINs when checkTin reports conflict", async () => {
      (mockLeadsService.checkTin as any).mockResolvedValue({
        available: false,
        message: "Duplicate registration blocked.",
      });

      await expect(
        service.assignWalkIn({
          companyName: "Duplicate Corp",
          tin: "0012345678",
          assignedByStaffName: "Front Desk Receptionist",
        })
      ).rejects.toThrow(/Duplicate registration blocked/i);
    });

    it("assigns lead, updates queue timestamp, creates Account, and dispatches Telegram notification", async () => {
      (mockLeadsService.checkTin as any).mockResolvedValue({ available: true });

      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "queue_p1",
            properties: {
              "Rep ID": { title: [{ plain_text: "777888" }] },
              "Availability Status": { select: { name: "Available" } },
              "Last Assigned Timestamp": { date: { start: "2026-10-01T10:00:00.000Z" } },
            },
          },
        ],
      });

      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "rep_p777",
        telegramId: "777888",
        fullName: "Samuel Green",
        phone: "+251911999888",
        role: "Sales Rep",
        status: "Active",
      });

      (mockNotionClient.createPage as any).mockResolvedValue({ id: "acc_page_walkin_1" });
      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "queue_p1" });

      const result = await service.assignWalkIn({
        companyName: "Oromia Seeds PLC",
        tin: "0012345678",
        address: "Megenagna, Addis Ababa",
        industry: "Manufacturing",
        assignedByStaffName: "Front Desk Sarah",
      });

      expect(result.success).toBe(true);
      expect(result.account.pageId).toBe("acc_page_walkin_1");
      expect(result.account.companyName).toBe("Oromia Seeds PLC");
      expect(result.account.assignedRep.fullName).toBe("Samuel Green");
      expect(result.notificationSent).toBe(true);

      // Verifies queue timestamp updated
      expect(mockNotionClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          page_id: "queue_p1",
          properties: expect.objectContaining({
            "Last Assigned Timestamp": expect.objectContaining({
              date: expect.any(Object),
            }),
          }),
        })
      );

      // Verifies Account created in Notion with Owner relation
      expect(mockNotionClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { database_id: "test_accounts_db" },
          properties: expect.objectContaining({
            "Name": {
              title: [{ text: { content: "Oromia Seeds PLC" } }],
            },
            "TIN Number": {
              rich_text: [{ text: { content: "0012345678" } }],
            },
            "Owner": {
              relation: [{ id: "rep_p777" }],
            },
          }),
        })
      );

      // Verifies Telegram notification dispatched to assigned rep
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        777888,
        expect.stringMatching(/New Walk-In Lead Assigned/i),
        expect.anything()
      );
    });
  });
});
