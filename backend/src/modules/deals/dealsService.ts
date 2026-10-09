import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { env } from "../../config/env.js";

export interface DealRecord {
  pageId: string;
  title: string;
  stage: string;
  amount: number | null;
  depositRef: string | null;
  proofUrl: string | null;
  companyName?: string | null;
  tin?: string | null;
  address?: string | null;
  industry?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  isCommission?: boolean | null;
  beneficiaryName?: string | null;
  beneficiaryPhone?: string | null;
}

export interface ActivityRecord {
  pageId: string;
  type: "Note" | "Call" | "Meeting";
  content: string;
  activityDate: string;
  scheduledTime?: string | null;
  repId?: string | null;
  companyName?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
}

export interface AddActivityInput {
  dealId?: string | undefined;
  type: "Note" | "Call" | "Meeting";
  content: string;
  scheduledDate?: string | undefined;
  scheduledTime?: string | undefined;
  repTelegramId: number | string;
  repName?: string | undefined;
  companyName?: string | undefined;
  contactPerson?: string | undefined;
  contactPhone?: string | undefined;
}

export interface SubmitPaymentProofInput {
  dealId: string;
  proofUrl: string;
  depositRef?: string | undefined;
  submittedByTelegramId?: number | string | undefined;
  submittedByName?: string | undefined;
}

export interface SubmitPaymentProofResult {
  success: boolean;
  deal: {
    pageId: string;
    title: string;
    stage: string;
    amount: number | null;
    depositRef: string;
    proofUrl: string;
  };
  managersNotified: number;
}

export interface DealsServiceOptions {
  notionClient: ResilientNotionClient;
  salesRepsService?: SalesRepsService | undefined;
  dealsDbId?: string | undefined;
  salesLogsDbId?: string | undefined;
  managerChatIds?: number[] | undefined;
  bot?: any | undefined;
}

export class DealsService {
  private readonly notionClient: ResilientNotionClient;
  private readonly salesRepsService?: SalesRepsService | undefined;
  private readonly dealsDbId: string;
  private readonly salesLogsDbId: string;
  private readonly managerChatIds: number[];
  private readonly bot?: any;

  constructor(options: DealsServiceOptions) {
    this.notionClient = options.notionClient;
    this.salesRepsService = options.salesRepsService;
    this.dealsDbId = options.dealsDbId || env.NOTION_DEALS_DB_ID;
    this.salesLogsDbId = options.salesLogsDbId || env.NOTION_SALES_LOGS_DB_ID;
    this.managerChatIds = options.managerChatIds || [];
    this.bot = options.bot;
  }

  /**
   * Retrieves all Deals assigned to a specific Sales Rep in Notion.
   * Also includes any Accounts created by this rep.
   */
  public async listDealsForRep(repPageId: string): Promise<DealRecord[]> {
    const deals: DealRecord[] = [];

    try {
      // 1. Query Deals DB
      const response = (await this.notionClient.queryDatabase(this.dealsDbId, {
        filter: {
          property: "Assigned Rep",
          relation: {
            contains: repPageId,
          },
        },
      })) as { results: any[] };

      for (const page of response.results || []) {
        const props = page.properties;
        const title =
          props?.["Deal Title"]?.title?.[0]?.plain_text ||
          props?.["Name"]?.title?.[0]?.plain_text ||
          "Untitled Deal";
        const stage = props?.["Stage"]?.select?.name || "New";
        const amount = props?.["Amount"]?.number ?? null;
        const depositRef = props?.["Deposit Ref #"]?.rich_text?.[0]?.plain_text ?? null;
        const proofUrl = props?.["Payment Proof URL"]?.url ?? null;

        deals.push({
          pageId: page.id,
          title,
          stage,
          amount,
          depositRef,
          proofUrl,
        });
      }
    } catch (err: any) {
      console.warn("Could not query Deals DB for rep:", err.message);
    }

    try {
      // 2. Query Accounts DB owned by this rep
      const accountsResponse = (await this.notionClient.queryDatabase(env.NOTION_ACCOUNTS_DB_ID, {
        filter: {
          property: "Owner",
          relation: {
            contains: repPageId,
          },
        },
      })) as { results: any[] };

      for (const page of accountsResponse.results || []) {
        const props = page.properties;
        const companyName =
          props?.["Name"]?.title?.[0]?.plain_text ||
          props?.["Company Name"]?.title?.[0]?.plain_text ||
          "Client Account";
        const tin = props?.["TIN Number"]?.rich_text?.[0]?.plain_text || null;
        const address = props?.["Address"]?.rich_text?.[0]?.plain_text || null;
        const industry = props?.["Industry"]?.select?.name || null;
        const contactPerson = props?.["Contact Person"]?.rich_text?.[0]?.plain_text || null;
        const contactPhone = props?.["Contact Phone"]?.rich_text?.[0]?.plain_text || null;
        const isCommission = props?.["Third Party Commission"]?.checkbox ?? false;
        const beneficiaryName = props?.["Beneficiary Name"]?.rich_text?.[0]?.plain_text || null;
        const beneficiaryPhone = props?.["Beneficiary Phone"]?.rich_text?.[0]?.plain_text || null;

        const existingIndex = deals.findIndex((d) => d.title.includes(companyName));
        if (existingIndex >= 0) {
          deals[existingIndex] = {
            ...deals[existingIndex]!,
            companyName,
            tin,
            address,
            industry,
            contactPerson,
            contactPhone,
            isCommission,
            beneficiaryName,
            beneficiaryPhone,
          };
        } else {
          deals.push({
            pageId: page.id,
            title: `${companyName} Order`,
            stage: "Proposal",
            amount: null,
            depositRef: null,
            proofUrl: null,
            companyName,
            tin,
            address,
            industry,
            contactPerson,
            contactPhone,
            isCommission,
            beneficiaryName,
            beneficiaryPhone,
          });
        }
      }
    } catch (err: any) {
      console.warn("Could not query Accounts DB for rep:", err.message);
    }

    return deals;
  }

  /**
   * Retrieves all Deals across the entire organization (for managers).
   */
  public async listAllDeals(): Promise<DealRecord[]> {
    const response = (await this.notionClient.queryDatabase(this.dealsDbId)) as { results: any[] };
    const deals: DealRecord[] = [];

    for (const page of response.results || []) {
      const props = page.properties;
      const title =
        props?.["Deal Title"]?.title?.[0]?.plain_text ||
        props?.["Name"]?.title?.[0]?.plain_text ||
        "Untitled Deal";
      const stage = props?.["Stage"]?.select?.name || "New";
      const amount = props?.["Amount"]?.number ?? null;
      const depositRef = props?.["Deposit Ref #"]?.rich_text?.[0]?.plain_text ?? null;
      const proofUrl = props?.["Payment Proof URL"]?.url ?? null;

      deals.push({
        pageId: page.id,
        title,
        stage,
        amount,
        depositRef,
        proofUrl,
      });
    }

    return deals;
  }

  /**
   * Retrieves a Deal record from Notion by page ID (handles both Deals DB pages and Accounts DB pages).
   */
  public async getDeal(pageId: string): Promise<DealRecord> {
    try {
      const page: any = await this.notionClient.retrievePage({ page_id: pageId });
      const props = page.properties;

      const title =
        props?.["Deal Title"]?.title?.[0]?.plain_text ||
        props?.["Name"]?.title?.[0]?.plain_text ||
        props?.["Company Name"]?.title?.[0]?.plain_text ||
        "Untitled Deal";
      const stage = props?.["Stage"]?.select?.name || "Proposal";
      const amount = props?.["Amount"]?.number ?? null;
      const depositRef = props?.["Deposit Ref #"]?.rich_text?.[0]?.plain_text ?? null;
      const proofUrl = props?.["Payment Proof URL"]?.url ?? null;

      return {
        pageId: page.id,
        title,
        stage,
        amount,
        depositRef,
        proofUrl,
      };
    } catch {
      throw new Error(`Deal not found: ${pageId}`);
    }
  }

  /**
   * Submits a payment proof for a deal, updates Notion stage to 'Payment Pending Verification',
   * and notifies managers via Telegram push.
   * Resiliently handles both Deal DB records and newly registered Account records.
   */
  public async submitPaymentProof(
    input: SubmitPaymentProofInput
  ): Promise<SubmitPaymentProofResult> {
    if (
      !input.proofUrl ||
      typeof input.proofUrl !== "string" ||
      !input.proofUrl.trim().startsWith("http")
    ) {
      throw new Error("Validation Error: A valid transaction link starting with https:// or http:// is required");
    }

    const finalDepositRef =
      input.depositRef && input.depositRef.trim().length > 0
        ? input.depositRef.trim()
        : "Bank Share Link";

    // 1. Retrieve the target page to detect if it's already a Deal or an Account page
    let targetPage: any;
    try {
      targetPage = await this.notionClient.retrievePage({ page_id: input.dealId });
    } catch {
      throw new Error(`Deal not found: ${input.dealId}`);
    }

    const targetDbId = targetPage.parent?.database_id?.replace(/-/g, "");
    const accountsDbCleanId = env.NOTION_ACCOUNTS_DB_ID?.replace(/-/g, "");

    // Detect if the target is an Account page rather than a Deal page
    const isAccountPage = Boolean(
      (targetDbId && accountsDbCleanId && targetDbId === accountsDbCleanId) ||
      (targetPage.properties?.["TIN Number"] && !targetPage.properties?.["Stage"])
    );

    let dealPageId = input.dealId;
    let dealTitle =
      targetPage.properties?.["Deal Title"]?.title?.[0]?.plain_text ||
      targetPage.properties?.["Name"]?.title?.[0]?.plain_text ||
      targetPage.properties?.["Company Name"]?.title?.[0]?.plain_text ||
      "Client Order";
    let dealAmount: number | null = targetPage.properties?.["Amount"]?.number ?? null;

    if (isAccountPage) {
      // The page ID came from Accounts DB!
      // Check if a Deal already exists in Deals DB linked to this Account
      let linkedDealsRes: { results?: any[] } = {};
      try {
        linkedDealsRes = (await this.notionClient.queryDatabase(this.dealsDbId, {
          filter: {
            property: "Account",
            relation: {
              contains: input.dealId,
            },
          },
        })) || {};
      } catch {
        linkedDealsRes = { results: [] };
      }

      if (linkedDealsRes.results && linkedDealsRes.results.length > 0) {
        const existingDeal = linkedDealsRes.results[0];
        dealPageId = existingDeal.id;
        dealTitle =
          existingDeal.properties?.["Deal Title"]?.title?.[0]?.plain_text ||
          dealTitle;
        dealAmount = existingDeal.properties?.["Amount"]?.number ?? dealAmount;

        // Update the existing linked Deal
        await this.notionClient.updatePage({
          page_id: dealPageId,
          properties: {
            "Stage": {
              select: { name: "Payment Pending Verification" },
            },
            "Deposit Ref #": {
              rich_text: [{ text: { content: finalDepositRef } }],
            },
            "Payment Proof URL": {
              url: input.proofUrl.trim(),
            },
          },
        });
      } else {
        // Create a new Deal record in Deals DB linked to this Account
        const repRelation = targetPage.properties?.["Owner"]?.relation?.[0]?.id;
        const dealProps: Record<string, any> = {
          "Deal Title": {
            title: [{ text: { content: dealTitle.endsWith("Order") ? dealTitle : `${dealTitle} Order` } }],
          },
          "Stage": {
            select: { name: "Payment Pending Verification" },
          },
          "Deposit Ref #": {
            rich_text: [{ text: { content: finalDepositRef } }],
          },
          "Payment Proof URL": {
            url: input.proofUrl.trim(),
          },
          "Account": {
            relation: [{ id: input.dealId }],
          },
        };

        if (repRelation) {
          dealProps["Assigned Rep"] = {
            relation: [{ id: repRelation }],
          };
        }

        const newDealPage = await this.notionClient.createPage({
          parent: { database_id: this.dealsDbId },
          properties: dealProps,
        });

        dealPageId = newDealPage.id;
      }
    } else {
      // Target is directly a Deal page in Deals DB
      await this.notionClient.updatePage({
        page_id: dealPageId,
        properties: {
          "Stage": {
            select: { name: "Payment Pending Verification" },
          },
          "Deposit Ref #": {
            rich_text: [{ text: { content: finalDepositRef } }],
          },
          "Payment Proof URL": {
            url: input.proofUrl.trim(),
          },
        },
      });
    }

    // 3. Dispatch Telegram notifications to Managers
    let managersNotified = 0;
    if (this.bot && this.managerChatIds.length > 0) {
      const amountFormatted =
        dealAmount != null ? `ETB ${Number(dealAmount).toLocaleString()}` : "N/A";
      const submitter = input.submittedByName || "Sales Representative";

      const message =
        `💳 *Bank Payment Transaction Link Submitted!*\n\n` +
        `• *Deal:* ${dealTitle}\n` +
        `• *Amount:* ${amountFormatted}\n` +
        `• *Reference / Note:* ${finalDepositRef}\n` +
        `• *Submitted by:* ${submitter}\n\n` +
        `🔗 [Click to View Bank Transaction Details](${input.proofUrl.trim()})\n\n` +
        `_Open Notion to verify the deposit and move this deal to Won._`;

      for (const chatId of this.managerChatIds) {
        try {
          await this.bot.api.sendMessage(chatId, message, {
            parse_mode: "Markdown",
          });
          managersNotified++;
        } catch (err) {
          console.error(`Failed to send Telegram verification alert to manager ${chatId}:`, err);
        }
      }
    }

    return {
      success: true,
      deal: {
        pageId: dealPageId,
        title: dealTitle,
        stage: "Payment Pending Verification",
        amount: dealAmount,
        depositRef: finalDepositRef,
        proofUrl: input.proofUrl.trim(),
      },
      managersNotified,
    };
  }

  /**
   * Log a progress note or schedule a follow-up call.
   */
  public async addActivity(input: AddActivityInput): Promise<ActivityRecord> {
    const today = new Date().toISOString().split("T")[0]!;
    const activityDate = input.scheduledDate || today;
    const repIdStr = String(input.repTelegramId);

    const properties: Record<string, any> = {
      "Log Title / ID": {
        title: [{ text: { content: `[${input.type}] ${input.companyName || "Activity"}` } }],
      },
      "Interaction Type": {
        select: { name: input.type },
      },
      "Note Content": {
        rich_text: [{ text: { content: input.content.trim() } }],
      },
      "Activity Date": {
        date: { start: activityDate },
      },
      "Rep ID": {
        rich_text: [{ text: { content: repIdStr } }],
      },
    };

    if (input.companyName) {
      properties["Company Name"] = {
        rich_text: [{ text: { content: input.companyName.trim() } }],
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
    if (input.scheduledTime) {
      properties["Scheduled Time"] = {
        rich_text: [{ text: { content: input.scheduledTime.trim() } }],
      };
    }

    properties["Reminder Sent"] = {
      checkbox: false,
    };

    const page = await this.notionClient.createPage({
      parent: { database_id: this.salesLogsDbId },
      properties,
    });

    // If it's a scheduled Call, send confirmation via bot to rep
    if (input.type === "Call" && this.bot && repIdStr) {
      try {
        const chatId = Number.isInteger(Number(repIdStr)) ? Number(repIdStr) : repIdStr;
        const timePart = input.scheduledTime ? ` at ${input.scheduledTime}` : "";
        const contactPart = input.contactPerson
          ? `\n• *Contact:* ${input.contactPerson}${input.contactPhone ? ` (${input.contactPhone})` : ""}`
          : "";

        const message =
          `📞 *Call Scheduled!*\n\n` +
          `• *Company:* ${input.companyName || "Client Account"}` +
          contactPart +
          `\n• *Date:* ${activityDate}${timePart}\n` +
          `• *Objective:* ${input.content}\n\n` +
          `⏰ _The bot will send you a reminder alert when this call date arrives._`;

        await this.bot.api.sendMessage(chatId, message, { parse_mode: "Markdown" });

        // Precision timer: If call is scheduled within the next 24 hours, fire at the exact minute
        if (input.scheduledTime) {
          const targetDateTimeStr = `${activityDate}T${input.scheduledTime}:00+03:00`;
          const targetMs = new Date(targetDateTimeStr).getTime();
          const delayMs = targetMs - Date.now();

          if (delayMs > 0 && delayMs <= 24 * 60 * 60 * 1000) {
            setTimeout(async () => {
              try {
                const freshPage: any = await this.notionClient.retrievePage({ page_id: page.id });
                if (freshPage?.properties?.["Reminder Sent"]?.checkbox === true) {
                  return;
                }

                const alertMsg =
                  `🔔 *CALL REMINDER: TIME ARRIVED!*\n\n` +
                  `🏢 *Company:* ${input.companyName || "Client Account"}` +
                  contactPart +
                  `\n⏰ *Scheduled Time:* ${input.scheduledTime}` +
                  `\n📝 *Objective:* ${input.content}\n\n` +
                  `📞 _Open your Sales Mini App to make the call and log progress notes._`;

                await this.bot.api.sendMessage(chatId, alertMsg, { parse_mode: "Markdown" });

                await this.notionClient.updatePage({
                  page_id: page.id,
                  properties: {
                    "Reminder Sent": { checkbox: true },
                  },
                });
              } catch (timeoutErr: any) {
                console.warn("In-memory call reminder timeout error:", timeoutErr.message);
              }
            }, delayMs);
          }
        }
      } catch (err: any) {
        console.warn("Could not dispatch call schedule notification to rep:", err.message);
      }
    }

    return {
      pageId: page.id,
      type: input.type,
      content: input.content.trim(),
      activityDate,
      scheduledTime: input.scheduledTime || null,
      repId: repIdStr,
      companyName: input.companyName || null,
      contactPerson: input.contactPerson || null,
      contactPhone: input.contactPhone || null,
    };
  }

  /**
   * List activities / notes for a deal or company.
   */
  public async listActivities(dealId?: string, companyName?: string): Promise<ActivityRecord[]> {
    try {
      const response = (await this.notionClient.queryDatabase(this.salesLogsDbId, {})) as {
        results: any[];
      };

      const activities: ActivityRecord[] = [];
      for (const page of response.results || []) {
        const props = page.properties;
        const pageCompanyName = props?.["Company Name"]?.rich_text?.[0]?.plain_text;
        const title = props?.["Log Title / ID"]?.title?.[0]?.plain_text || "";

        // Filter by companyName if supplied
        if (
          companyName &&
          pageCompanyName &&
          !pageCompanyName.toLowerCase().includes(companyName.toLowerCase()) &&
          !title.toLowerCase().includes(companyName.toLowerCase())
        ) {
          continue;
        }

        const type = (props?.["Interaction Type"]?.select?.name as any) || "Note";
        const content = props?.["Note Content"]?.rich_text?.[0]?.plain_text || "";
        const activityDate = props?.["Activity Date"]?.date?.start || "";
        const scheduledTime = props?.["Scheduled Time"]?.rich_text?.[0]?.plain_text || null;
        const repId = props?.["Rep ID"]?.rich_text?.[0]?.plain_text || null;
        const contactPerson = props?.["Contact Person"]?.rich_text?.[0]?.plain_text || null;
        const contactPhone = props?.["Contact Phone"]?.rich_text?.[0]?.plain_text || null;

        activities.push({
          pageId: page.id,
          type,
          content,
          activityDate,
          scheduledTime,
          repId,
          companyName: pageCompanyName || null,
          contactPerson,
          contactPhone,
        });
      }

      // Sort newest date first
      activities.sort((a, b) => b.activityDate.localeCompare(a.activityDate));
      return activities;
    } catch (err: any) {
      console.warn("Could not query Sales Logs DB:", err.message);
      return [];
    }
  }
}
