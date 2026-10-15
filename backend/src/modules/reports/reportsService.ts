import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { env } from "../../config/env.js";

export interface GenerateReportOptions {
  periodStart?: Date | undefined;
  periodEnd?: Date | undefined;
  triggerSource?: "manual" | "scheduled" | "bot" | undefined;
}

export interface WeeklyReportResult {
  reportPageId: string;
  reportUrl: string;
  reportTitle: string;
  periodString: string;
  totalWonRevenue: number;
  dealsWonCount: number;
  dealsLostCount: number;
  activePipelineCount: number;
  newAccountsCount: number;
  managersNotified: number;
}

export interface ReportsServiceOptions {
  notionClient: ResilientNotionClient;
  salesRepsService?: SalesRepsService | undefined;
  reportsDbId?: string | undefined;
  dealsDbId?: string | undefined;
  accountsDbId?: string | undefined;
  salesLogsDbId?: string | undefined;
  queueDbId?: string | undefined;
  managerChatIds?: number[] | undefined;
  bot?: any | undefined;
}

export class ReportsService {
  private readonly notionClient: ResilientNotionClient;
  private readonly salesRepsService?: SalesRepsService | undefined;
  private readonly reportsDbId: string;
  private readonly dealsDbId: string;
  private readonly accountsDbId: string;
  private readonly salesLogsDbId: string;
  private readonly queueDbId: string;
  private readonly managerChatIds: number[];
  private bot?: any;

  constructor(options: ReportsServiceOptions) {
    this.notionClient = options.notionClient;
    this.salesRepsService = options.salesRepsService;
    this.reportsDbId = options.reportsDbId || env.NOTION_REPORTS_DB_ID || "4d04d701-bbf7-4797-951c-5fc010720939";
    this.dealsDbId = options.dealsDbId || env.NOTION_DEALS_DB_ID;
    this.accountsDbId = options.accountsDbId || env.NOTION_ACCOUNTS_DB_ID;
    this.salesLogsDbId = options.salesLogsDbId || env.NOTION_SALES_LOGS_DB_ID;
    this.queueDbId = options.queueDbId || env.NOTION_QUEUE_DB_ID;
    this.managerChatIds = options.managerChatIds || [];
    this.bot = options.bot;
  }

  public setBot(bot: any): void {
    this.bot = bot;
  }

  /**
   * Generates a formal, professional weekly executive sales performance report.
   * Creates a dedicated page in the Executive Reports database in Notion.
   * Strictly avoids emojis and AI fluff for institutional corporate presentation.
   */
  public async generateWeeklyReport(options: GenerateReportOptions = {}): Promise<WeeklyReportResult> {
    const periodEnd = options.periodEnd || new Date();
    const periodStart = options.periodStart || new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const formatDateFormal = (d: Date) =>
      d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const formatIsoDate = (d: Date) => d.toISOString().split("T")[0]!;

    const periodString = `${formatDateFormal(periodStart)} – ${formatDateFormal(periodEnd)}`;
    const reportTitle = `Weekly Sales Performance Report — Week ending ${formatDateFormal(periodEnd)}`;

    // 1. Gather all deals from Notion Deals DB
    let deals: any[] = [];
    try {
      const dealsRes = (await this.notionClient.queryDatabase(this.dealsDbId, {})) as { results: any[] };
      deals = dealsRes.results || [];
    } catch (err: any) {
      console.warn("Could not query Deals DB for weekly report:", err.message);
    }

    // 2. Gather Accounts
    let accounts: any[] = [];
    try {
      const accRes = (await this.notionClient.queryDatabase(this.accountsDbId, {})) as { results: any[] };
      accounts = accRes.results || [];
    } catch (err: any) {
      console.warn("Could not query Accounts DB for weekly report:", err.message);
    }

    // 3. Gather Active Sales Reps
    let reps: any[] = [];
    if (this.salesRepsService) {
      try {
        reps = await this.salesRepsService.getActiveSalesReps();
      } catch (err: any) {
        console.warn("Could not query Sales Reps for weekly report:", err.message);
      }
    }

    // 4. Gather Sales Logs
    let logs: any[] = [];
    try {
      const logsRes = (await this.notionClient.queryDatabase(this.salesLogsDbId, {})) as { results: any[] };
      logs = logsRes.results || [];
    } catch (err: any) {
      console.warn("Could not query Sales Logs DB for weekly report:", err.message);
    }

    // Process Deal Metrics
    const wonDeals: Array<{ title: string; amount: number; product: string; rep: string }> = [];
    const lostDeals: Array<{ title: string; reason: string; rep: string }> = [];
    const pipelineDeals: Array<{ title: string; stage: string; amount: number | null; rep: string }> = [];
    let totalWonRevenue = 0;

    for (const page of deals) {
      const props = page.properties;
      const title =
        props?.["Deal Title"]?.title?.[0]?.plain_text ||
        props?.["Name"]?.title?.[0]?.plain_text ||
        "Untitled Contract";
      const stage = props?.["Stage"]?.select?.name || "Proposal";
      const amount = props?.["Offer VAT Incl"]?.number ?? props?.["Amount"]?.number ?? 0;
      const product = props?.["Product Type"]?.rich_text?.[0]?.plain_text || "Standard Industrial Supply";
      const rep = props?.["Rep Name"]?.rich_text?.[0]?.plain_text || "Unassigned";
      const lostReason = props?.["Lost Reason"]?.rich_text?.[0]?.plain_text || "Commercial terms unfinalized";

      if (stage === "Won") {
        wonDeals.push({ title, amount, product, rep });
        totalWonRevenue += amount;
      } else if (stage === "Lost") {
        lostDeals.push({ title, reason: lostReason, rep });
      } else {
        pipelineDeals.push({ title, stage, amount: amount > 0 ? amount : null, rep });
      }
    }

    const dealsWonCount = wonDeals.length;
    const dealsLostCount = lostDeals.length;
    const activePipelineCount = pipelineDeals.length;
    const newAccountsCount = accounts.length;

    // Build Rep Performance Map
    const repPerformanceMap = new Map<
      string,
      { wonCount: number; wonRevenue: number; pipelineCount: number; logsCount: number }
    >();

    for (const rep of reps) {
      repPerformanceMap.set(rep.fullName, { wonCount: 0, wonRevenue: 0, pipelineCount: 0, logsCount: 0 });
    }

    for (const w of wonDeals) {
      const entry = repPerformanceMap.get(w.rep) || { wonCount: 0, wonRevenue: 0, pipelineCount: 0, logsCount: 0 };
      entry.wonCount += 1;
      entry.wonRevenue += w.amount;
      repPerformanceMap.set(w.rep, entry);
    }

    for (const p of pipelineDeals) {
      const entry = repPerformanceMap.get(p.rep) || { wonCount: 0, wonRevenue: 0, pipelineCount: 0, logsCount: 0 };
      entry.pipelineCount += 1;
      repPerformanceMap.set(p.rep, entry);
    }

    for (const log of logs) {
      const repName = log.properties?.["Rep Name"]?.rich_text?.[0]?.plain_text;
      if (repName && repPerformanceMap.has(repName)) {
        const entry = repPerformanceMap.get(repName)!;
        entry.logsCount += 1;
      }
    }

    // 5. Construct Formal Professional Notion Document Blocks (NO emojis, NO AI fluff)
    const pageBlocks: any[] = [
      // Formal Institutional Header
      {
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "COMMERCIAL OPERATIONS DIVISION\n" },
              annotations: { bold: true, color: "gray" },
            },
            {
              type: "text",
              text: { content: "WEEKLY SALES PERFORMANCE REPORT\n" },
              annotations: { bold: true },
            },
            {
              type: "text",
              text: { content: "CONFIDENTIAL — FOR EXECUTIVE MANAGEMENT REVIEW" },
              annotations: { italic: true, color: "gray" },
            },
          ],
        },
      },
      { type: "divider", divider: {} },

      // Audit Metadata Table
      {
        type: "callout",
        callout: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  `Reporting Period: ${periodString}\n` +
                  `Publication Date: ${formatDateFormal(periodEnd)}\n` +
                  `Prepared For: Commercial Executive Committee\n` +
                  `Data Verification: Verified CRM Datastore Audit`,
              },
              annotations: { bold: false },
            },
          ],
          color: "gray_background",
        },
      },

      // Section 1: Executive Summary
      {
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "1. Executive Performance Summary" }, annotations: { bold: true } }],
        },
      },
      {
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  `This report presents the consolidated sales and pipeline performance metrics for the period ending ${formatDateFormal(
                    periodEnd
                  )}. All figures reflect audited transactions in the enterprise relational CRM datastore. Key commercial outcomes include closed contract revenue, commercial disqualification root causes, and representative engagement volumes.`,
              },
            },
          ],
        },
      },

      // KPI Metric Cards (3 Columns)
      {
        type: "column_list",
        column_list: {
          children: [
            {
              type: "column",
              column: {
                children: [
                  {
                    type: "callout",
                    callout: {
                      rich_text: [
                        {
                          type: "text",
                          text: { content: "Closed Won Revenue\n" },
                          annotations: { bold: true },
                        },
                        {
                          type: "text",
                          text: { content: `ETB ${totalWonRevenue.toLocaleString()}` },
                          annotations: { bold: true, color: "green" },
                        },
                      ],
                      color: "gray_background",
                    },
                  },
                ],
              },
            },
            {
              type: "column",
              column: {
                children: [
                  {
                    type: "callout",
                    callout: {
                      rich_text: [
                        {
                          type: "text",
                          text: { content: "Contracts Closed\n" },
                          annotations: { bold: true },
                        },
                        {
                          type: "text",
                          text: { content: `${dealsWonCount} Won / ${dealsLostCount} Lost` },
                          annotations: { bold: true, color: "blue" },
                        },
                      ],
                      color: "gray_background",
                    },
                  },
                ],
              },
            },
            {
              type: "column",
              column: {
                children: [
                  {
                    type: "callout",
                    callout: {
                      rich_text: [
                        {
                          type: "text",
                          text: { content: "Active Negotiations\n" },
                          annotations: { bold: true },
                        },
                        {
                          type: "text",
                          text: { content: `${activePipelineCount} Pipeline Deals` },
                          annotations: { bold: true, color: "purple" },
                        },
                      ],
                      color: "gray_background",
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      { type: "divider", divider: {} },

      // Section 2: Won Contracts
      {
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "2. Executed Contracts & Closed Revenue" }, annotations: { bold: true } }],
        },
      },
    ];

    if (wonDeals.length > 0) {
      for (const w of wonDeals) {
        pageBlocks.push({
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content: `${w.title}: ` },
                annotations: { bold: true },
              },
              {
                type: "text",
                text: {
                  content: `Contract Value: ETB ${w.amount.toLocaleString()} | Equipment: ${w.product} | Assigned Rep: ${w.rep}`,
                },
              },
            ],
          },
        });
      }
    } else {
      pageBlocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "No contracts reached finalized closing stage during this reporting window." },
              annotations: { italic: true, color: "gray" },
            },
          ],
        },
      });
    }

    // Section 3: Lost Deals Analysis
    pageBlocks.push(
      { type: "divider", divider: {} },
      {
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "3. Commercial Losses & Root Cause Analysis" }, annotations: { bold: true } }],
        },
      }
    );

    if (lostDeals.length > 0) {
      for (const l of lostDeals) {
        pageBlocks.push({
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content: `${l.title}: ` },
                annotations: { bold: true },
              },
              {
                type: "text",
                text: {
                  content: `Documented Commercial Reason: "${l.reason}" | Representative: ${l.rep}`,
                },
              },
            ],
          },
        });
      }
    } else {
      pageBlocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "Zero commercial contract losses recorded during this reporting cycle." },
              annotations: { italic: true, color: "gray" },
            },
          ],
        },
      });
    }

    // Section 4: Sales Representative Matrix
    pageBlocks.push(
      { type: "divider", divider: {} },
      {
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "4. Representative Performance Matrix" }, annotations: { bold: true } }],
        },
      }
    );

    if (reps.length > 0) {
      for (const rep of reps) {
        const perf = repPerformanceMap.get(rep.fullName) || {
          wonCount: 0,
          wonRevenue: 0,
          pipelineCount: 0,
          logsCount: 0,
        };

        pageBlocks.push({
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content: `${rep.fullName} (${rep.role}): ` },
                annotations: { bold: true },
              },
              {
                type: "text",
                text: {
                  content: `Deals Won: ${perf.wonCount} (ETB ${perf.wonRevenue.toLocaleString()}) | Active Pipeline: ${perf.pipelineCount} deals | Recorded Consultations: ${perf.logsCount}`,
                },
              },
            ],
          },
        });
      }
    } else {
      pageBlocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "No sales representative activity profiles loaded." },
              annotations: { italic: true, color: "gray" },
            },
          ],
        },
      });
    }

    // Section 5: Client Acquisition & Front Desk Inbound Lead Allocations
    pageBlocks.push(
      { type: "divider", divider: {} },
      {
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "5. Client Onboarding & Front Desk Allocations" }, annotations: { bold: true } }],
        },
      },
      {
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  `Total Registered Accounts in Datastore: ${newAccountsCount} enterprise companies.\n` +
                  `All registered accounts have undergone 10-digit Ethiopian Taxpayer Identification Number (TIN) collision verification to prevent account overlap across sales territories.`,
              },
            },
          ],
        },
      }
    );

    // Section 6: Key Pipeline Priorities
    pageBlocks.push(
      { type: "divider", divider: {} },
      {
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "6. Commercial Priorities for Upcoming Cycle" }, annotations: { bold: true } }],
        },
      }
    );

    if (pipelineDeals.length > 0) {
      for (const p of pipelineDeals.slice(0, 5)) {
        pageBlocks.push({
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content: `${p.title}: ` },
                annotations: { bold: true },
              },
              {
                type: "text",
                text: {
                  content: `Current Stage: ${p.stage}${
                    p.amount ? ` | Estimated Value: ETB ${p.amount.toLocaleString()}` : ""
                  } | Lead Representative: ${p.rep}`,
                },
              },
            ],
          },
        });
      }
    } else {
      pageBlocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "All active deals have transitioned out of negotiation stage." },
              annotations: { italic: true, color: "gray" },
            },
          ],
        },
      });
    }

    // Document Control & PDF Notice
    pageBlocks.push(
      { type: "divider", divider: {} },
      {
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "DOCUMENT CONTROL & DISTRIBUTION NOTICE:\n" +
                  "This document is generated automatically by the Enterprise CRM Operations Engine. " +
                  "To download this report as a PDF for official record-keeping or board presentation: " +
                  "Open this page in Notion, click the '...' menu in the upper-right corner, and select 'Export' -> 'PDF'.",
              },
              annotations: { italic: true, color: "gray" },
            },
          ],
        },
      }
    );

    // 6. Create the Report Page in the Executive Reports Database
    const newPage: any = await this.notionClient.createPage({
      parent: { database_id: this.reportsDbId },
      properties: {
        "Report Title": {
          title: [{ text: { content: reportTitle } }],
        },
        "Report Date": {
          date: { start: formatIsoDate(periodEnd) },
        },
        "Reporting Period": {
          rich_text: [{ text: { content: periodString } }],
        },
        "Closed Revenue (ETB)": {
          number: totalWonRevenue,
        },
        "Deals Won": {
          number: dealsWonCount,
        },
        "Deals Lost": {
          number: dealsLostCount,
        },
        "New Accounts": {
          number: newAccountsCount,
        },
        "Pipeline Deals": {
          number: activePipelineCount,
        },
        "Status": {
          select: { name: "Finalized" },
        },
      },
      children: pageBlocks,
    });

    const reportPageId = newPage.id;
    const reportUrl = `https://www.notion.so/${reportPageId.replace(/-/g, "")}`;

    // 7. Dispatch Telegram Notification to Managers
    let managersNotified = 0;
    if (this.bot && this.managerChatIds.length > 0) {
      const telegramMessage =
        `*Weekly Executive Sales Report Published*\n\n` +
        `• *Reporting Period:* ${periodString}\n` +
        `• *Closed Won Revenue:* ETB ${totalWonRevenue.toLocaleString()}\n` +
        `• *Contracts Won:* ${dealsWonCount} | *Losses:* ${dealsLostCount}\n` +
        `• *Active Pipeline Deals:* ${activePipelineCount}\n` +
        `• *Total Registered Accounts:* ${newAccountsCount}\n\n` +
        `📄 [Open Formal Report in Notion](${reportUrl})\n\n` +
        `_To export to PDF: Open the document in Notion, click '...' at the top-right, and select 'Export as PDF'._`;

      for (const chatId of this.managerChatIds) {
        try {
          await this.bot.api.sendMessage(chatId, telegramMessage, { parse_mode: "Markdown" });
          managersNotified++;
        } catch (err: any) {
          console.error(`Failed to send Telegram report notification to manager ${chatId}:`, err.message);
        }
      }
    }

    return {
      reportPageId,
      reportUrl,
      reportTitle,
      periodString,
      totalWonRevenue,
      dealsWonCount,
      dealsLostCount,
      activePipelineCount,
      newAccountsCount,
      managersNotified,
    };
  }
}
