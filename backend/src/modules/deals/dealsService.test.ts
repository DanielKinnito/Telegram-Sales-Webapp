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
      createPage: vi.fn(),
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

    it("dynamically queries active Notion managers via salesRepsService and sends alerts to them", async () => {
      (mockNotionClient.retrievePage as any).mockResolvedValue({
        id: "deal_p1",
        properties: {
          "Deal Title": { title: [{ plain_text: "Awash Wine Supply Deal" }] },
          "Amount": { number: 450000 },
          "Stage": { select: { name: "Proposal" } },
        },
      });
      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "deal_p1" });

      mockSalesRepsService.getActiveManagerChatIds = vi.fn().mockResolvedValue([555001, 555002, 555003]);

      const result = await service.submitPaymentProof({
        dealId: "deal_p1",
        depositRef: "FT2610234812",
        proofUrl: "https://cbe.et/tx/FT2610234812",
        submittedByName: "Samuel Green",
      });

      expect(mockSalesRepsService.getActiveManagerChatIds).toHaveBeenCalledWith([10001, 10002]);
      expect(result.managersNotified).toBe(3);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(555001, expect.anything(), expect.anything());
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(555002, expect.anything(), expect.anything());
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(555003, expect.anything(), expect.anything());
    });
  });

  describe("updateDealStage", () => {
    it("updates stage to 'Won' and records timeline log", async () => {
      (mockNotionClient.retrievePage as any).mockResolvedValue({
        id: "deal_p1",
        properties: {
          "Deal Title": { title: [{ plain_text: "Awash Wine Supply Deal" }] },
          "Amount": { number: 450000 },
          "Stage": { select: { name: "Proposal" } },
        },
      });

      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "deal_p1" });
      (mockNotionClient.createPage as any).mockResolvedValue({ id: "log_1" });

      const result = await service.updateDealStage("deal_p1", {
        stage: "Won",
      });

      expect(result.stage).toBe("Won");
      expect(mockNotionClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          page_id: "deal_p1",
          properties: expect.objectContaining({
            Stage: { select: { name: "Won" } },
          }),
        })
      );
    });

    it("updates stage to 'Lost' with reason", async () => {
      (mockNotionClient.retrievePage as any).mockResolvedValue({
        id: "deal_p1",
        properties: {
          "Deal Title": { title: [{ plain_text: "Awash Wine Supply Deal" }] },
          "Amount": { number: 450000 },
          "Stage": { select: { name: "Proposal" } },
        },
      });

      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "deal_p1" });
      (mockNotionClient.createPage as any).mockResolvedValue({ id: "log_2" });

      const result = await service.updateDealStage("deal_p1", {
        stage: "Lost",
        reason: "Customer chose competitor generator due to immediate stock availability.",
      });

      expect(result.stage).toBe("Lost");
      expect(result.lostReason).toBe("Customer chose competitor generator due to immediate stock availability.");
      expect(mockNotionClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          page_id: "deal_p1",
          properties: expect.objectContaining({
            Stage: { select: { name: "Lost" } },
            "Lost Reason": {
              rich_text: [{ text: { content: "Customer chose competitor generator due to immediate stock availability." } }],
            },
          }),
        })
      );
    });
  });

  describe("submitProposedOffer", () => {
    it("updates equipment type and VAT-inclusive amount for proposal", async () => {
      (mockNotionClient.retrievePage as any).mockResolvedValue({
        id: "deal_p1",
        properties: {
          "Deal Title": { title: [{ plain_text: "Sunshine Construction" }] },
          "Amount": { number: null },
          "Stage": { select: { name: "New" } },
        },
      });

      (mockNotionClient.updatePage as any).mockResolvedValue({ id: "deal_p1" });
      (mockNotionClient.createPage as any).mockResolvedValue({ id: "log_3" });

      const result = await service.submitProposedOffer("deal_p1", {
        productType: "Cummins 100kVA Soundproof Generator",
        offerAmount: 1850000,
      });

      expect(result.stage).toBe("Proposal");
      expect(result.productType).toBe("Cummins 100kVA Soundproof Generator");
      expect(result.amount).toBe(1850000);
      expect(mockNotionClient.updatePage).toHaveBeenCalledWith(
        expect.objectContaining({
          page_id: "deal_p1",
          properties: expect.objectContaining({
            Stage: { select: { name: "Proposal" } },
            "Product Type": {
              rich_text: [{ text: { content: "Cummins 100kVA Soundproof Generator" } }],
            },
            "Offer VAT Incl": { number: 1850000 },
          }),
        })
      );
    });
  });

  describe("addActivity", () => {
    it("formats scheduled time in 12-hour AM/PM format and logs rep full name", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "123456",
        fullName: "Daniel Mekonnen",
      });

      (mockNotionClient.createPage as any).mockResolvedValue({ id: "log_act_1" });

      const result = await service.addActivity({
        dealId: "deal_p1",
        repTelegramId: "123456",
        type: "Call",
        content: "Follow up regarding generator delivery timeframe",
        scheduledDate: "2026-10-20",
        scheduledTime: "14:30",
      });

      expect(result.pageId).toBe("log_act_1");
      expect(mockNotionClient.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            "Rep ID": {
              rich_text: [{ text: { content: "Daniel Mekonnen (123456)" } }],
            },
            "Scheduled Time": {
              rich_text: [{ text: { content: "2:30 PM" } }],
            },
          }),
        })
      );
    });
  });

  describe("searchDeals", () => {
    it("matches deals by company name or deal title with natural multi-word query", async () => {
      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "deal_inova_1",
            properties: {
              "Deal Title": { title: [{ plain_text: "Inova PLC Order" }] },
              Stage: { select: { name: "Proposal" } },
              "Account Name": { rich_text: [{ plain_text: "Inova PLC" }] },
              "Product Type": { rich_text: [{ plain_text: "Silent Diesel Generator" }] },
            },
          },
          {
            id: "deal_other_2",
            properties: {
              "Deal Title": { title: [{ plain_text: "Awash Agro" }] },
              Stage: { select: { name: "Won" } },
            },
          },
        ],
      });

      const matches = await service.searchDeals("inova plc order", { isManager: true });
      expect(matches.length).toBe(1);
      expect(matches[0]!.pageId).toBe("deal_inova_1");

      const partialMatches = await service.searchDeals("inova", { isManager: true });
      expect(partialMatches.length).toBe(1);
      expect(partialMatches[0]!.pageId).toBe("deal_inova_1");
    });
  });
});
