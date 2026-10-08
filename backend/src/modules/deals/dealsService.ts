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
  managerChatIds?: number[] | undefined;
  bot?: any | undefined;
}

export class DealsService {
  private readonly notionClient: ResilientNotionClient;
  private readonly salesRepsService?: SalesRepsService | undefined;
  private readonly dealsDbId: string;
  private readonly managerChatIds: number[];
  private readonly bot?: any;

  constructor(options: DealsServiceOptions) {
    this.notionClient = options.notionClient;
    this.salesRepsService = options.salesRepsService;
    this.dealsDbId = options.dealsDbId || env.NOTION_DEALS_DB_ID;
    this.managerChatIds = options.managerChatIds || [];
    this.bot = options.bot;
  }

  /**
   * Retrieves a Deal record from Notion by page ID.
   */
  public async getDeal(pageId: string): Promise<DealRecord> {
    try {
      const page: any = await this.notionClient.retrievePage({ page_id: pageId });
      const props = page.properties;

      const title =
        props?.["Deal Title"]?.title?.[0]?.plain_text ||
        props?.["Name"]?.title?.[0]?.plain_text ||
        "Untitled Deal";
      const stage = props?.["Stage"]?.select?.name || "New";
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
   */
  public async submitPaymentProof(
    input: SubmitPaymentProofInput
  ): Promise<SubmitPaymentProofResult> {
    if (
      !input.proofUrl ||
      typeof input.proofUrl !== "string" ||
      !input.proofUrl.startsWith("http")
    ) {
      throw new Error("Validation Error: A valid transaction link (http/https) is required");
    }

    const finalDepositRef =
      input.depositRef && input.depositRef.trim().length > 0
        ? input.depositRef.trim()
        : "Bank Share Link";

    // 1. Ensure deal exists
    const deal = await this.getDeal(input.dealId);

    // 2. Update Deal page in Notion
    await this.notionClient.updatePage({
      page_id: input.dealId,
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

    // 3. Dispatch Telegram notifications to Managers
    let managersNotified = 0;
    if (this.bot && this.managerChatIds.length > 0) {
      const amountFormatted =
        deal.amount != null ? `ETB ${Number(deal.amount).toLocaleString()}` : "N/A";
      const submitter = input.submittedByName || "Sales Representative";

      const message =
        `💳 *Bank Payment Transaction Link Submitted!*\n\n` +
        `• *Deal:* ${deal.title}\n` +
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
        pageId: input.dealId,
        title: deal.title,
        stage: "Payment Pending Verification",
        amount: deal.amount,
        depositRef: finalDepositRef,
        proofUrl: input.proofUrl.trim(),
      },
      managersNotified,
    };
  }
}
