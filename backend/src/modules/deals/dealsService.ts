import type { ResilientNotionClient } from "../notion/notionClient.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { ProformaPdfService, type ProformaInvoiceData } from "../proforma/proformaPdfService.js";
import { InputFile } from "grammy";
import { env } from "../../config/env.js";

export function formatTimeTo12Hour(timeStr: string): string {
  if (!timeStr) return timeStr;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return timeStr;
  let hours = parseInt(match[1]!, 10);
  const minutes = match[2]!;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

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
  productType?: string | null;
  offerAmount?: number | null;
  lostReason?: string | null;
  repName?: string | null;
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
  public async listDealsForRep(repPageId: string, repFullName?: string): Promise<DealRecord[]> {
    const deals: DealRecord[] = [];

    try {
      // 1. Query Deals DB
      // If repFullName is provided, filter by "Rep Name"; otherwise query all and filter in memory
      const filterObj: Record<string, any> = {};
      if (repFullName && repFullName.trim().length > 0) {
        filterObj.filter = {
          property: "Rep Name",
          rich_text: {
            equals: repFullName.trim(),
          },
        };
      }

      const response = (await this.notionClient.queryDatabase(this.dealsDbId, filterObj)) as { results: any[] };

      for (const page of response.results || []) {
        const props = page.properties;
        const repNameVal = props?.["Rep Name"]?.rich_text?.[0]?.plain_text || "";

        // If repFullName was passed, ensure case-insensitive or exact match
        if (
          repFullName &&
          repFullName.trim().length > 0 &&
          repNameVal.trim().toLowerCase() !== repFullName.trim().toLowerCase()
        ) {
          continue;
        }

        const title =
          props?.["Deal Title"]?.title?.[0]?.plain_text ||
          props?.["Name"]?.title?.[0]?.plain_text ||
          "Untitled Deal";
        const stage = props?.["Stage"]?.select?.name || "Proposal";
        const amount = props?.["Amount"]?.number ?? props?.["Offer VAT Incl"]?.number ?? null;
        const depositRef = props?.["Deposit Ref #"]?.rich_text?.[0]?.plain_text ?? null;
        const proofUrl = props?.["Payment Proof URL"]?.url ?? null;
        const productType = props?.["Product Type"]?.rich_text?.[0]?.plain_text ?? null;
        const offerAmount = props?.["Offer VAT Incl"]?.number ?? amount;
        const lostReason = props?.["Lost Reason"]?.rich_text?.[0]?.plain_text ?? null;
        const companyName = props?.["Account Name"]?.rich_text?.[0]?.plain_text ?? null;

        deals.push({
          pageId: page.id,
          title,
          stage,
          amount,
          depositRef,
          proofUrl,
          companyName,
          productType,
          offerAmount,
          lostReason,
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

        const cleanComp = companyName.trim().toLowerCase();
        const existingIndex = deals.findIndex(
          (d) =>
            (d.companyName && d.companyName.trim().toLowerCase() === cleanComp) ||
            d.title.trim().toLowerCase().includes(cleanComp) ||
            cleanComp.includes(d.title.replace(/ Order$/i, "").trim().toLowerCase())
        );

        if (existingIndex >= 0) {
          deals[existingIndex] = {
            ...deals[existingIndex]!,
            companyName: deals[existingIndex]!.companyName || companyName,
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
            productType: null,
            offerAmount: null,
            lostReason: null,
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
      const amount = props?.["Amount"]?.number ?? props?.["Offer VAT Incl"]?.number ?? null;
      const depositRef = props?.["Deposit Ref #"]?.rich_text?.[0]?.plain_text ?? null;
      const proofUrl = props?.["Payment Proof URL"]?.url ?? null;
      const productType = props?.["Product Type"]?.rich_text?.[0]?.plain_text ?? null;
      const offerAmount = props?.["Offer VAT Incl"]?.number ?? amount;
      const lostReason = props?.["Lost Reason"]?.rich_text?.[0]?.plain_text ?? null;

      deals.push({
        pageId: page.id,
        title,
        stage,
        amount,
        depositRef,
        proofUrl,
        productType,
        offerAmount,
        lostReason,
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
      const amount = props?.["Amount"]?.number ?? props?.["Offer VAT Incl"]?.number ?? null;
      const depositRef = props?.["Deposit Ref #"]?.rich_text?.[0]?.plain_text ?? null;
      const proofUrl = props?.["Payment Proof URL"]?.url ?? null;
      const productType = props?.["Product Type"]?.rich_text?.[0]?.plain_text ?? null;
      const offerAmount = props?.["Offer VAT Incl"]?.number ?? amount;
      const lostReason = props?.["Lost Reason"]?.rich_text?.[0]?.plain_text ?? null;
      const repName = props?.["Rep Name"]?.rich_text?.[0]?.plain_text || null;
      const companyName =
        props?.["Account Name"]?.rich_text?.[0]?.plain_text ||
        props?.["Company Name"]?.title?.[0]?.plain_text ||
        props?.["Company Name"]?.rich_text?.[0]?.plain_text ||
        null;
      const tin =
        props?.["TIN"]?.rich_text?.[0]?.plain_text ||
        props?.["TIN"]?.title?.[0]?.plain_text ||
        null;

      return {
        pageId: page.id,
        title,
        stage,
        amount,
        depositRef,
        proofUrl,
        productType,
        offerAmount,
        lostReason,
        repName,
        companyName,
        tin,
      };
    } catch {
      throw new Error(`Deal not found: ${pageId}`);
    }
  }

  /**
   * Constructs the structured Proforma Invoice data for a deal, including customer info,
   * 15% VAT amounts, equipment description, and assigned sales representative contact details.
   */
  public async getProformaInvoiceData(dealId: string): Promise<ProformaInvoiceData> {
    const deal = await this.getDeal(dealId);
    let repPhone = "N/A";

    if (deal.repName && this.salesRepsService) {
      try {
        const reps = await this.salesRepsService.getActiveSalesReps();
        const found = reps.find(
          (r) => r.fullName.trim().toLowerCase() === deal.repName!.trim().toLowerCase()
        );
        if (found && found.phone) {
          repPhone = found.phone;
        }
      } catch {}
    }

    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedDate = `${months[now.getMonth()]}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;

    const cleanId = dealId.replace(/-/g, "").slice(-4).toUpperCase() || "0100";
    const yearShort = String(now.getFullYear()).slice(-2);
    const refNo = `PI/${cleanId}/YC/${yearShort}`;

    const totalAmount = deal.offerAmount ?? deal.amount ?? 0;
    const customer = deal.companyName || deal.title.replace(/ Order$/, "").trim() || "Valued Customer";

    return {
      dealId: deal.pageId,
      refNo,
      date: formattedDate,
      customerName: customer,
      customerTin: deal.tin || undefined,
      productDescription: deal.productType || "SILENT DIESEL GENERATOR SET (Standard Industrial Supply)",
      totalAmountVatIncl: totalAmount,
      repName: deal.repName || "Sales Representative",
      repPhone,
    };
  }

  /**
   * Searches for deals by customer company name, deal title, or TIN.
   * Supports natural company name queries like "inova", "inova plc", "inova plc order".
   */
  public async searchDeals(
    query: string,
    caller?: { isManager: boolean; repPageId?: string; repFullName?: string }
  ): Promise<DealRecord[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // If query looks like a Notion page UUID (32 hex characters or 36 chars with hyphens)
    const isUuid = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid) {
      try {
        const singleDeal = await this.getDeal(trimmed);
        return [singleDeal];
      } catch {}
    }

    // Otherwise, search across candidate deals
    const allCandidateDeals = caller?.isManager
      ? await this.listAllDeals()
      : caller?.repPageId
      ? await this.listDealsForRep(caller.repPageId, caller.repFullName)
      : await this.listAllDeals();

    const normalizedQuery = trimmed.toLowerCase();
    const queryTokens = normalizedQuery.split(/[\s\-_]+/).filter((t) => t.length > 0);

    return allCandidateDeals.filter((deal) => {
      const title = (deal.title || "").toLowerCase();
      const company = (deal.companyName || "").toLowerCase();
      const tin = (deal.tin || "").toLowerCase();
      const product = (deal.productType || "").toLowerCase();
      const combined = `${title} ${company} ${tin} ${product}`;

      if (combined.includes(normalizedQuery)) return true;
      return queryTokens.every((token) => combined.includes(token));
    });
  }

  /**
   * Generates a branded corporate Proforma Invoice PDF and dispatches it directly
   * into the user's private Telegram chat via the bot.
   */
  public async sendProformaInvoiceToTelegram(
    dealId: string,
    telegramChatId: number | string
  ): Promise<{ success: boolean; sentToChatId: string | number }> {
    const proformaData = await this.getProformaInvoiceData(dealId);
    const pdfBuffer = await ProformaPdfService.generateProformaPdf(proformaData);
    const safeName = (proformaData.customerName || dealId).replace(/[^a-zA-Z0-9_-]/g, "_");

    if (this.bot?.api?.sendDocument) {
      await this.bot.api.sendDocument(
        telegramChatId,
        new InputFile(pdfBuffer, `Proforma_Invoice_${safeName}.pdf`),
        {
          caption:
            `📄 *YC Electric Equipment Manufacturing PLC*\n` +
            `*PROFORMA INVOICE*\n\n` +
            `• *Customer:* ${proformaData.customerName}\n` +
            `• *Ref No:* ${proformaData.refNo}\n` +
            `• *Total Price (incl. 15% VAT):* ETB ${proformaData.totalAmountVatIncl.toLocaleString()}\n` +
            `• *Representative:* ${proformaData.repName} (${proformaData.repPhone})`,
          parse_mode: "Markdown",
        }
      );
    }

    return { success: true, sentToChatId: telegramChatId };
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
      // Check if a Deal already exists in Deals DB for this Account Name or Deal Title
      const cleanCompanyName = dealTitle.replace(/ Order$/, "");
      const expectedDealTitle = `${cleanCompanyName} Order`;

      let linkedDealsRes: { results?: any[] } = {};
      try {
        linkedDealsRes = (await this.notionClient.queryDatabase(this.dealsDbId, {
          filter: {
            or: [
              {
                property: "Account Name",
                rich_text: { equals: cleanCompanyName },
              },
              {
                property: "Deal Title",
                title: { equals: expectedDealTitle },
              },
            ],
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
        const repName = input.submittedByName || "Sales Representative";
        const dealProps: Record<string, any> = {
          "Deal Title": {
            title: [{ text: { content: expectedDealTitle } }],
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
          "Account Name": {
            rich_text: [{ text: { content: cleanCompanyName } }],
          },
          "Rep Name": {
            rich_text: [{ text: { content: repName } }],
          },
        };

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
    const managerIds = this.salesRepsService?.getActiveManagerChatIds
      ? await this.salesRepsService.getActiveManagerChatIds(this.managerChatIds)
      : this.managerChatIds;

    if (this.bot && managerIds.length > 0) {
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

      for (const chatId of managerIds) {
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
   * Updates deal stage (e.g. 'Won', 'Lost') and records reason or offer if provided.
   * Handles both Deals DB pages and Accounts DB pages resiliently.
   */
  public async updateDealStage(
    dealId: string,
    input: {
      stage: string;
      reason?: string | undefined;
      productType?: string | undefined;
      offerAmount?: number | undefined;
      updatedByTelegramId?: number | string | undefined;
      updatedByName?: string | undefined;
    }
  ): Promise<DealRecord> {
    let targetPage: any;
    try {
      targetPage = await this.notionClient.retrievePage({ page_id: dealId });
    } catch {
      throw new Error(`Deal not found: ${dealId}`);
    }

    const targetDbId = targetPage.parent?.database_id?.replace(/-/g, "");
    const accountsDbCleanId = env.NOTION_ACCOUNTS_DB_ID?.replace(/-/g, "");
    const isAccountPage = Boolean(
      (targetDbId && accountsDbCleanId && targetDbId === accountsDbCleanId) ||
      (targetPage.properties?.["TIN Number"] && !targetPage.properties?.["Stage"])
    );

    let dealPageId = dealId;
    let dealTitle =
      targetPage.properties?.["Deal Title"]?.title?.[0]?.plain_text ||
      targetPage.properties?.["Name"]?.title?.[0]?.plain_text ||
      targetPage.properties?.["Company Name"]?.title?.[0]?.plain_text ||
      "Client Order";
    let dealAmount: number | null = targetPage.properties?.["Amount"]?.number ?? (input.offerAmount ?? null);
    let productType = targetPage.properties?.["Product Type"]?.rich_text?.[0]?.plain_text ?? (input.productType ?? null);
    let lostReason = targetPage.properties?.["Lost Reason"]?.rich_text?.[0]?.plain_text ?? (input.reason ?? null);

    const updateProps: Record<string, any> = {
      "Stage": {
        select: { name: input.stage },
      },
    };

    if (input.reason) {
      updateProps["Lost Reason"] = {
        rich_text: [{ text: { content: input.reason.trim() } }],
      };
      lostReason = input.reason.trim();
    }

    if (input.productType) {
      updateProps["Product Type"] = {
        rich_text: [{ text: { content: input.productType.trim() } }],
      };
      productType = input.productType.trim();
    }

    if (input.offerAmount != null) {
      updateProps["Offer VAT Incl"] = {
        number: input.offerAmount,
      };
      updateProps["Amount"] = {
        number: input.offerAmount,
      };
      dealAmount = input.offerAmount;
    }

    if (isAccountPage) {
      const cleanCompanyName = dealTitle.replace(/ Order$/, "");
      const expectedDealTitle = `${cleanCompanyName} Order`;

      let linkedDealsRes: { results?: any[] } = {};
      try {
        linkedDealsRes = (await this.notionClient.queryDatabase(this.dealsDbId, {
          filter: {
            or: [
              {
                property: "Account Name",
                rich_text: { equals: cleanCompanyName },
              },
              {
                property: "Deal Title",
                title: { equals: expectedDealTitle },
              },
            ],
          },
        })) || {};
      } catch {
        linkedDealsRes = { results: [] };
      }

      if (linkedDealsRes.results && linkedDealsRes.results.length > 0) {
        const existingDeal = linkedDealsRes.results[0];
        dealPageId = existingDeal.id;
        await this.notionClient.updatePage({
          page_id: dealPageId,
          properties: updateProps,
        });
      } else {
        const repName = input.updatedByName || "Sales Representative";
        const newDealProps: Record<string, any> = {
          "Deal Title": {
            title: [{ text: { content: expectedDealTitle } }],
          },
          "Account Name": {
            rich_text: [{ text: { content: cleanCompanyName } }],
          },
          "Rep Name": {
            rich_text: [{ text: { content: repName } }],
          },
          ...updateProps,
        };

        const newDealPage = await this.notionClient.createPage({
          parent: { database_id: this.dealsDbId },
          properties: newDealProps,
        });
        dealPageId = newDealPage.id;
      }
    } else {
      await this.notionClient.updatePage({
        page_id: dealPageId,
        properties: updateProps,
      });
    }

    // Also record a Sales Log entry in CRM timeline
    try {
      const today = new Date().toISOString().split("T")[0]!;
      let logTitle = `Deal Status: ${input.stage}`;
      let logNote = `Deal marked as ${input.stage}.`;

      if (input.stage === "Won") {
        logTitle = "Deal Completed & Won";
        logNote = `Deal marked as Completed & Won${input.offerAmount ? ` for ${input.offerAmount.toLocaleString()} ETB` : ""}.`;
      } else if (input.stage === "Lost") {
        logTitle = "Deal Lost";
        logNote = `Deal marked as Lost.${input.reason ? ` Reason: ${input.reason}` : ""}`;
      }

      await this.notionClient.createPage({
        parent: { database_id: this.salesLogsDbId },
        properties: {
          "Log Title / ID": {
            title: [{ text: { content: logTitle } }],
          },
          "Interaction Type": {
            select: { name: "Note" },
          },
          "Activity Date": {
            date: { start: today },
          },
          "Note Content": {
            rich_text: [{ text: { content: logNote } }],
          },
          "Company Name": {
            rich_text: [{ text: { content: dealTitle.replace(/ Order$/, "") } }],
          },
        },
      });
    } catch (logErr: any) {
      console.warn("Could not create sales log for stage update:", logErr.message);
    }

    return {
      pageId: dealPageId,
      title: dealTitle,
      stage: input.stage,
      amount: dealAmount,
      depositRef: targetPage.properties?.["Deposit Ref #"]?.rich_text?.[0]?.plain_text ?? null,
      proofUrl: targetPage.properties?.["Payment Proof URL"]?.url ?? null,
      productType,
      offerAmount: dealAmount,
      lostReason,
    };
  }

  /**
   * Submit Proposed Offer for equipment (Generator/Pump) with VAT-inclusive pricing.
   */
  public async submitProposedOffer(
    dealId: string,
    input: {
      productType: string;
      offerAmount: number;
      repTelegramId?: number | string | undefined;
      repName?: string | undefined;
      companyName?: string | undefined;
    }
  ): Promise<DealRecord> {
    if (!input.productType || input.productType.trim().length === 0) {
      throw new Error("Validation Error: Type of Generator / Pump is required.");
    }
    if (input.offerAmount == null || isNaN(input.offerAmount) || input.offerAmount <= 0) {
      throw new Error("Validation Error: A valid offer amount including VAT is required.");
    }

    const updated = await this.updateDealStage(dealId, {
      stage: "Proposal",
      productType: input.productType.trim(),
      offerAmount: input.offerAmount,
      updatedByTelegramId: input.repTelegramId,
      updatedByName: input.repName,
    });

    // Also record a detailed timeline log
    try {
      const today = new Date().toISOString().split("T")[0]!;
      await this.notionClient.createPage({
        parent: { database_id: this.salesLogsDbId },
        properties: {
          "Log Title / ID": {
            title: [{ text: { content: `Proposed Offer: ${input.productType.trim()}` } }],
          },
          "Interaction Type": {
            select: { name: "Meeting" },
          },
          "Activity Date": {
            date: { start: today },
          },
          "Note Content": {
            rich_text: [
              {
                text: {
                  content: `Official offer submitted: ${input.productType.trim()} at ${input.offerAmount.toLocaleString()} ETB (including VAT).`,
                },
              },
            ],
          },
          "Company Name": {
            rich_text: [{ text: { content: input.companyName || updated.title.replace(/ Order$/, "") } }],
          },
        },
      });
    } catch (err: any) {
      console.warn("Could not log proposed offer:", err.message);
    }

    return updated;
  }

  /**
   * Log a progress note or schedule a follow-up call.
   */
  public async addActivity(input: AddActivityInput): Promise<ActivityRecord> {
    const today = new Date().toISOString().split("T")[0]!;
    const activityDate = input.scheduledDate || today;
    const repIdStr = String(input.repTelegramId);

    let repDisplayName = input.repName ? `${input.repName} (${repIdStr})` : repIdStr;
    if (!input.repName && this.salesRepsService) {
      try {
        const rep = await this.salesRepsService.findSalesRepByTelegramId(repIdStr);
        if (rep && rep.fullName) {
          repDisplayName = `${rep.fullName} (${repIdStr})`;
        }
      } catch {}
    }

    const formatted12hTime = input.scheduledTime ? formatTimeTo12Hour(input.scheduledTime) : undefined;

    const properties: Record<string, any> = {
      "Log Title / ID": {
        title: [{ text: { content: `[${input.type}] ${input.companyName || "Activity"}` } }],
      },
      "Interaction Type": {
        select: { name: input.type },
      },
      "Note Content": {
        rich_text: [{ text: { content: (input.content || (input as any).notes || "").trim() } }],
      },
      "Activity Date": {
        date: { start: activityDate },
      },
      "Rep ID": {
        rich_text: [{ text: { content: repDisplayName } }],
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
    if (formatted12hTime) {
      properties["Scheduled Time"] = {
        rich_text: [{ text: { content: formatted12hTime } }],
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
        const timePart = formatted12hTime ? ` at ${formatted12hTime}` : "";
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
      content: (input.content || (input as any).notes || "").trim(),
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

        // Filter by companyName if supplied: require match on either Company Name or Title
        if (companyName) {
          const target = companyName.toLowerCase();
          const matchCompany = pageCompanyName ? pageCompanyName.toLowerCase().includes(target) : false;
          const matchTitle = title ? title.toLowerCase().includes(target) : false;
          if (!matchCompany && !matchTitle) {
            continue;
          }
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
