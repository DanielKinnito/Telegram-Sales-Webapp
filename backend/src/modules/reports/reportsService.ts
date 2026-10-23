import { InputFile } from "grammy";
import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { env } from "../../config/env.js";
import { WeeklyReportPdfService } from "./weeklyReportPdfService.js";

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
  pdfBuffer?: Buffer | undefined;
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
    const wonDeals: Array<{ title: string; company: string; amount: number; product: string; rep: string }> = [];
    const lostDeals: Array<{ title: string; company: string; reason: string; rep: string }> = [];
    const pipelineDeals: Array<{ title: string; company: string; stage: string; amount: number | null; rep: string }> = [];
    let totalWonRevenue = 0;

    for (const page of deals) {
      const props = page.properties;
      const title =
        props?.["Deal Title"]?.title?.[0]?.plain_text ||
        props?.["Name"]?.title?.[0]?.plain_text ||
        "Untitled Contract";
      const company =
        props?.["Company Name"]?.rich_text?.[0]?.plain_text ||
        props?.["Company"]?.rich_text?.[0]?.plain_text ||
        title.replace(/ Order$/i, "");
      const stage = props?.["Stage"]?.select?.name || "Proposal";
      const amount = props?.["Offer VAT Incl"]?.number ?? props?.["Amount"]?.number ?? 0;
      const product = props?.["Product Type"]?.rich_text?.[0]?.plain_text || "Standard Industrial Supply";
      const rep = props?.["Rep Name"]?.rich_text?.[0]?.plain_text || "Unassigned";
      const lostReason = props?.["Lost Reason"]?.rich_text?.[0]?.plain_text || "Commercial terms unfinalized";

      if (stage === "Won") {
        wonDeals.push({ title, company, amount, product, rep });
        totalWonRevenue += amount;
      } else if (stage === "Lost") {
        lostDeals.push({ title, company, reason: lostReason, rep });
      } else {
        pipelineDeals.push({ title, company, stage, amount: amount > 0 ? amount : null, rep });
      }
    }

    const dealsWonCount = wonDeals.length;
    const dealsLostCount = lostDeals.length;
    const activePipelineCount = pipelineDeals.length;
    const newAccountsCount = accounts.length;

    // Build Rep Performance Map with detailed company attribution
    interface RepPerformance {
      wonCount: number;
      wonRevenue: number;
      pipelineCount: number;
      lostCount: number;
      logsCount: number;
      wonDeals: { title: string; company: string; amount: number; product: string }[];
      lostDeals: { title: string; company: string; reason: string }[];
      pipelineDeals: { title: string; company: string; stage: string; amount: number | null }[];
      consultedCompanies: string[];
    }

    const repPerformanceMap = new Map<string, RepPerformance>();

    for (const rep of reps) {
      repPerformanceMap.set(rep.fullName, {
        wonCount: 0,
        wonRevenue: 0,
        pipelineCount: 0,
        lostCount: 0,
        logsCount: 0,
        wonDeals: [],
        lostDeals: [],
        pipelineDeals: [],
        consultedCompanies: [],
      });
    }

    for (const w of wonDeals) {
      let entry = repPerformanceMap.get(w.rep);
      if (!entry) {
        entry = {
          wonCount: 0,
          wonRevenue: 0,
          pipelineCount: 0,
          lostCount: 0,
          logsCount: 0,
          wonDeals: [],
          lostDeals: [],
          pipelineDeals: [],
          consultedCompanies: [],
        };
        repPerformanceMap.set(w.rep, entry);
      }
      entry.wonCount += 1;
      entry.wonRevenue += w.amount;
      entry.wonDeals.push(w);
    }

    for (const l of lostDeals) {
      let entry = repPerformanceMap.get(l.rep);
      if (!entry) {
        entry = {
          wonCount: 0,
          wonRevenue: 0,
          pipelineCount: 0,
          lostCount: 0,
          logsCount: 0,
          wonDeals: [],
          lostDeals: [],
          pipelineDeals: [],
          consultedCompanies: [],
        };
        repPerformanceMap.set(l.rep, entry);
      }
      entry.lostCount += 1;
      entry.lostDeals.push(l);
    }

    for (const p of pipelineDeals) {
      let entry = repPerformanceMap.get(p.rep);
      if (!entry) {
        entry = {
          wonCount: 0,
          wonRevenue: 0,
          pipelineCount: 0,
          lostCount: 0,
          logsCount: 0,
          wonDeals: [],
          lostDeals: [],
          pipelineDeals: [],
          consultedCompanies: [],
        };
        repPerformanceMap.set(p.rep, entry);
      }
      entry.pipelineCount += 1;
      entry.pipelineDeals.push(p);
    }

    for (const log of logs) {
      const repName = log.properties?.["Rep Name"]?.rich_text?.[0]?.plain_text;
      const compName =
        log.properties?.["Company Name"]?.rich_text?.[0]?.plain_text ||
        log.properties?.["Log Title / ID"]?.title?.[0]?.plain_text;
      if (repName && repPerformanceMap.has(repName)) {
        const entry = repPerformanceMap.get(repName)!;
        entry.logsCount += 1;
        if (compName && !entry.consultedCompanies.includes(compName)) {
          entry.consultedCompanies.push(compName);
        }
      }
    }

    const logoUrl = env.WEBAPP_URL ? `${env.WEBAPP_URL.replace(/\/$/, "")}/assets/company_logo.png` : undefined;

    // 5. Construct Formal Professional Notion Document Blocks (Pure text letterhead, clean & resilient)
    const pageBlocks: any[] = [
      // Formal Institutional Corporate Letterhead Header
      {
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "YC ELECTRIC EQUIPMENT MANUFACTURING PLC (玉柴船电动力)\n" },
              annotations: { bold: true },
            },
            {
              type: "text",
              text: {
                content:
                  "Add: Nifasselk Lafto, Addis Ababa, Ethiopia | Email: Ycelectric24@gmail.com | Tel: +251900640028 / +251929296636\n",
              },
              annotations: { bold: false, color: "gray" },
            },
            {
              type: "text",
              text: { content: "COMMERCIAL OPERATIONS DIVISION — WEEKLY SALES PERFORMANCE REPORT\n" },
              annotations: { bold: true, color: "blue" },
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
                  `Corporate Entity: YC Electric Equipment Manufacturing PLC\n` +
                  `Headquarters: Nifasselk Lafto, Addis Ababa, Ethiopia\n` +
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
          lostCount: 0,
          logsCount: 0,
          wonDeals: [],
          lostDeals: [],
          pipelineDeals: [],
          consultedCompanies: [],
        };

        const children: any[] = [];

        // Detail Won Deals
        for (const w of perf.wonDeals) {
          children.push({
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [
                {
                  type: "text",
                  text: { content: "Closed Won: " },
                  annotations: { bold: true, color: "green" },
                },
                {
                  type: "text",
                  text: { content: `${w.title}` },
                  annotations: { bold: true },
                },
                {
                  type: "text",
                  text: {
                    content: ` — Contract: ETB ${w.amount.toLocaleString()} | Equipment: ${w.product}`,
                  },
                },
              ],
            },
          });
        }

        // Detail Lost Deals
        for (const l of perf.lostDeals) {
          children.push({
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [
                {
                  type: "text",
                  text: { content: "Lost Deal: " },
                  annotations: { bold: true, color: "red" },
                },
                {
                  type: "text",
                  text: { content: `${l.title}` },
                  annotations: { bold: true },
                },
                {
                  type: "text",
                  text: {
                    content: ` — Documented Reason: "${l.reason}"`,
                  },
                },
              ],
            },
          });
        }

        // Detail Active Pipeline Negotiations
        for (const p of perf.pipelineDeals) {
          children.push({
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [
                {
                  type: "text",
                  text: { content: "Active Negotiation: " },
                  annotations: { bold: true, color: "purple" },
                },
                {
                  type: "text",
                  text: { content: `${p.title}` },
                  annotations: { bold: true },
                },
                {
                  type: "text",
                  text: {
                    content: ` — Stage: ${p.stage}${
                      p.amount ? ` | Estimated Value: ETB ${p.amount.toLocaleString()}` : ""
                    }`,
                  },
                },
              ],
            },
          });
        }

        // Detail Recorded Consultations
        if (perf.logsCount > 0) {
          const companiesSnippet =
            perf.consultedCompanies.length > 0
              ? ` (${perf.consultedCompanies.join(", ")})`
              : "";
          children.push({
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [
                {
                  type: "text",
                  text: { content: "Client Consultations: " },
                  annotations: { bold: true, color: "blue" },
                },
                {
                  type: "text",
                  text: {
                    content: `${perf.logsCount} interaction${
                      perf.logsCount === 1 ? "" : "s"
                    } logged${companiesSnippet}`,
                  },
                },
              ],
            },
          });
        }

        const repItem: any = {
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
                  content: `Deals Won: ${perf.wonCount} (ETB ${perf.wonRevenue.toLocaleString()}) | Deals Lost: ${perf.lostCount} | Active Pipeline: ${perf.pipelineCount} deals | Recorded Consultations: ${perf.logsCount}`,
                },
              },
            ],
          },
        };

        if (children.length > 0) {
          repItem.bulleted_list_item.children = children;
        }

        pageBlocks.push(repItem);
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
    const pageParams: any = {
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
    };

    if (logoUrl) {
      pageParams.icon = {
        type: "external",
        external: {
          url: logoUrl,
        },
      };
      pageParams.cover = {
        type: "external",
        external: {
          url: logoUrl,
        },
      };
    }

    const newPage: any = await this.notionClient.createPage(pageParams);

    const reportPageId = newPage.id;
    const reportUrl = `https://www.notion.so/${reportPageId.replace(/-/g, "")}`;

    // 7. Generate Pixel-Perfect Executive PDF via PDFKit
    let pdfBuffer: Buffer | undefined;
    try {
      const repPerformanceForPdf = Array.from(repPerformanceMap.entries()).map(([repName, p]) => {
        const cleanName = repName.split("\n")[0].trim();
        const repObj = reps.find((r) => r.fullName === repName || r.fullName.split("\n")[0].trim() === cleanName);
        return {
          repName: cleanName,
          role: repObj?.role || "Sales Rep",
          wonCount: p.wonCount,
          wonRevenue: p.wonRevenue,
          lostCount: p.lostCount,
          pipelineCount: p.pipelineCount,
          logsCount: p.logsCount,
          wonDeals: p.wonDeals.map((w) => ({ title: w.title, amount: w.amount, product: w.product })),
          lostDeals: p.lostDeals.map((l) => ({ title: l.title, reason: l.reason })),
          pipelineDeals: p.pipelineDeals.map((pipe) => ({
            title: pipe.title,
            stage: pipe.stage,
            amount: pipe.amount,
          })),
          consultedCompanies: p.consultedCompanies,
        };
      });

      pdfBuffer = await WeeklyReportPdfService.generateReportPdf({
        reportTitle,
        periodString,
        publicationDate: formatDateFormal(periodEnd),
        totalWonRevenue,
        dealsWonCount,
        dealsLostCount,
        activePipelineCount,
        newAccountsCount,
        wonDeals: wonDeals.map((w) => ({
          ...w,
          rep: w.rep.split("\n")[0].trim(),
        })),
        lostDeals: lostDeals.map((l) => ({
          ...l,
          rep: l.rep.split("\n")[0].trim(),
        })),
        pipelineDeals: pipelineDeals.map((p) => ({
          ...p,
          rep: p.rep.split("\n")[0].trim(),
        })),
        repPerformance: repPerformanceForPdf,
      });
    } catch (pdfErr: any) {
      console.error("Failed to generate weekly report PDF buffer:", pdfErr.message);
    }

    // 8. Dispatch Telegram Notification to Managers (with PDF Attachment)
    // When triggerSource === "bot", the bot command handler (bot.ts) directly replies with the PDF
    // to the requesting user. We skip the general broadcast here to prevent sending duplicate messages.
    let managersNotified = 0;
    const managerIds = this.salesRepsService?.getActiveManagerChatIds
      ? await this.salesRepsService.getActiveManagerChatIds(this.managerChatIds)
      : this.managerChatIds;

    if (options.triggerSource !== "bot" && this.bot && managerIds.length > 0) {
      const safePeriod = periodString.replace(/[^a-zA-Z0-9]/g, "_");
      const telegramMessage =
        `*Weekly Executive Sales Report Published*\n\n` +
        `• *Reporting Period:* ${periodString}\n` +
        `• *Closed Won Revenue:* ETB ${totalWonRevenue.toLocaleString()}\n` +
        `• *Contracts Won:* ${dealsWonCount} | *Losses:* ${dealsLostCount}\n` +
        `• *Active Pipeline Deals:* ${activePipelineCount}\n` +
        `• *Total Registered Accounts:* ${newAccountsCount}\n\n` +
        `📄 [Open Relational Audit in Notion](${reportUrl})\n` +
        `_Pixel-perfect executive PDF document attached above._`;

      for (const chatId of managerIds) {
        try {
          if (pdfBuffer) {
            await this.bot.api.sendDocument(
              chatId,
              new InputFile(pdfBuffer, `Weekly_Sales_Report_${safePeriod}.pdf`),
              { caption: telegramMessage, parse_mode: "Markdown" }
            );
          } else {
            await this.bot.api.sendMessage(chatId, telegramMessage, { parse_mode: "Markdown" });
          }
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
      pdfBuffer,
    };
  }
}
