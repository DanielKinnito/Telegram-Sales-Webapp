import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import type { LeadsService } from "../leads/leadsService.js";
import { isValidTin, sanitizeTin } from "../common/tinValidator.js";
import { env } from "../../config/env.js";

export class NoAvailableRepsError extends Error {
  constructor(message: string = "No sales representatives are currently available in the queue.") {
    super(message);
    this.name = "NoAvailableRepsError";
  }
}

export interface AvailableRep {
  queuePageId: string;
  telegramId: string;
  fullName: string;
  pageId?: string | undefined;
}

export interface AssignWalkInInput {
  companyName: string;
  tin: string;
  address?: string | undefined;
  industry?: string | undefined;
  assignedByStaffName?: string | undefined;
  contactName?: string | undefined;
  contactPhone?: string | undefined;
}

export interface AssignWalkInResult {
  success: boolean;
  account: {
    pageId: string;
    companyName: string;
    tin: string;
    address?: string | undefined;
    industry?: string | undefined;
    assignedDate: string;
    assignedRep: {
      pageId?: string | undefined;
      telegramId: string;
      fullName: string;
    };
  };
  notificationSent: boolean;
}

export interface QueueServiceOptions {
  notionClient: ResilientNotionClient;
  salesRepsService: SalesRepsService;
  leadsService: LeadsService;
  queueDbId?: string | undefined;
  accountsDbId?: string | undefined;
  bot?: any | undefined;
}

export class QueueService {
  private readonly notionClient: ResilientNotionClient;
  private readonly salesRepsService: SalesRepsService;
  private readonly leadsService: LeadsService;
  private readonly queueDbId: string;
  private readonly accountsDbId: string;
  private readonly bot?: any;

  constructor(options: QueueServiceOptions) {
    this.notionClient = options.notionClient;
    this.salesRepsService = options.salesRepsService;
    this.leadsService = options.leadsService;
    this.queueDbId = options.queueDbId || env.NOTION_QUEUE_DB_ID;
    this.accountsDbId = options.accountsDbId || env.NOTION_ACCOUNTS_DB_ID;
    this.bot = options.bot;
  }

  /**
   * Selects the next available sales rep based on round-robin fairness.
   * Priority:
   * 1. Reps who have never been assigned (timestamp is null/undefined)
   * 2. Reps with the oldest Last Assigned Timestamp
   */
  public async getNextAvailableRep(): Promise<AvailableRep> {
    const response = (await this.notionClient.queryDatabase(this.queueDbId, {
      filter: {
        property: "Availability Status",
        select: {
          equals: "Available",
        },
      },
    })) as { results: any[] };

    const availablePages = (response.results || []).filter((page: any) => {
      const status = page.properties?.["Availability Status"]?.select?.name;
      return status === "Available";
    });

    if (availablePages.length === 0) {
      throw new NoAvailableRepsError();
    }

    // Sort: null/undefined timestamp first, then ascending timestamp
    availablePages.sort((a: any, b: any) => {
      const timeA = a.properties?.["Last Assigned Timestamp"]?.date?.start;
      const timeB = b.properties?.["Last Assigned Timestamp"]?.date?.start;

      if (!timeA && !timeB) return 0;
      if (!timeA) return -1;
      if (!timeB) return 1;

      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });

    const chosenPage = availablePages[0];
    const repId =
      chosenPage.properties?.["Rep ID"]?.title?.[0]?.plain_text ||
      chosenPage.properties?.["Rep ID"]?.rich_text?.[0]?.plain_text ||
      "";

    const repRecord = await this.salesRepsService.findSalesRepByTelegramId(repId);

    return {
      queuePageId: chosenPage.id,
      telegramId: repId,
      fullName: repRecord?.fullName || `Rep ${repId}`,
      pageId: repRecord?.pageId,
    };
  }

  /**
   * Assigns a walk-in lead to the next available rep.
   * Validates TIN, checks conflicts, updates rotational timestamp,
   * creates Account in Notion, and sends a push notification.
   */
  public async assignWalkIn(input: AssignWalkInInput): Promise<AssignWalkInResult> {
    const tin = sanitizeTin(input.tin);
    if (!isValidTin(tin)) {
      throw new Error("Validation Error: TIN Number must be exactly 10 numeric digits (e.g. 0012345678)");
    }

    if (!input.companyName || input.companyName.trim().length === 0) {
      throw new Error("Validation Error: Company Name is required");
    }

    // 1. Conflict check using LeadsService
    const tinCheck = await this.leadsService.checkTin(tin);
    if (!tinCheck.available) {
      throw new Error(tinCheck.message);
    }

    // 2. Select next available rep
    const rep = await this.getNextAvailableRep();

    // 3. Update queue timestamp immediately
    const nowIso = new Date().toISOString();
    await this.notionClient.updatePage({
      page_id: rep.queuePageId,
      properties: {
        "Last Assigned Timestamp": {
          date: { start: nowIso },
        },
      },
    });

    // 4. Create Account in Notion
    const today = nowIso.split("T")[0]!;
    const properties: Record<string, any> = {
      "Name": {
        title: [{ text: { content: input.companyName.trim() } }],
      },
      "TIN Number": {
        rich_text: [{ text: { content: tin } }],
      },
      "Assigned Date": {
        date: { start: today },
      },
    };

    if (rep.pageId) {
      properties["Owner"] = {
        relation: [{ id: rep.pageId }],
      };
    }

    if (input.address) {
      properties["Address"] = {
        rich_text: [{ text: { content: input.address.trim() } }],
      };
    }

    if (input.industry) {
      properties["Industry"] = {
        select: { name: input.industry.trim() },
      };
    }

    const accountPage = await this.notionClient.createPage({
      parent: { database_id: this.accountsDbId },
      properties,
    });

    // 5. Send Telegram notification to assigned rep
    let notificationSent = false;
    if (this.bot && rep.telegramId) {
      try {
        const assignedBy = input.assignedByStaffName || "Front Desk";
        const message =
          `🔔 *New Walk-In Lead Assigned!*\n\n` +
          `• *Company:* ${input.companyName.trim()}\n` +
          `• *TIN:* ${tin}\n` +
          (input.address ? `• *Address:* ${input.address.trim()}\n` : "") +
          (input.industry ? `• *Industry:* ${input.industry.trim()}\n` : "") +
          `• *Assigned by:* ${assignedBy}\n\n` +
          `Open the Sales Mini App to view customer details and follow up.`;

        const chatId = Number.isInteger(Number(rep.telegramId))
          ? Number(rep.telegramId)
          : rep.telegramId;

        await this.bot.api.sendMessage(chatId, message, { parse_mode: "Markdown" });
        notificationSent = true;
      } catch (err) {
        console.error("Failed to send Telegram notification to assigned rep:", err);
      }
    }

    return {
      success: true,
      account: {
        pageId: accountPage.id,
        companyName: input.companyName.trim(),
        tin,
        address: input.address?.trim(),
        industry: input.industry?.trim(),
        assignedDate: today,
        assignedRep: {
          pageId: rep.pageId,
          telegramId: rep.telegramId,
          fullName: rep.fullName,
        },
      },
      notificationSent,
    };
  }
}
