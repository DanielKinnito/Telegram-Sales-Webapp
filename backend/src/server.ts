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

  bot.start({
    onStart: (info) => {
      console.log(`🤖 GrammY bot @${info.username} listening for onboarding & notifications`);
      // 1. Default commands for everyone (sales reps, front desk, pending, guests) - strictly hides /weekly_report
      bot.api.setMyCommands(DEFAULT_BOT_COMMANDS, { scope: { type: "default" } }).catch((err) => {
        console.warn("⚠️ Could not update default Telegram bot commands menu:", err.message);
      });

      // 2. Scoped manager commands - only visible to authorized Executive Managers
      salesRepsService
        .getActiveManagerChatIds(managerChatIds)
        .then((allManagerIds) => {
          for (const mgrId of allManagerIds) {
            bot.api.setMyCommands(MANAGER_BOT_COMMANDS, { scope: { type: "chat", chat_id: mgrId } }).catch(() => {});
          }
        })
        .catch(() => {
          for (const mgrId of managerChatIds) {
            bot.api.setMyCommands(MANAGER_BOT_COMMANDS, { scope: { type: "chat", chat_id: mgrId } }).catch(() => {});
          }
        });

      // 3. Configure Persistent Menu Button if WEBAPP_URL is present
      if (env.WEBAPP_URL && env.WEBAPP_URL.startsWith("https://")) {
        bot.api
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
    },
  }).catch((err) => {
    console.error("❌ Failed to launch Telegram bot:", err);
  });

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