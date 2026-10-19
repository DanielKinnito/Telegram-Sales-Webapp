import { app } from "./app.js";
import { env } from "./config/env.js";
import {
  getBot,
  parseManagerChatIds,
  setBotReportsService,
  setBotLeadsService,
  DEFAULT_BOT_COMMANDS,
  MANAGER_BOT_COMMANDS,
} from "./modules/bot/bot.js";
import { getTinCache } from "./modules/leads/tinCache.js";
import { getNotionClient } from "./modules/notion/notionClient.js";
import { SalesRepsService } from "./modules/notion/salesRepsService.js";
import { LeadsService } from "./modules/leads/leadsService.js";
import { CronService } from "./modules/cron/cronService.js";
import { startScheduler } from "./modules/cron/scheduler.js";
import { ReportsService } from "./modules/reports/reportsService.js";

const server = app.listen(env.PORT, () => {
  console.log(`⚡ Backend server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

// Launch bot long polling and warm up TIN cache in non-test environments
if (env.NODE_ENV !== "test") {
  const notionClient = getNotionClient();
  const salesRepsService = new SalesRepsService(notionClient, env.NOTION_SALES_REPS_DB_ID);
  const managerChatIds = parseManagerChatIds(env.TELEGRAM_MANAGER_CHAT_IDS);

  const tinCache = getTinCache();
  tinCache
    .warmup(notionClient, env.NOTION_ACCOUNTS_DB_ID)
    .then(() => {
      console.log(`💾 In-memory TIN cache warmed up (${tinCache.size()} registered TINs loaded)`);
    })
    .catch((err) => {
      console.warn("⚠️ TIN cache warmup error:", err.message);
    });

  const leadsService = new LeadsService({
    notionClient,
    salesRepsService,
    tinCache,
    accountsDbId: env.NOTION_ACCOUNTS_DB_ID,
  });
  setBotLeadsService(leadsService);

  const reportsService = new ReportsService({
    notionClient,
    salesRepsService,
    reportsDbId: env.NOTION_REPORTS_DB_ID,
    dealsDbId: env.NOTION_DEALS_DB_ID,
    accountsDbId: env.NOTION_ACCOUNTS_DB_ID,
    salesLogsDbId: env.NOTION_SALES_LOGS_DB_ID,
    queueDbId: env.NOTION_QUEUE_DB_ID,
    managerChatIds,
  });

  setBotReportsService(reportsService);

  const bot = getBot({
    salesRepsService,
    reportsService,
    managerChatIds,
  });
  reportsService.setBot(bot);

  const setupBotCommandsAndMenu = async () => {
    // 1. Default commands for everyone (sales reps, front desk, pending, guests) - strictly hides /weekly_report
    await bot.api.setMyCommands(DEFAULT_BOT_COMMANDS, { scope: { type: "default" } }).catch((err) => {
      console.warn("⚠️ Could not update default Telegram bot commands menu:", err.message);
    });

    // 2. Scoped manager commands - only visible to authorized Executive Managers
    try {
      const allManagerIds = await salesRepsService.getActiveManagerChatIds(managerChatIds);
      for (const mgrId of allManagerIds) {
        await bot.api.setMyCommands(MANAGER_BOT_COMMANDS, { scope: { type: "chat", chat_id: mgrId } }).catch(() => {});
      }
    } catch {
      for (const mgrId of managerChatIds) {
        await bot.api.setMyCommands(MANAGER_BOT_COMMANDS, { scope: { type: "chat", chat_id: mgrId } }).catch(() => {});
      }
    }

    // 3. Configure Persistent Menu Button if WEBAPP_URL is present
    if (env.WEBAPP_URL && env.WEBAPP_URL.startsWith("https://")) {
      await bot.api
        .setChatMenuButton({
          menu_button: {
            type: "web_app",
            text: "💼 Open CRM",
            web_app: {
              url: env.WEBAPP_URL,
            },
          },
        })
        .catch((err) => {
          console.warn("⚠️ Could not update Telegram menu button:", err.message);
        });
    }
  };

  const isProduction = env.NODE_ENV === "production";
  const hasHttpsUrl = Boolean(env.WEBAPP_URL && env.WEBAPP_URL.startsWith("https://"));
  const shouldRunWebhook =
    env.USE_WEBHOOK === "true" || (env.USE_WEBHOOK === "auto" && isProduction && hasHttpsUrl);

  if (shouldRunWebhook && env.WEBAPP_URL) {
    const cleanUrl = env.WEBAPP_URL.replace(/\/+$/, "");
    const webhookUrl = `${cleanUrl}/api/bot/webhook`;

    console.log(`📡 Configuring Telegram Webhook mode for: ${webhookUrl}`);
    const webhookOptions: { drop_pending_updates: boolean; secret_token?: string } = {
      drop_pending_updates: false,
    };
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      webhookOptions.secret_token = env.TELEGRAM_WEBHOOK_SECRET;
    }

    bot.api
      .setWebhook(webhookUrl, webhookOptions)
      .then(async () => {
        console.log(`⚡ Telegram Webhook active! Inbound messages & bot commands will wake Render from sleep.`);
        await setupBotCommandsAndMenu();
      })
      .catch((err) => {
        console.error("❌ Failed to set Telegram webhook:", err.message);
      });
  } else {
    // Long Polling Mode (Local dev or when no public HTTPS URL is set)
    bot.api
      .deleteWebhook({ drop_pending_updates: false })
      .catch(() => {})
      .then(() => {
        bot.start({
          onStart: async (info) => {
            console.log(`🤖 GrammY bot @${info.username} listening in long polling mode`);
            await setupBotCommandsAndMenu();
          },
        }).catch((err) => {
          console.error("❌ Failed to launch Telegram bot in polling mode:", err);
        });
      });
  }

  // Launch Cron Workers
  const cronService = new CronService({
    notionClient,
    salesRepsService,
    dealsDbId: env.NOTION_DEALS_DB_ID,
    salesLogsDbId: env.NOTION_SALES_LOGS_DB_ID,
    managerChatIds,
    bot,
  });
  startScheduler({ cronService, reportsService });
  console.log("⏰ Automated notification cron workers registered (9:00 AM briefing, inactivity sweeper, Friday reports)");
}

export default server;