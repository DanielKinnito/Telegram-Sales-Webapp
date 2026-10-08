import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { env } from "../../config/env.js";

export interface CronServiceOptions {
  notionClient: ResilientNotionClient;
  salesRepsService?: SalesRepsService | undefined;
  bot?: any | undefined;
  salesLogsDbId?: string | undefined;
  dealsDbId?: string | undefined;
  managerChatIds?: number[] | undefined;
}

export interface FollowUpBriefingResult {
  totalBriefingsSent: number;
}

export interface InactivitySweeperResult {
  stalledDealsCount: number;
  alertsSent: number;
}

export class CronService {
  private readonly notionClient: ResilientNotionClient;
  private readonly salesRepsService?: SalesRepsService | undefined;
  private readonly bot?: any;
  private readonly salesLogsDbId: string;
  private readonly dealsDbId: string;
  private readonly managerChatIds: number[];

  constructor(options: CronServiceOptions) {
    this.notionClient = options.notionClient;
    this.salesRepsService = options.salesRepsService;
    this.bot = options.bot;
    this.salesLogsDbId = options.salesLogsDbId || env.NOTION_SALES_LOGS_DB_ID;
    this.dealsDbId = options.dealsDbId || env.NOTION_DEALS_DB_ID;
    this.managerChatIds = options.managerChatIds || [];
  }

  /**
   * Daily Follow-up Briefing (9:00 AM).
   * Finds scheduled follow-up activities for today and dispatches briefings to assigned reps.
   */
  public async runDailyFollowUpBriefing(targetDate?: string): Promise<FollowUpBriefingResult> {
    const today = targetDate || new Date().toISOString().split("T")[0]!;

    const response = (await this.notionClient.queryDatabase(this.salesLogsDbId, {
      filter: {
        property: "Activity Date",
        date: {
          equals: today,
        },
      },
    })) as { results: any[] };

    const logsForToday = (response.results || []).filter((log: any) => {
      const date = log.properties?.["Activity Date"]?.date?.start;
      return date === today;
    });

    if (logsForToday.length === 0 || !this.bot) {
      return { totalBriefingsSent: 0 };
    }

    // Group logs by Rep ID / Telegram ID
    const repLogsMap = new Map<string, any[]>();
    for (const log of logsForToday) {
      const repId =
        log.properties?.["Rep ID"]?.rich_text?.[0]?.plain_text ||
        log.properties?.["Rep ID"]?.title?.[0]?.plain_text ||
        log.properties?.["Telegram ID"]?.title?.[0]?.plain_text ||
        "";

      if (repId) {
        const list = repLogsMap.get(repId) || [];
        list.push(log);
        repLogsMap.set(repId, list);
      }
    }

    // If no specific Rep ID was on the logs, broadcast the day's schedule to all active sales reps
    if (repLogsMap.size === 0 && this.salesRepsService?.getActiveSalesReps) {
      const activeReps = await this.salesRepsService.getActiveSalesReps();
      for (const rep of activeReps) {
        if (rep.telegramId) {
          repLogsMap.set(rep.telegramId, logsForToday);
        }
      }
    }

    let totalBriefingsSent = 0;

    for (const [repTelegramId, logs] of repLogsMap.entries()) {
      try {
        let repName = "Sales Rep";
        if (this.salesRepsService) {
          const rep = await this.salesRepsService.findSalesRepByTelegramId(repTelegramId);
          if (rep?.fullName) repName = rep.fullName;
        }

        const logLines = logs
          .map((l: any) => {
            const title =
              l.properties?.["Log Title / ID"]?.title?.[0]?.plain_text ||
              l.properties?.["Name"]?.title?.[0]?.plain_text ||
              "Follow-up Activity";
            const type = l.properties?.["Interaction Type"]?.select?.name || "Note";
            const note = l.properties?.["Note Content"]?.rich_text?.[0]?.plain_text || "";
            return `• *${title}* (${type})\n  _${note}_`;
          })
          .join("\n\n");

        const message =
          `☀️ *Good morning, ${repName}! Daily Sales Briefing*\n\n` +
          `📅 *Date:* ${today}\n` +
          `📋 *Scheduled Follow-ups for Today:*\n\n` +
          `${logLines}\n\n` +
          `🚀 _Have a productive day! Open the Sales Mini App to log progress._`;

        const chatId = Number.isInteger(Number(repTelegramId))
          ? Number(repTelegramId)
          : repTelegramId;

        await this.bot.api.sendMessage(chatId, message, { parse_mode: "Markdown" });
        totalBriefingsSent++;
      } catch (err) {
        console.error(`Failed to send morning briefing to rep ${repTelegramId}:`, err);
      }
    }

    return { totalBriefingsSent };
  }

  /**
   * 7-Day Inactivity Deal Sweeper.
   * Identifies active deals with no logged activity for >= thresholdDays and alerts stakeholders.
   */
  public async runInactivitySweeper(
    thresholdDays: number = 7,
    referenceDate?: Date
  ): Promise<InactivitySweeperResult> {
    const now = referenceDate || new Date();

    const response = (await this.notionClient.queryDatabase(this.dealsDbId, {})) as {
      results: any[];
    };

    const deals = response.results || [];
    let stalledDealsCount = 0;
    let alertsSent = 0;

    for (const deal of deals) {
      const stage = deal.properties?.["Stage"]?.select?.name || "New";

      // Ignore closed deals
      if (stage === "Won" || stage === "Lost") {
        continue;
      }

      const lastEdited = deal.last_edited_time;
      if (!lastEdited) continue;

      const daysInactive = Math.floor(
        (now.getTime() - new Date(lastEdited).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysInactive >= thresholdDays) {
        stalledDealsCount++;

        const title =
          deal.properties?.["Deal Title"]?.title?.[0]?.plain_text ||
          deal.properties?.["Name"]?.title?.[0]?.plain_text ||
          "Active Deal";

        const amount = deal.properties?.["Amount"]?.number;
        const amountFormatted =
          amount != null ? `ETB ${Number(amount).toLocaleString()}` : "N/A";

        if (this.bot && this.managerChatIds.length > 0) {
          const message =
            `⚠️ *Stalled Deal Alert: 7+ Days Inactivity*\n\n` +
            `• *Deal:* ${title}\n` +
            `• *Amount:* ${amountFormatted}\n` +
            `• *Current Stage:* ${stage}\n` +
            `• *Last Active:* ${daysInactive} days ago\n\n` +
            `_Please contact the client or log an activity update in the Sales Mini App._`;

          for (const chatId of this.managerChatIds) {
            try {
              await this.bot.api.sendMessage(chatId, message, { parse_mode: "Markdown" });
              alertsSent++;
            } catch (err) {
              console.error(`Failed to dispatch stalled deal alert to manager ${chatId}:`, err);
            }
          }
        }
      }
    }

    return { stalledDealsCount, alertsSent };
  }
}
