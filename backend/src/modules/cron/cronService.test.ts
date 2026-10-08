import { describe, it, expect, vi, beforeEach } from "vitest";
import { CronService } from "./cronService.js";
import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";

describe("CronService (Milestone 7: Automated Notification Workers)", () => {
  let service: CronService;
  let mockNotionClient: Partial<ResilientNotionClient>;
  let mockSalesRepsService: Partial<SalesRepsService>;
  let mockBot: any;

  beforeEach(() => {
    mockNotionClient = {
      queryDatabase: vi.fn(),
      retrievePage: vi.fn(),
    };

    mockSalesRepsService = {
      findSalesRepByTelegramId: vi.fn(),
    };

    mockBot = {
      api: {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 888 }),
      },
    };

    service = new CronService({
      notionClient: mockNotionClient as ResilientNotionClient,
      salesRepsService: mockSalesRepsService as SalesRepsService,
      salesLogsDbId: "test_sales_logs_db",
      dealsDbId: "test_deals_db",
      managerChatIds: [90001, 90002],
      bot: mockBot,
    });
  });

  describe("runDailyFollowUpBriefing", () => {
    it("finds scheduled follow-ups for today and dispatches briefing to assigned sales reps", async () => {
      const today = "2026-10-08";

      // Mock sales logs returned for today
      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "log_1",
            properties: {
              "Log Title / ID": { title: [{ plain_text: "Call with Awash Procurement" }] },
              "Interaction Type": { select: { name: "Call" } },
              "Activity Date": { date: { start: today } },
              "Note Content": { rich_text: [{ plain_text: "Confirm payment receipt delivery" }] },
              "Rep ID": { rich_text: [{ plain_text: "61917289" }] },
            },
          },
        ],
      });

      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "61917289",
        fullName: "Samuel Green",
        role: "Sales Rep",
        status: "Active",
      });

      const result = await service.runDailyFollowUpBriefing(today);

      expect(result.totalBriefingsSent).toBe(1);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        61917289,
        expect.stringMatching(/Daily Sales Briefing/i),
        expect.objectContaining({ parse_mode: "Markdown" })
      );
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        61917289,
        expect.stringMatching(/Call with Awash Procurement/),
        expect.anything()
      );
    });

    it("handles zero follow-ups gracefully without error", async () => {
      (mockNotionClient.queryDatabase as any).mockResolvedValue({ results: [] });

      const result = await service.runDailyFollowUpBriefing("2026-10-08");
      expect(result.totalBriefingsSent).toBe(0);
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("runInactivitySweeper", () => {
    it("flags active deals stalled for >= 7 days and alerts managers and reps", async () => {
      const referenceNow = new Date("2026-10-08T12:00:00Z");

      // Deal 1: Active, last edited 10 days ago (stalled!)
      // Deal 2: Active, last edited 2 days ago (not stalled)
      // Deal 3: Won, last edited 15 days ago (closed -> ignored)
      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "deal_stalled_1",
            last_edited_time: "2026-09-28T12:00:00Z", // 10 days ago
            properties: {
              "Deal Title": { title: [{ plain_text: "Stalled Factory Equipment Deal" }] },
              "Amount": { number: 450000 },
              "Stage": { select: { name: "Proposal" } },
            },
          },
          {
            id: "deal_active_recent",
            last_edited_time: "2026-10-06T12:00:00Z", // 2 days ago
            properties: {
              "Deal Title": { title: [{ plain_text: "Recent Active Deal" }] },
              "Amount": { number: 120000 },
              "Stage": { select: { name: "Contacted" } },
            },
          },
          {
            id: "deal_closed_won",
            last_edited_time: "2026-09-20T12:00:00Z", // 18 days ago, but Won!
            properties: {
              "Deal Title": { title: [{ plain_text: "Closed Won Deal" }] },
              "Amount": { number: 800000 },
              "Stage": { select: { name: "Won" } },
            },
          },
        ],
      });

      const result = await service.runInactivitySweeper(7, referenceNow);

      expect(result.stalledDealsCount).toBe(1);
      expect(result.alertsSent).toBe(2); // Sent to 2 configured managers

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        90001,
        expect.stringMatching(/Stalled Deal Alert/i),
        expect.anything()
      );
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        90001,
        expect.stringMatching(/Stalled Factory Equipment Deal/),
        expect.anything()
      );
    });

    it("does nothing when all active deals have recent activity", async () => {
      const referenceNow = new Date("2026-10-08T12:00:00Z");

      (mockNotionClient.queryDatabase as any).mockResolvedValue({
        results: [
          {
            id: "deal_recent",
            last_edited_time: "2026-10-07T12:00:00Z", // 1 day ago
            properties: {
              "Deal Title": { title: [{ plain_text: "Active Deal" }] },
              "Amount": { number: 150000 },
              "Stage": { select: { name: "Proposal" } },
            },
          },
        ],
      });

      const result = await service.runInactivitySweeper(7, referenceNow);
      expect(result.stalledDealsCount).toBe(0);
      expect(result.alertsSent).toBe(0);
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });
  });
});
