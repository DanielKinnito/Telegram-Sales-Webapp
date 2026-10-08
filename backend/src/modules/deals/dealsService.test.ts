import { describe, it, expect, vi, beforeEach } from "vitest";
import { DealsService } from "./dealsService.js";
import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";

describe("DealsService (Workflow D: Deal Progression & Payment Proof Links)", () => {
  let service: DealsService;
  let mockNotionClient: Partial<ResilientNotionClient>;
  let mockSalesRepsService: Partial<SalesRepsService>;
  let mockBot: any;

  beforeEach(() => {
    mockNotionClient = {
      retrievePage: vi.fn(),
      updatePage: vi.fn(),
      queryDatabase: vi.fn(),
    };

    mockSalesRepsService = {
      findSalesRepByTelegramId: vi.fn(),
    };

    mockBot = {
      api: {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 201 }),
      },
    };

    service = new DealsService({
      notionClient: mockNotionClient as ResilientNotionClient,
      salesRepsService: mockSalesRepsService as SalesRepsService,
      dealsDbId: "test_deals_db",
      managerChatIds: [10001, 10002],
      bot: mockBot,
    });
  });

  describe("submitPaymentProof", () => {
    it("rejects invalid transaction link (not http/https)", async () => {
      await expect(
        service.submitPaymentProof({
          dealId: "deal_p1",
          depositRef: "CBE-TX-12345",
          proofUrl: "not-a-valid-url",
          submittedByName: "Samuel Green",
        })
      ).rejects.toThrow(/valid transaction link/i);
    });

    it("throws 404 / Not Found error if deal does not exist in Notion", async () => {
      (mockNotionClient.retrievePage as any).mockRejectedValue(new Error("Page not found"));

      await expect(
        service.submitPaymentProof({
          dealId: "nonexistent_deal",
          depositRef: "CBE-TX-12345",
          proofUrl: "https://cbe.et/tx/12345",
          submittedByName: "Samuel Green",
        })
      ).rejects.toThrow(/Deal not found/i);
    });

    it("updates Deal stage in Notion to 'Payment Pending Verification' with bank share link", async () => {
      (mockNotionClient.retrievePage as any).mockResolvedValue({
        id: "deal_p1",
        properties: {
          "Deal Title": { title: [{ plain_text: "Awash Wine Supply Deal" }] },
          "Amount": { number: 450000 },
          "Stage": { select: { name: "Proposal" } },
        },
      });

      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "deal_p1" });

      const result = await service.submitPaymentProof({
        dealId: "deal_p1",
        depositRef: "FT2610234812",
        proofUrl: "https://telebirr.et/receipt/TB12345678",
        submittedByName: "Samuel Green",
      });

      expect(result.success).toBe(true);
      expect(result.deal.stage).toBe("Payment Pending Verification");
      expect(result.deal.depositRef).toBe("FT2610234812");
      expect(result.deal.proofUrl).toBe("https://telebirr.et/receipt/TB12345678");
      expect(result.deal.amount).toBe(450000);

      // Verify Notion updatePage payload
      expect(mockNotionClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          page_id: "deal_p1",
          properties: expect.objectContaining({
            "Stage": { select: { name: "Payment Pending Verification" } },
            "Deposit Ref #": { rich_text: [{ text: { content: "FT2610234812" } }] },
            "Payment Proof URL": {
              url: "https://telebirr.et/receipt/TB12345678",
            },
          }),
        })
      );
    });

    it("defaults depositRef to 'Bank Share Link' if omitted", async () => {
      (mockNotionClient.retrievePage as any).mockResolvedValue({
        id: "deal_p1",
        properties: {
          "Deal Title": { title: [{ plain_text: "Awash Wine Supply Deal" }] },
          "Amount": { number: 450000 },
          "Stage": { select: { name: "Proposal" } },
        },
      });

      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "deal_p1" });

      const result = await service.submitPaymentProof({
        dealId: "deal_p1",
        proofUrl: "https://cbe.et/tx/FT99887766",
        submittedByName: "Samuel Green",
      });

      expect(result.deal.depositRef).toBe("Bank Share Link");
      expect(mockNotionClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          page_id: "deal_p1",
          properties: expect.objectContaining({
            "Deposit Ref #": { rich_text: [{ text: { content: "Bank Share Link" } }] },
          }),
        })
      );
    });

    it("dispatches Telegram notifications to all configured Manager chat IDs with clickable link", async () => {
      (mockNotionClient.retrievePage as any).mockResolvedValue({
        id: "deal_p1",
        properties: {
          "Deal Title": { title: [{ plain_text: "Awash Wine Supply Deal" }] },
          "Amount": { number: 450000 },
          "Stage": { select: { name: "Proposal" } },
        },
      });

      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "deal_p1" });

      const result = await service.submitPaymentProof({
        dealId: "deal_p1",
        depositRef: "FT2610234812",
        proofUrl: "https://cbe.et/tx/FT2610234812",
        submittedByName: "Samuel Green",
      });

      expect(result.managersNotified).toBe(2);
      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        10001,
        expect.stringMatching(/Bank Payment Transaction Link Submitted/i),
        expect.anything()
      );
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        10002,
        expect.stringMatching(/Bank Payment Transaction Link Submitted/i),
        expect.anything()
      );
    });
  });
});
