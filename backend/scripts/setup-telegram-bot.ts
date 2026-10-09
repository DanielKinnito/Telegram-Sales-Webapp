import { Bot } from "grammy";
import { env } from "../src/config/env.js";

/**
 * Configure official Telegram Bot Profile & Menu Button
 * Usage: npx tsx scripts/setup-telegram-bot.ts [WEBAPP_URL]
 */
async function setupBotProfile() {
  const token = env.TELEGRAM_BOT_TOKEN;
  const bot = new Bot(token);

  const webappUrl = process.argv[2] || env.WEBAPP_URL || "https://example.com";

  console.log("⚙️  Configuring Telegram Bot Profile for @sales_miniapp_bot...");

  try {
    // 1. Set Short Description (Bio shown on bot profile)
    await bot.api.setMyShortDescription("Internal B2B Sales Operations & CRM Portal");
    console.log("✅ Set Short Description");

    // 2. Set Full Description (Shown before pressing Start)
    await bot.api.setMyDescription(
      "Welcome to the internal Sales CRM Portal!\n\n" +
      "Use this bot to:\n" +
      "• Register your sales team account\n" +
      "• Check Ethiopian TIN numbers for client conflicts\n" +
      "• Manage your active deals and pipelines\n" +
      "• Submit bank payment confirmation links\n\n" +
      "Tap 'Start' below to begin."
    );
    console.log("✅ Set Full Description");

    // 3. Set Bot Commands
    await bot.api.setMyCommands([
      { command: "start", description: "Check access & launch CRM" },
      { command: "app", description: "Open Sales CRM Mini App" },
      { command: "help", description: "Show usage commands" },
    ]);
    console.log("✅ Configured Bot Commands (/start, /app, /help)");

    // 4. Configure Persistent Chat Menu Button (WebApp Mode)
    if (webappUrl && webappUrl.startsWith("https://")) {
      await bot.api.setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "💼 Open CRM",
          web_app: {
            url: webappUrl,
          },
        },
      });
      console.log(`✅ Configured Persistent Menu Button [ 💼 Open CRM ] -> ${webappUrl}`);
    } else {
      console.log("ℹ️  Note: Persistent Menu Button requires a public HTTPS URL (run tunnel first).");
    }

    console.log("\n🎉 Telegram Bot successfully configured with professional metadata!");
  } catch (err: any) {
    console.error("❌ Failed to configure Telegram Bot:", err.message);
    process.exit(1);
  }
}

setupBotProfile();
