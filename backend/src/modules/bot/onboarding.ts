import type { Context } from "grammy";
import { InlineKeyboard, Keyboard } from "grammy";
import type { SalesRepsService, RepRole } from "../notion/salesRepsService.js";

export type OnboardingStep = "IDLE" | "AWAITING_NAME" | "AWAITING_PHONE" | "AWAITING_ROLE";

export interface OnboardingSession {
  step: OnboardingStep;
  fullName?: string | undefined;
  phone?: string | undefined;
  role?: RepRole | undefined;
}

export interface OnboardingControllerOptions {
  salesRepsService: SalesRepsService;
  managerChatIds?: number[] | undefined;
  miniAppUrl?: string | undefined;
}

export class OnboardingController {
  private readonly salesRepsService: SalesRepsService;
  private readonly managerChatIds: number[];
  private readonly miniAppUrl: string;
  private readonly sessions: Map<number, OnboardingSession> = new Map();

  constructor(options: OnboardingControllerOptions) {
    this.salesRepsService = options.salesRepsService;
    this.managerChatIds = options.managerChatIds || [];
    this.miniAppUrl = options.miniAppUrl || "";
  }

  public getSession(userId: number): OnboardingSession {
    let session = this.sessions.get(userId);
    if (!session) {
      session = { step: "IDLE" };
      this.sessions.set(userId, session);
    }
    return session;
  }

  public setSession(userId: number, updates: Partial<OnboardingSession>): void {
    const session = this.getSession(userId);
    Object.assign(session, updates);
    this.sessions.set(userId, session);
  }

  public resetSession(userId: number): void {
    this.sessions.set(userId, { step: "IDLE" });
  }

  /**
   * Handle /start command.
   */
  public async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    this.resetSession(userId);

    const existingRep = await this.salesRepsService.findSalesRepByTelegramId(userId);

    if (existingRep) {
      if (existingRep.status === "Active") {
        let keyboard: InlineKeyboard | undefined;
        if (this.miniAppUrl) {
          keyboard = new InlineKeyboard().webApp("🚀 Open Sales App", this.miniAppUrl);
        }

        await ctx.reply(
          `👋 Welcome back, ${existingRep.fullName}!\n\nStatus: 🟢 Active (${existingRep.role})\nYou have full access to the Sales CRM.`,
          keyboard ? { reply_markup: keyboard } : undefined
        );
        return;
      }

      if (existingRep.status === "Pending Approval") {
        await ctx.reply(
          `⏳ Welcome, ${existingRep.fullName}!\n\nYour registration is currently pending manager approval. Please wait for an Executive Manager to review your request.`
        );
        return;
      }

      if (existingRep.status === "Inactive") {
        await ctx.reply(
          `⛔ Welcome, ${existingRep.fullName}.\n\nYour account is inactive. Please contact an Executive Manager for assistance.`
        );
        return;
      }
    }

    // Unregistered user -> Begin onboarding
    this.setSession(userId, { step: "AWAITING_NAME" });
    await ctx.reply(
      `👋 Welcome to the Sales CRM Telegram Bot!\n\nYou are not registered yet. Let's get you set up.\n\nPlease reply with your Full Name to begin:`
    );
  }

  /**
   * Handle text or contact messages during onboarding conversation.
   */
  public async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = this.getSession(userId);
    if (session.step === "IDLE") return;

    if (session.step === "AWAITING_NAME") {
      const text = ctx.message?.text?.trim();
      if (!text || text.startsWith("/")) {
        await ctx.reply("Please enter a valid Full Name (at least 2 characters):");
        return;
      }

      this.setSession(userId, {
        step: "AWAITING_PHONE",
        fullName: text,
      });

      const keyboard = new Keyboard()
        .requestContact("📱 Share Phone Number")
        .oneTime()
        .resized();

      await ctx.reply(
        `Thank you, ${text}!\n\nNow please share your Phone Number. You can tap the button below or type it manually (e.g. +251911234567):`,
        { reply_markup: keyboard }
      );
      return;
    }

    if (session.step === "AWAITING_PHONE") {
      let phone: string | undefined;

      if (ctx.message?.contact?.phone_number) {
        phone = ctx.message.contact.phone_number;
      } else if (ctx.message?.text) {
        const rawText = ctx.message.text.trim();
        // Basic phone cleanup
        if (rawText.replace(/\D/g, "").length >= 9) {
          phone = rawText;
        }
      }

      if (!phone) {
        await ctx.reply("Please provide a valid phone number (or click 'Share Phone Number'):");
        return;
      }

      this.setSession(userId, {
        step: "AWAITING_ROLE",
        phone,
      });

      const roleKeyboard = new InlineKeyboard()
        .text("💼 Sales Rep", "onboard_role:Sales Rep")
        .text("🛎️ Front Desk", "onboard_role:Front Desk");

      await ctx.reply(
        `Great! Phone recorded: ${phone}\n\nLastly, please select your Role:`,
        {
          reply_markup: roleKeyboard,
        }
      );
      return;
    }
  }

  /**
   * Handle inline keyboard callback queries (Role selection & Manager approvals).
   */
  public async handleCallbackQuery(ctx: Context): Promise<void> {
    const data = ctx.callbackQuery?.data;
    const userId = ctx.from?.id;
    if (!data || !userId) return;

    await ctx.answerCallbackQuery();

    // 1. Role Selection
    if (data.startsWith("onboard_role:")) {
      const role = data.slice("onboard_role:".length) as RepRole;
      const session = this.getSession(userId);

      if (!session.fullName || !session.phone) {
        await ctx.reply("Onboarding data expired. Please type /start to restart.");
        this.resetSession(userId);
        return;
      }

      const createdRecord = await this.salesRepsService.createSalesRep({
        telegramId: userId.toString(),
        fullName: session.fullName,
        phone: session.phone,
        role,
      });

      this.resetSession(userId);

      await ctx.reply(
        `✅ Registration submitted!\n\n• Name: ${createdRecord.fullName}\n• Role: ${createdRecord.role}\n• Phone: ${createdRecord.phone}\n• Status: 🟡 Pending Approval\n\nExecutive Managers have been alerted to review your application.`
      );

      // Alert Managers
      await this.notifyManagers(createdRecord, ctx);
      return;
    }

    // 2. Manager Approval
    if (data.startsWith("mgr_approve:")) {
      const parts = data.split(":");
      const pageId = parts[1];
      const repTelegramId = parts[2];

      if (!pageId || !repTelegramId) return;

      await this.salesRepsService.updateSalesRepStatus(pageId, "Active");

      await ctx.editMessageText(
        `✅ Approved by Manager (${ctx.from?.first_name || "Manager"})\nStatus: 🟢 Active`
      );

      // Notify the applicant
      try {
        await ctx.api.sendMessage(
          parseInt(repTelegramId, 10),
          `🎉 Great news! Your registration has been approved by management.\n\nYou are now an Active Sales team member! Send /start to access your dashboard.`
        );
      } catch (err) {
        // Notification might fail if user blocked bot, ignore gracefully
      }
      return;
    }

    // 3. Manager Rejection
    if (data.startsWith("mgr_reject:")) {
      const parts = data.split(":");
      const pageId = parts[1];
      const repTelegramId = parts[2];

      if (!pageId || !repTelegramId) return;

      await this.salesRepsService.updateSalesRepStatus(pageId, "Inactive");

      await ctx.editMessageText(
        `❌ Rejected by Manager (${ctx.from?.first_name || "Manager"})\nStatus: 🔴 Inactive`
      );

      // Notify applicant
      try {
        await ctx.api.sendMessage(
          parseInt(repTelegramId, 10),
          `❌ Your registration request was rejected by management. Please contact leadership for more details.`
        );
      } catch (err) {
        // Ignore gracefully
      }
      return;
    }
  }

  /**
   * Send notification to all configured managers with inline approval buttons.
   */
  private async notifyManagers(rep: { pageId: string; telegramId: string; fullName: string; phone: string; role: string }, ctx: Context): Promise<void> {
    if (!this.managerChatIds || this.managerChatIds.length === 0) {
      console.log(`[Manager Alert] New Rep Pending Approval: ${rep.fullName} (${rep.role}), Telegram ID: ${rep.telegramId}`);
      return;
    }

    const approvalKeyboard = new InlineKeyboard()
      .text("✅ Approve", `mgr_approve:${rep.pageId}:${rep.telegramId}`)
      .text("❌ Reject", `mgr_reject:${rep.pageId}:${rep.telegramId}`);

    const text = `🔔 New Rep Registration Pending Approval:\n\n• Name: ${rep.fullName}\n• Role: ${rep.role}\n• Phone: ${rep.phone}\n• Telegram ID: ${rep.telegramId}`;

    for (const chatId of this.managerChatIds) {
      try {
        await ctx.api.sendMessage(chatId, text, {
          reply_markup: approvalKeyboard,
        });
      } catch (err: any) {
        console.error(`Failed to send manager alert to chat ${chatId}:`, err.message);
      }
    }
  }
}
