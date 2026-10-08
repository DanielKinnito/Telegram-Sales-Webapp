import { app } from "./app.js";
import { env } from "./config/env.js";
import { getBot, parseManagerChatIds } from "./modules/bot/bot.js";
import { getTinCache } from "./modules/leads/tinCache.js";
import { getNotionClient } from "./modules/notion/notionClient.js";
import { SalesRepsService } from "./modules/notion/salesRepsService.js";
import { CronService } from "./modules/cron/cronService.js";
import { startScheduler } from "./modules/cron/scheduler.js";

const server = app.listen(env.PORT, () => {
  console.log(`⚡ Backend server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

// Launch bot long polling and warm up TIN cache in non-test environments
if (env.NODE_ENV !== "test") {
  const tinCache = getTinCache();
  tinCache
    .warmup(getNotionClient(), env.NOTION_ACCOUNTS_DB_ID)
    .then(() => {
      console.log(`💾 In-memory TIN cache warmed up (${tinCache.size()} registered TINs loaded)`);
    })
    .catch((err) => {
      console.warn("⚠️ TIN cache warmup error:", err.message);
    });

  const bot = getBot();
  bot.start({
    onStart: (info) => {
      console.log(`🤖 GrammY bot @${info.username} listening for onboarding & notifications`);
    },
  }).catch((err) => {
    console.error("❌ Failed to launch Telegram bot:", err);
  });

  // Launch Cron Workers
  const cronService = new CronService({
    notionClient: getNotionClient(),
    salesRepsService: new SalesRepsService(getNotionClient(), env.NOTION_SALES_REPS_DB_ID),
    dealsDbId: env.NOTION_DEALS_DB_ID,
    salesLogsDbId: env.NOTION_SALES_LOGS_DB_ID,
    managerChatIds: parseManagerChatIds(env.TELEGRAM_MANAGER_CHAT_IDS),
    bot,
  });
  startScheduler({ cronService });
  console.log("⏰ Automated notification cron workers registered (9:00 AM briefing & inactivity sweeper)");
}

export default server;