import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportsService } from "./reportsService.js";
import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";

describe("ReportsService (Weekly Executive Friday Reports)", () => {
  let reportsService: ReportsService;
  let mockNotionClient: Partial<ResilientNotionClient>;
  let mockSalesRepsService: Partial<SalesRepsService>;
  let mockBot: any;

  beforeEach(() => {
    mockNotionClient = {
      queryDatabase: vi.fn(),
      createPage: vi.fn(),
    };

    mockSalesRepsService = {
      getActiveSalesReps: vi.fn(),
    };

    mockBot = {
      api: {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 999 }),
      },
    };

    reportsService = new ReportsService({
      notionClient: mockNotionClient as ResilientNotionClient,
      salesRepsService: mockSalesRepsService as SalesRepsService,
      reportsDbId: "test_reports_db",
      dealsDbId: "test_deals_db",
      accountsDbId: "test_accounts_db",
      salesLogsDbId: "test_logs_db",
      managerChatIds: [12345],
      bot: mockBot,
    });
  });

  it("compiles commercial metrics without emojis or buzzwords and creates report page in Notion", async () => {
    // Mock Deals: 1 Won, 1 Lost, 1 Proposal
    (mockNotionClient.queryDatabase as any).mockImplementation((dbId: string) => {
      if (dbId === "test_deals_db") {
        return Promise.resolve({
          results: [
            {
              id: "deal_won_1",
              properties: {
                "Deal Title": { title: [{ plain_text: "Awash Industrial Water Pump Order" }] },
                "Stage": { select: { name: "Won" } },
                "Amount": { number: 1500000 },
                "Product Type": { rich_text: [{ plain_text: "Submersible Pump" }] },
                "Rep Name": { rich_text: [{ plain_text: "Firaol Dagne" }] },
              },
            },
            {
              id: "deal_lost_1",
              properties: {
                "Deal Title": { title: [{ plain_text: "Bishoftu Farm Generator" }] },
                "Stage": { select: { name: "Lost" } },
                "Lost Reason": { rich_text: [{ plain_text: "Price above client procurement ceiling" }] },
                "Rep Name": { rich_text: [{ plain_text: "Olana kebede" }] },
              },
            },
            {
              id: "deal_proposal_1",
              properties: {
                "Deal Title": { title: [{ plain_text: "Finfinne Commercial Tower Generator" }] },
                "Stage": { select: { name: "Proposal" } },
                "Amount": { number: 4200000 },
                "Rep Name": { rich_text: [{ plain_text: "Firaol Dagne" }] },
              },
            },
          ],
        });
      }
      if (dbId === "test_accounts_db") {
        return Promise.resolve({
          results: [
            { id: "acc_1", properties: { Name: { title: [{ plain_text: "Awash Agro" }] } } },
            { id: "acc_2", properties: { Name: { title: [{ plain_text: "Finfinne Tower" }] } } },
          ],
        });
      }
      if (dbId === "test_logs_db") {
        return Promise.resolve({
          results: [
            { id: "log_1", properties: { "Rep Name": { rich_text: [{ plain_text: "Firaol Dagne" }] } } },
          ],
        });
      }
      return Promise.resolve({ results: [] });
    });

    (mockSalesRepsService.getActiveSalesReps as any).mockResolvedValue([
      { fullName: "Firaol Dagne", role: "Sales Rep" },
      { fullName: "Olana kebede", role: "Sales Rep" },
    ]);

    (mockNotionClient.createPage as any).mockResolvedValue({
      id: "report_page_123",
    });

    const result = await reportsService.generateWeeklyReport();

    expect(result.reportPageId).toBe("report_page_123");
    expect(result.totalWonRevenue).toBe(1500000);
    expect(result.dealsWonCount).toBe(1);
    expect(result.dealsLostCount).toBe(1);
    expect(result.activePipelineCount).toBe(1);
    expect(result.newAccountsCount).toBe(2);
    expect(result.managersNotified).toBe(1);

    // Verify createPage payload structure (no emojis in generated text)
    expect(mockNotionClient.createPage).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: { database_id: "test_reports_db" },
        properties: expect.objectContaining({
          "Report Title": expect.anything(),
          "Closed Revenue (ETB)": { number: 1500000 },
          "Deals Won": { number: 1 },
          "Deals Lost": { number: 1 },
          "Status": { select: { name: "Finalized" } },
        }),
      })
    );

    const createPageCall = (mockNotionClient.createPage as any).mock.calls[0][0];
    expect(createPageCall.children[0].paragraph.rich_text[0].text.content).toContain(
      "YC ELECTRIC EQUIPMENT MANUFACTURING PLC"
    );
    expect(createPageCall.children[0].paragraph.rich_text[1].text.content).toContain(
      "Nifasselk Lafto, Addis Ababa, Ethiopia"
    );

    // Verify Telegram alert dispatch to Manager
    expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("Weekly Executive Sales Report Published"),
      expect.objectContaining({ parse_mode: "Markdown" })
    );
  });
});
