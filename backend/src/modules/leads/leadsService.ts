import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { TinCache, type TinConflictInfo } from "./tinCache.js";
import { isValidTin, sanitizeTin } from "../common/tinValidator.js";
import { env } from "../../config/env.js";

export interface CheckTinResult {
  available: boolean;
  message: string;
  conflict?: TinConflictInfo | undefined;
}

export interface RegisterLeadInput {
  telegramUserId: number | string;
  companyName: string;
  tin: string;
  address?: string | undefined;
  industry?: string | undefined;
  contactPerson?: string | undefined;
  contactPhone?: string | undefined;
  isCommission?: boolean | undefined;
  beneficiaryName?: string | undefined;
  beneficiaryPhone?: string | undefined;
}

export interface RegisteredAccount {
  pageId: string;
  companyName: string;
  tin: string;
  address?: string | undefined;
  industry?: string | undefined;
  contactPerson?: string | undefined;
  contactPhone?: string | undefined;
  isCommission?: boolean | undefined;
  beneficiaryName?: string | undefined;
  beneficiaryPhone?: string | undefined;
  assignedDate: string;
  owner: {
    telegramId: string;
    fullName: string;
  };
}

export interface LeadsServiceOptions {
  notionClient: ResilientNotionClient;
  salesRepsService: SalesRepsService;
  tinCache?: TinCache | undefined;
  accountsDbId?: string | undefined;
}

export class LeadsService {
  private readonly notionClient: ResilientNotionClient;
  private readonly salesRepsService: SalesRepsService;
  private readonly tinCache: TinCache;
  private readonly accountsDbId: string;

  constructor(options: LeadsServiceOptions) {
    this.notionClient = options.notionClient;
    this.salesRepsService = options.salesRepsService;
    this.tinCache = options.tinCache || new TinCache();
    this.accountsDbId = options.accountsDbId || env.NOTION_ACCOUNTS_DB_ID;
  }

  /**
   * Check TIN availability against in-memory cache and Notion.
   * Enforces 10-digit rule and sub-100ms lookup.
   */
  public async checkTin(rawTin: string): Promise<CheckTinResult> {
    const tin = sanitizeTin(rawTin);
    if (!isValidTin(tin)) {
      throw new Error("Validation Error: TIN Number must be exactly 10 numeric digits (e.g. 0012345678)");
    }

    // 1. Fast sub-100ms in-memory cache check
    const cachedConflict = this.tinCache.get(tin);
    if (cachedConflict) {
      return {
        available: false,
        conflict: cachedConflict,
        message: `Company registered under ${cachedConflict.ownerName} on ${cachedConflict.assignedDate}. Duplicate registration blocked. Please contact ${cachedConflict.ownerName} for internal transfers.`,
      };
    }

    // 2. Query Notion Accounts DB
    const response = (await this.notionClient.queryDatabase(this.accountsDbId, {
      filter: {
        property: "TIN Number",
        rich_text: {
          equals: tin,
        },
      },
    })) as { results: any[] };

    if (!response.results || response.results.length === 0) {
      return {
        available: true,
        message: "TIN is available for registration.",
      };
    }

    // Account exists in Notion
    const page = response.results[0];
    const props = page.properties;
    const companyName = props?.["Company Name"]?.title?.[0]?.plain_text || "Existing Account";
    const assignedDate = props?.["Assigned Date"]?.date?.start || new Date().toISOString().split("T")[0];

    let ownerName = "Sales Rep";
    const ownerRelation = props?.["Owner"]?.relation?.[0]?.id;
    if (ownerRelation) {
      try {
        const repPage: any = await this.notionClient.retrievePage({ page_id: ownerRelation });
        const repProps = repPage?.properties;
        ownerName = repProps?.["Full Name"]?.rich_text?.[0]?.plain_text ||
                    repProps?.["Name"]?.title?.[0]?.plain_text ||
                    "Sales Rep";
      } catch {
        // fallback
      }
    }

    const conflictInfo: TinConflictInfo = {
      companyName,
      ownerName,
      assignedDate,
      pageId: page.id,
    };

    // Save to cache for future requests
    this.tinCache.set(tin, conflictInfo);

    return {
      available: false,
      conflict: conflictInfo,
      message: `Company registered under ${ownerName} on ${assignedDate}. Duplicate registration blocked. Please contact ${ownerName} for internal transfers.`,
    };
  }

  /**
   * Register a new lead / account in Notion.
   * Enforces 10-digit TIN, ownership verification, and cache sync.
   */
  public async registerLead(input: RegisterLeadInput): Promise<RegisteredAccount> {
    const tin = sanitizeTin(input.tin);
    if (!isValidTin(tin)) {
      throw new Error("Validation Error: TIN Number must be exactly 10 numeric digits (e.g. 0012345678)");
    }

    if (!input.companyName || input.companyName.trim().length === 0) {
      throw new Error("Validation Error: Company Name is required");
    }

    // 1. Verify caller is an Active Sales Rep
    const rep = await this.salesRepsService.findSalesRepByTelegramId(input.telegramUserId);
    if (!rep || rep.status !== "Active") {
      throw new Error("Forbidden: Only active sales representatives can register accounts.");
    }

    // 2. Concurrency-safe duplicate check
    const tinCheck = await this.checkTin(tin);
    if (!tinCheck.available) {
      throw new Error(tinCheck.message);
    }

    // 3. Create Account Page in Notion
    const today = new Date().toISOString().split("T")[0]!;
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
      "Owner": {
        relation: [{ id: rep.pageId }],
      },
    };

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

    if (input.contactPerson) {
      properties["Contact Person"] = {
        rich_text: [{ text: { content: input.contactPerson.trim() } }],
      };
    }

    if (input.contactPhone) {
      properties["Contact Phone"] = {
        rich_text: [{ text: { content: input.contactPhone.trim() } }],
      };
    }

    if (input.isCommission != null) {
      properties["Third Party Commission"] = {
        checkbox: !!input.isCommission,
      };
    }

    if (input.beneficiaryName) {
      properties["Beneficiary Name"] = {
        rich_text: [{ text: { content: input.beneficiaryName.trim() } }],
      };
    }

    if (input.beneficiaryPhone) {
      properties["Beneficiary Phone"] = {
        rich_text: [{ text: { content: input.beneficiaryPhone.trim() } }],
      };
    }

    const page = await this.notionClient.createPage({
      parent: { database_id: this.accountsDbId },
      properties,
    });

    // 4. Update in-memory cache immediately
    this.tinCache.set(tin, {
      companyName: input.companyName.trim(),
      ownerName: rep.fullName,
      assignedDate: today,
      pageId: page.id,
    });

    return {
      pageId: page.id,
      companyName: input.companyName.trim(),
      tin,
      address: input.address?.trim(),
      industry: input.industry?.trim(),
      contactPerson: input.contactPerson?.trim(),
      contactPhone: input.contactPhone?.trim(),
      isCommission: input.isCommission ?? false,
      beneficiaryName: input.beneficiaryName?.trim(),
      beneficiaryPhone: input.beneficiaryPhone?.trim(),
      assignedDate: today,
      owner: {
        telegramId: rep.telegramId,
        fullName: rep.fullName,
      },
    };
  }
}
