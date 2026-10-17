import type { ResilientNotionClient } from "./notionClient.js";
import { env } from "../../config/env.js";

export type RepRole = "Sales Rep" | "Front Desk" | "Manager";
export type RepStatus = "Active" | "Pending Approval" | "Inactive";

export interface SalesRepRecord {
  pageId: string;
  telegramId: string;
  fullName: string;
  phone: string;
  role: RepRole;
  status: RepStatus;
}

export interface CreateSalesRepInput {
  telegramId: string | number;
  fullName: string;
  phone: string;
  role: RepRole;
}

export class SalesRepsService {
  private cachedManagerChatIds: number[] | null = null;
  private managerCacheExpiresAt: number = 0;
  public static readonly MANAGER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly notionClient: ResilientNotionClient,
    private readonly databaseId: string = env.NOTION_SALES_REPS_DB_ID
  ) {}

  /**
   * Find a Sales Rep by Telegram ID from the Notion Sales Reps DB.
   */
  public async findSalesRepByTelegramId(telegramId: string | number): Promise<SalesRepRecord | null> {
    const tidString = telegramId.toString().trim();

    // Query by Telegram User ID (rich_text) or title fallback
    let response = (await this.notionClient.queryDatabase(this.databaseId, {
      filter: {
        or: [
          {
            property: "Telegram User ID",
            rich_text: {
              equals: tidString,
            },
          },
          {
            property: "Telegram ID",
            title: {
              equals: tidString,
            },
          },
        ],
      },
    })) as { results: any[] };

    let page = response.results?.[0];

    // Fallback: in case of leading/trailing spaces or case issues in Notion
    if (!page) {
      const allReps = await this.getActiveSalesReps();
      const foundActive = allReps.find((r) => r.telegramId.trim() === tidString);
      if (foundActive) {
        return foundActive;
      }
      return null;
    }
    const props = page.properties;

    const tid =
      props?.["Telegram User ID"]?.rich_text?.[0]?.plain_text ||
      props?.["Telegram ID"]?.rich_text?.[0]?.plain_text ||
      tidString;
    const fullName =
      props?.["Full Name"]?.rich_text?.[0]?.plain_text ||
      props?.["Telegram ID"]?.title?.[0]?.plain_text ||
      props?.["Name"]?.title?.[0]?.plain_text ||
      "";
    const phone = props?.["Phone"]?.phone_number || "";
    const role = (props?.["Role"]?.select?.name as RepRole) || "Sales Rep";
    const status = (props?.["Status"]?.select?.name as RepStatus) || "Pending Approval";

    return {
      pageId: page.id,
      telegramId: tid,
      fullName,
      phone,
      role,
      status,
    };
  }

  /**
   * Returns all sales reps with Status = 'Active'.
   */
  public async getActiveSalesReps(): Promise<SalesRepRecord[]> {
    const response = (await this.notionClient.queryDatabase(this.databaseId, {
      filter: {
        property: "Status",
        select: {
          equals: "Active",
        },
      },
    })) as { results: any[] };

    return (response.results || []).map((page: any) => {
      const props = page.properties;
      const tid =
        props?.["Telegram User ID"]?.rich_text?.[0]?.plain_text ||
        props?.["Telegram ID"]?.rich_text?.[0]?.plain_text ||
        "";
      const fullName =
        props?.["Full Name"]?.rich_text?.[0]?.plain_text ||
        props?.["Telegram ID"]?.title?.[0]?.plain_text ||
        "Sales Rep";

      return {
        pageId: page.id,
        telegramId: tid,
        fullName,
        phone: props?.["Phone"]?.phone_number || "",
        role: (props?.["Role"]?.select?.name as RepRole) || "Sales Rep",
        status: "Active" as RepStatus,
      };
    });
  }

  /**
   * Register a new Sales Rep with Status = 'Pending Approval'.
   */
  public async createSalesRep(input: CreateSalesRepInput): Promise<SalesRepRecord> {
    const tidString = input.telegramId.toString();

    const page = await this.notionClient.createPage({
      parent: { database_id: this.databaseId },
      properties: {
        "Telegram ID": {
          title: [{ text: { content: input.fullName } }],
        },
        "Full Name": {
          rich_text: [{ text: { content: input.fullName } }],
        },
        "Telegram User ID": {
          rich_text: [{ text: { content: tidString } }],
        },
        "Phone": {
          phone_number: input.phone,
        },
        "Role": {
          select: { name: input.role },
        },
        "Status": {
          select: { name: "Pending Approval" },
        },
      },
    });

    return {
      pageId: page.id,
      telegramId: tidString,
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
      status: "Pending Approval",
    };
  }

  /**
   * Update the status of a Sales Rep (e.g. approve or deactivate).
   */
  public async updateSalesRepStatus(pageId: string, status: RepStatus): Promise<void> {
    await this.notionClient.updatePage({
      page_id: pageId,
      properties: {
        Status: {
          select: { name: status },
        },
      },
    });
    this.invalidateManagerCache();
  }

  /**
   * Invalidate the active manager cache (e.g. on role/status change or manual refresh).
   */
  public invalidateManagerCache(): void {
    this.cachedManagerChatIds = null;
    this.managerCacheExpiresAt = 0;
  }

  /**
   * Dynamically query active Executive Managers from the Notion Sales Reps database.
   * Caches results in memory for 5 minutes to respect Notion's 3 req/sec rate limit.
   * Merges with any provided fallback static IDs (e.g. from .env) and deduplicates.
   */
  public async getActiveManagerChatIds(fallbackIds: number[] = []): Promise<number[]> {
    const now = Date.now();
    if (this.cachedManagerChatIds && now < this.managerCacheExpiresAt) {
      return Array.from(new Set([...this.cachedManagerChatIds, ...fallbackIds]));
    }

    try {
      const response = (await this.notionClient.queryDatabase(this.databaseId, {
        filter: {
          and: [
            {
              property: "Status",
              select: {
                equals: "Active",
              },
            },
            {
              property: "Role",
              select: {
                equals: "Manager",
              },
            },
          ],
        },
      })) as { results: any[] };

      const managerIds: number[] = [];
      for (const page of response?.results || []) {
        const props = page.properties;
        const tidStr =
          props?.["Telegram User ID"]?.rich_text?.[0]?.plain_text ||
          props?.["Telegram ID"]?.rich_text?.[0]?.plain_text ||
          props?.["Telegram ID"]?.title?.[0]?.plain_text;

        if (tidStr) {
          const num = parseInt(tidStr.trim(), 10);
          if (!isNaN(num) && num > 0) {
            managerIds.push(num);
          }
        }
      }

      this.cachedManagerChatIds = managerIds;
      this.managerCacheExpiresAt = now + SalesRepsService.MANAGER_CACHE_TTL_MS;

      return Array.from(new Set([...managerIds, ...fallbackIds]));
    } catch (err: any) {
      console.error("Failed to query active managers from Notion, using cached/fallback IDs:", err?.message);
      if (this.cachedManagerChatIds && this.cachedManagerChatIds.length > 0) {
        return Array.from(new Set([...this.cachedManagerChatIds, ...fallbackIds]));
      }
      return Array.from(new Set(fallbackIds));
    }
  }

  /**
   * Check if a Telegram user ID is an authorized active Executive Manager.
   * Checks fallback IDs, cached Notion managers, and live record fallback.
   */
  public async isManager(telegramId: number | string, fallbackIds: number[] = []): Promise<boolean> {
    const numId = typeof telegramId === "number" ? telegramId : parseInt(telegramId.toString().trim(), 10);
    if (!isNaN(numId) && fallbackIds.includes(numId)) {
      return true;
    }

    const managerIds = await this.getActiveManagerChatIds(fallbackIds);
    if (!isNaN(numId) && managerIds.includes(numId)) {
      return true;
    }

    // Direct rep check in case role was just changed in Notion before cache expiration
    try {
      const rep = await this.findSalesRepByTelegramId(telegramId);
      if (rep && rep.status === "Active" && rep.role === "Manager") {
        this.invalidateManagerCache();
        return true;
      }
    } catch {}

    return false;
  }
}
