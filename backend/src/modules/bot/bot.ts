import { Bot } from "grammy";
import { env } from "../../config/env.js";
import { getNotionClient } from "../notion/notionClient.js";
import { SalesRepsService } from "../notion/salesRepsService.js";
import { OnboardingController } from "./onboarding.js";

export interface CreateBotOptions {
  token?: string | undefined;
  salesRepsService?: SalesRepsService | undefined;
  managerChatIds?: number[] | undefined;
  miniAppUrl?: string | undefined;
}

export function parseManagerChatIds(raw?: string): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id));
}

export function createBot(options: CreateBotOptions = {}) {
  const token = options.token || env.TELEGRAM_BOT_TOKEN;
  const bot = new Bot(token);

  const salesRepsService =
    options.salesRepsService ||
    new SalesRepsService(getNotionClient(), env.NOTION_SALES_REPS_DB_ID);

  const managerChatIds =
    options.managerChatIds ?? parseManagerChatIds(env.TELEGRAM_MANAGER_CHAT_IDS);

  const miniAppUrl = options.miniAppUrl || env.WEBAPP_URL;

  const controller = new OnboardingController({
    salesRepsService,
    managerChatIds,
    miniAppUrl,
  });

  // 1. /start command
  bot.command("start", async (ctx) => {
    await controller.handleStart(ctx);
  });

  // 2. /app command to open CRM Webview
  bot.command("app", async (ctx) => {
    if (miniAppUrl) {
      await ctx.reply("💼 Sales CRM Portal:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Open Sales CRM App", web_app: { url: miniAppUrl } }],
          ],
        },
      });
    } else {
      await ctx.reply(
        "Sales CRM URL is not configured yet. Please ask an administrator to set WEBAPP_URL."
      );
    }
  });

  // 3. /help command
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📌 Sales CRM Bot Commands:\n\n" +
        "/start - Check account status & registration\n" +
        "/app - Open the Sales CRM Mini App in Telegram\n" +
        "/help - Show this commands overview"
    );
  });

  // 4. Inline callback queries (Role selection & Manager approvals)
  bot.on("callback_query:data", async (ctx) => {
    await controller.handleCallbackQuery(ctx);
  });

  // 5. Conversational messages (Name, Phone number)
  bot.on("message", async (ctx) => {
    await controller.handleMessage(ctx);
  });

  // 6. Global error handler to maintain continuous polling
  bot.catch((err) => {
    console.error("🤖 Bot error in update handler:", err.error || err);
  });

  return bot;
}

let botInstance: ReturnType<typeof createBot> | null = null;

export function getBot() {
  if (!botInstance) {
    botInstance = createBot();
  }
  return botInstance;
}
