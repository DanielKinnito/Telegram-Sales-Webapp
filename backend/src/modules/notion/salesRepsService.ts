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
  constructor(
    private readonly notionClient: ResilientNotionClient,
    private readonly databaseId: string = env.NOTION_SALES_REPS_DB_ID
  ) {}

  /**
   * Find a Sales Rep by Telegram ID from the Notion Sales Reps DB.
   */
  public async findSalesRepByTelegramId(telegramId: string | number): Promise<SalesRepRecord | null> {
    const tidString = telegramId.toString();

    const response = (await this.notionClient.queryDatabase(this.databaseId, {
      filter: {
        property: "Telegram ID",
        title: {
          equals: tidString,
        },
      },
    })) as { results: any[] };

    if (!response.results || response.results.length === 0) {
      return null;
    }

    const page = response.results[0];
    const props = page.properties;

    const tid = props?.["Telegram ID"]?.title?.[0]?.plain_text || tidString;
    const fullName = props?.["Full Name"]?.rich_text?.[0]?.plain_text || "";
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
      return {
        pageId: page.id,
        telegramId: props?.["Telegram ID"]?.title?.[0]?.plain_text || "",
        fullName: props?.["Full Name"]?.rich_text?.[0]?.plain_text || "Sales Rep",
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
          title: [{ text: { content: tidString } }],
        },
        "Full Name": {
          rich_text: [{ text: { content: input.fullName } }],
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
  }
}
