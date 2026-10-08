import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { SalesRepsService } from "../src/modules/notion/salesRepsService.js";
import { CronService } from "../src/modules/cron/cronService.js";
import { getBot, parseManagerChatIds } from "../src/modules/bot/bot.js";
import { env } from "../src/config/env.js";

const USER_ID = 6191728928; // Active tester Telegram ID

async function main() {
  console.log("\n========================================================");
  console.log("⏰ RUNNING ON-DEMAND AUTOMATED NOTIFICATION CRON WORKERS");
  console.log("========================================================\n");

  const client = getNotionClient();
  const salesRepsService = new SalesRepsService(client, env.NOTION_SALES_REPS_DB_ID);
  const bot = getBot();

  const isSeed = process.argv.includes("--seed");

  if (isSeed) {
    const today = new Date().toISOString().split("T")[0]!;
    console.log(`🌱 Seeding a test follow-up activity for today (${today})...`);
    await client.createPage({
      parent: { database_id: env.NOTION_SALES_LOGS_DB_ID },
      properties: {
        "Log Title / ID": {
          title: [{ text: { content: "Follow-up Meeting with BGI Ethiopia" } }],
        },
        "Interaction Type": {
          select: { name: "Meeting" },
        },
        "Activity Date": {
          date: { start: today },
        },
        "Note Content": {
          rich_text: [
            { text: { content: "Review industrial lubricant bulk order and finalize payment terms." } },
          ],
        },
      },
    });
    console.log("✅ Seeded test follow-up in Notion Sales Logs DB!\n");
  }

  const cronService = new CronService({
    notionClient: client,
    salesRepsService,
    dealsDbId: env.NOTION_DEALS_DB_ID,
    salesLogsDbId: env.NOTION_SALES_LOGS_DB_ID,
    managerChatIds: parseManagerChatIds(env.TELEGRAM_MANAGER_CHAT_IDS),
    bot,
  });

  // 1. Morning Follow-Up Briefing
  console.log("1️⃣  Triggering Daily 9:00 AM Follow-Up Briefing Worker...");
  const briefingRes = await cronService.runDailyFollowUpBriefing();
  console.log(`✅ Briefing complete. ${briefingRes.totalBriefingsSent} sales reps notified.`);
  if (briefingRes.totalBriefingsSent > 0) {
    console.log("   📲 Check your Telegram app for the Morning Sales Briefing message!\n");
  } else {
    console.log("   (Tip: Run with --seed to create a today follow-up and receive a briefing)\n");
  }

  // 2. 7-Day Inactivity Deal Sweeper
  // If --seed passed, test with threshold 0 days to immediately trigger alerts for existing deals
  const threshold = isSeed ? 0 : 7;
  console.log(`2️⃣  Triggering Inactivity Deal Sweeper Worker (threshold: ${threshold} days)...`);
  const sweeperRes = await cronService.runInactivitySweeper(threshold);
  console.log(`✅ Inactivity sweep complete.`);
  console.log(`   • Stalled Deals Identified: ${sweeperRes.stalledDealsCount}`);
  console.log(`   • Telegram Alerts Dispatched to Managers: ${sweeperRes.alertsSent}`);
  if (sweeperRes.alertsSent > 0) {
    console.log("   📲 Check your Telegram app for the Stalled Deal Alert message!\n");
  }

  console.log("🎉 Cron workers test completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Cron execution error:", err);
  process.exit(1);
});
