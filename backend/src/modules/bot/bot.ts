import { Bot, InputFile } from "grammy";
import { env } from "../../config/env.js";
import { getNotionClient } from "../notion/notionClient.js";
import { SalesRepsService } from "../notion/salesRepsService.js";
import { OnboardingController } from "./onboarding.js";
import { ReportsService } from "../reports/reportsService.js";
import type { LeadsService } from "../leads/leadsService.js";
import type { DealsService } from "../deals/dealsService.js";
import { ProformaPdfService } from "../proforma/proformaPdfService.js";

export interface CreateBotOptions {
  token?: string | undefined;
  salesRepsService?: SalesRepsService | undefined;
  reportsService?: ReportsService | undefined;
  leadsService?: LeadsService | undefined;
  dealsService?: DealsService | undefined;
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

let registeredReportsService: ReportsService | null = null;
let registeredLeadsService: LeadsService | null = null;
let registeredDealsService: DealsService | null = null;
let registeredInventoryService: any | null = null;

export function setBotReportsService(service: ReportsService) {
  registeredReportsService = service;
}

export function setBotLeadsService(service: LeadsService) {
  registeredLeadsService = service;
}

export function setBotDealsService(service: DealsService) {
  registeredDealsService = service;
}

export function setBotInventoryService(service: any) {
  registeredInventoryService = service;
}

export async function sendStockAdjustmentAlertToManagers(
  bot: any,
  managerChatIds: number[],
  adjustment: any
): Promise<number> {
  if (!bot || !managerChatIds || managerChatIds.length === 0) return 0;

  const isNew = Boolean(adjustment.isNewItem);
  const deltaSign = adjustment.delta > 0 ? `+${adjustment.delta}` : `${adjustment.delta}`;
  const priceFormatted =
    adjustment.unitPrice > 0 ? `ETB ${Number(adjustment.unitPrice).toLocaleString()}` : "N/A";

  const descSnippet = adjustment.productDescription
    ? `• *Specs / Details:* _${adjustment.productDescription.split('\n')[0]}_\n`
    : "";

  const titleHeader = isNew
    ? `📦 *NEW INVENTORY ITEM PROPOSAL*\n*Status:* ⏳ Pending Manager Approval\n\n`
    : `📦 *INVENTORY ADJUSTMENT REQUEST*\n*Status:* ⏳ Pending Manager Approval\n\n`;

  const stockDetails = isNew
    ? `• *Initial Stock to Add:* *${adjustment.delta} units*\n`
    : `• *Current Stock:* ${adjustment.currentStock} units\n` +
      `• *Adjustment:* *${deltaSign} units*\n` +
      `• *Proposed New Stock:* *${adjustment.newStock} units*\n`;

  const footerPrompt = isNew
    ? `_Review and approve to add this new equipment model to Notion stock catalog:_`
    : `_Please review the stock change details above:_`;

  const message =
    titleHeader +
    `• *Item Code:* \`${adjustment.itemCode}\`\n` +
    `• *Product Name:* *${adjustment.productName}*\n` +
    descSnippet +
    stockDetails +
    `• *Catalog Price:* ${priceFormatted}\n` +
    `• *Requested by:* ${adjustment.requestedByName} (Front Desk)\n` +
    `• *Reason / Note:* ${adjustment.reason}\n\n` +
    footerPrompt;

  const keyboard = [
    [
      {
        text: isNew ? `✅ Approve & Add Item` : `✅ Approve (${deltaSign} Units)`,
        callback_data: `stock_appr:${adjustment.requestId}`,
      },
      {
        text: `❌ Reject`,
        callback_data: `stock_rej:${adjustment.requestId}`,
      },
    ],
  ];

  let count = 0;
  for (const chatId of managerChatIds) {
    try {
      await bot.api.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      });
      count++;
    } catch (err: any) {
      console.warn(`Could not dispatch stock alert to manager ${chatId}:`, err.message);
    }
  }
  return count;
}

export const DEFAULT_BOT_COMMANDS = [
  { command: "start", description: "Check access & launch CRM" },
  { command: "app", description: "Open Sales CRM Mini App" },
  { command: "ct", description: "Check Ethiopian TIN availability" },
  { command: "invoice", description: "Generate Proforma Invoice PDF" },
  { command: "help", description: "Show usage commands" },
];

export const MANAGER_BOT_COMMANDS = [
  { command: "start", description: "Check access & launch CRM" },
  { command: "app", description: "Open Sales CRM Mini App" },
  { command: "ct", description: "Check Ethiopian TIN availability" },
  { command: "invoice", description: "Generate Proforma Invoice PDF" },
  { command: "weekly_report", description: "Generate Weekly Executive Report (Managers)" },
  { command: "help", description: "Show usage commands" },
];

export function createBot(options: CreateBotOptions = {}) {
  const token = options.token || env.TELEGRAM_BOT_TOKEN;
  const bot = new Bot(token);

  if (options.reportsService) {
    registeredReportsService = options.reportsService;
  }

  if (options.dealsService) {
    registeredDealsService = options.dealsService;
  }

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
    const userId = ctx.from?.id;
    if (userId) {
      const isManager = salesRepsService?.isManager
        ? await salesRepsService.isManager(userId, managerChatIds)
        : managerChatIds.includes(userId);

      if (isManager) {
        await ctx.api
          .setMyCommands(MANAGER_BOT_COMMANDS, {
            scope: { type: "chat", chat_id: userId },
          })
          .catch(() => {});
      } else {
        await ctx.api
          .deleteMyCommands({
            scope: { type: "chat", chat_id: userId },
          })
          .catch(() => {});
      }
    }
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

  // 3. /weekly_report and /report command (Executive Report Generation)
  bot.command(["weekly_report", "report"], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const isManager = salesRepsService?.isManager
      ? await salesRepsService.isManager(userId, managerChatIds)
      : managerChatIds.includes(userId);

    if (!isManager) {
      await ctx.reply("Permission Denied: Weekly executive reports can only be generated by authorized Executive Managers.");
      return;
    }

    let activeReportsService = options.reportsService || registeredReportsService;
    if (!activeReportsService) {
      try {
        activeReportsService = new ReportsService({
          notionClient: getNotionClient(),
          salesRepsService,
          reportsDbId: env.NOTION_REPORTS_DB_ID,
          dealsDbId: env.NOTION_DEALS_DB_ID,
          accountsDbId: env.NOTION_ACCOUNTS_DB_ID,
          salesLogsDbId: env.NOTION_SALES_LOGS_DB_ID,
          queueDbId: env.NOTION_QUEUE_DB_ID,
          managerChatIds,
          bot,
        });
        registeredReportsService = activeReportsService;
      } catch (err: any) {
        console.error("Failed to initialize ReportsService on demand:", err);
      }
    }

    if (!activeReportsService) {
      await ctx.reply("Reports service is currently initializing. Please try again shortly.");
      return;
    }

    await ctx.reply("Compiling Weekly Executive Sales Performance Report from Notion CRM datastore...");
    try {
      const res = await activeReportsService.generateWeeklyReport({ triggerSource: "bot" });
      const safePeriod = res.periodString.replace(/[^a-zA-Z0-9]/g, "_");
      const summaryText =
        `*Weekly Executive Sales Performance Report Compiled*\n\n` +
        `• *Period:* ${res.periodString}\n` +
        `• *Closed Won Revenue:* ETB ${res.totalWonRevenue.toLocaleString()}\n` +
        `• *Contracts Won:* ${res.dealsWonCount} | *Losses:* ${res.dealsLostCount}\n` +
        `• *Active Negotiations:* ${res.activePipelineCount}\n` +
        `• *Total Enterprise Accounts:* ${res.newAccountsCount}\n\n` +
        `📄 [Open Relational Audit in Notion](${res.reportUrl})\n` +
        `_Pixel-perfect executive PDF document attached above._`;

      if (res.pdfBuffer) {
        await ctx.replyWithDocument(
          new InputFile(res.pdfBuffer, `Weekly_Sales_Report_${safePeriod}.pdf`),
          { caption: summaryText, parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(summaryText, { parse_mode: "Markdown" });
      }
    } catch (err: any) {
      await ctx.reply(`Failed to compile executive report: ${err.message}`);
    }
  });

    if (options.leadsService) {
      registeredLeadsService = options.leadsService;
    }

    // 4. /ct and /checktin command (Quick TIN conflict check directly from Telegram chat)
    bot.command(["ct", "checktin", "check_tin", "checkTin"], async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      // Verify user is registered & active
      const isManager = salesRepsService?.isManager
        ? await salesRepsService.isManager(userId, managerChatIds)
        : managerChatIds.includes(userId);

      let isApprovedRep = isManager;
      if (!isApprovedRep) {
        try {
          const rep = await salesRepsService.findSalesRepByTelegramId(userId);
          if (rep && rep.status === "Active") {
            isApprovedRep = true;
          }
        } catch {}
      }

      if (!isManager && !isApprovedRep) {
        await ctx.reply("Access Restricted: Please complete registration via /start and await manager approval to use CRM tools.");
        return;
      }

      let activeLeadsService = options.leadsService || registeredLeadsService;
      if (!activeLeadsService) {
        try {
          const { LeadsService } = await import("../leads/leadsService.js");
          const { getTinCache } = await import("../leads/tinCache.js");
          activeLeadsService = new LeadsService({
            notionClient: getNotionClient(),
            salesRepsService,
            tinCache: getTinCache(),
            accountsDbId: env.NOTION_ACCOUNTS_DB_ID,
          });
          registeredLeadsService = activeLeadsService;
        } catch (err: any) {
          console.error("Failed to initialize LeadsService for /ct:", err);
        }
      }

      if (!activeLeadsService) {
        await ctx.reply("TIN verification service is currently initializing. Please try again shortly.");
        return;
      }

      const text = ctx.message?.text?.trim() || "";
      const parts = text.split(/\s+/);
      const rawArg = parts[1];

      if (!rawArg) {
        await ctx.reply(
          "Please provide a 10-digit TIN number to check.\n\nExample:\n/ct 0012345678"
        );
        return;
      }

      const cleanTin = rawArg.replace(/\D/g, "");
      if (cleanTin.length !== 10) {
        await ctx.reply(
          "Invalid TIN format: Ethiopian TIN must be exactly 10 numeric digits.\nExample: /ct 0012345678"
        );
        return;
      }

      try {
        const result = await activeLeadsService.checkTin(cleanTin);
        if (result.available) {
          if (miniAppUrl) {
            await ctx.reply("Available. Register this account by heading to the app.", {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "💼 Open Sales CRM App", web_app: { url: miniAppUrl } }],
                ],
              },
            });
          } else {
            await ctx.reply("Available. Register this account by heading to the app.");
          }
        } else {
          const takenBy = result.conflict?.ownerName || (result.conflict as any)?.assignedRepName || "another Sales person";
          await ctx.reply(`Not available. Taken by ${takenBy}.`);
        }
      } catch (err: any) {
        await ctx.reply(`Error checking TIN: ${err.message}`);
      }
    });

  // Helper to resolve DealsService on demand
  const resolveDealsService = async (): Promise<DealsService | null> => {
    let active = options.dealsService || registeredDealsService;
    if (!active) {
      try {
        const { DealsService } = await import("../deals/dealsService.js");
        active = new DealsService({
          notionClient: getNotionClient(),
          salesRepsService,
          dealsDbId: env.NOTION_DEALS_DB_ID,
          salesLogsDbId: env.NOTION_SALES_LOGS_DB_ID,
          managerChatIds,
          bot,
        });
        registeredDealsService = active;
      } catch (err: any) {
        console.error("Failed to initialize DealsService for bot:", err);
      }
    }
    return active;
  };

  const deliverProformaPdf = async (ctx: any, dealId: string, isManager: boolean, callerRep: any) => {
    const activeDealsService = await resolveDealsService();
    if (!activeDealsService) {
      await ctx.reply("Deals service is currently initializing. Please try again shortly.");
      return;
    }

    try {
      const deal = await activeDealsService.getDeal(dealId);
      if (!isManager && callerRep?.fullName && deal.repName) {
        if (deal.repName.trim().toLowerCase() !== callerRep.fullName.trim().toLowerCase()) {
          await ctx.reply("Permission Denied: You can only generate Proforma Invoices for deals assigned to you.");
          return;
        }
      }

      await ctx.reply("Generating official YC Electric Proforma Invoice PDF...");
      const proformaData = await activeDealsService.getProformaInvoiceData(dealId);
      const pdfBuffer = await ProformaPdfService.generateProformaPdf(proformaData);

      const safeName = (proformaData.customerName || dealId).replace(/[^a-zA-Z0-9_-]/g, "_");
      await ctx.replyWithDocument(
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
    } catch (err: any) {
      await ctx.reply(`Failed to generate Proforma Invoice: ${err.message}`);
    }
  };

  // 4b. /invoice and /proforma command (Generate branded PDF directly in Telegram)
  bot.command(["invoice", "proforma", "pi"], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const isManager = salesRepsService?.isManager
      ? await salesRepsService.isManager(userId, managerChatIds)
      : managerChatIds.includes(userId);

    let callerRep: any = null;
    if (!isManager) {
      try {
        callerRep = await salesRepsService.findSalesRepByTelegramId(userId);
      } catch {}
      if (!callerRep || callerRep.status !== "Active") {
        await ctx.reply("Access Restricted: Only active sales representatives and managers can generate Proforma Invoices.");
        return;
      }
    }

    const rawText = ctx.message?.text?.trim() || "";
    const query = rawText.replace(/^\/(?:invoice|proforma|pi)(?:@\w+)?/i, "").trim();

    const activeDealsService = await resolveDealsService();
    if (!activeDealsService) {
      await ctx.reply("Deals service is currently initializing. Please try again shortly.");
      return;
    }

    if (query) {
      const matches = await activeDealsService.searchDeals(query, {
        isManager,
        repPageId: callerRep?.pageId,
        repFullName: callerRep?.fullName,
      });

      if (matches.length === 1) {
        await deliverProformaPdf(ctx, matches[0]!.pageId, isManager, callerRep);
        return;
      }

      if (matches.length > 1) {
        const keyboard = matches.slice(0, 8).map((d) => [
          {
            text: `📄 ${d.companyName || d.title}`,
            callback_data: `inv:${d.pageId}`,
          },
        ]);
        await ctx.reply(
          `Found ${matches.length} matching deals for "${query}". Tap one to receive the Proforma Invoice:`,
          {
            reply_markup: {
              inline_keyboard: keyboard,
            },
          }
        );
        return;
      }

      // No match found -> show user's active deals as suggestions
      let dealsList = isManager
        ? await activeDealsService.listAllDeals()
        : callerRep
        ? await activeDealsService.listDealsForRep(callerRep.pageId, callerRep.fullName)
        : [];

      if (dealsList.length > 0) {
        const keyboard = dealsList.slice(0, 5).map((d) => [
          {
            text: `📄 ${d.companyName || d.title}`,
            callback_data: `inv:${d.pageId}`,
          },
        ]);
        await ctx.reply(
          `Could not find any deal matching "${query}".\n\nTap one of your registered deals below:`,
          {
            reply_markup: {
              inline_keyboard: keyboard,
            },
          }
        );
      } else {
        await ctx.reply(
          `Could not find any deal matching "${query}". Please check the spelling or view your active deals in the app via /app.`
        );
      }
      return;
    }

    try {
      let dealsList = isManager
        ? await activeDealsService.listAllDeals()
        : await activeDealsService.listDealsForRep(callerRep.pageId, callerRep.fullName);

      if (dealsList.length === 0) {
        await ctx.reply(
          "No registered deals found in your pipeline.\n\nTo generate an invoice for a specific deal ID, type:\n`/invoice <deal_id>`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const recentDeals = dealsList.slice(0, 5);
      const keyboard = recentDeals.map((d) => [
        {
          text: `📄 ${d.companyName || d.title} (${d.stage})`,
          callback_data: `inv:${d.pageId}`,
        },
      ]);

      await ctx.reply(
        "Select a deal to generate an official YC Electric Proforma Invoice PDF:",
        {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        }
      );
    } catch (err: any) {
      await ctx.reply(`Could not retrieve deals: ${err.message}`);
    }
  });

  // 5. /help command
  bot.command("help", async (ctx) => {
    const userId = ctx.from?.id;
    let isManager = false;
    if (userId) {
      isManager = salesRepsService?.isManager
        ? await salesRepsService.isManager(userId, managerChatIds)
        : managerChatIds.includes(userId);
    }

    let text =
      "📌 Sales CRM Bot Commands:\n\n" +
      "/start - Check account status & registration\n" +
      "/app - Open the Sales CRM Mini App in Telegram\n" +
      "/ct <tin> - Check Ethiopian TIN availability (Quick TIN check)\n" +
      "/invoice [deal_id] - Generate official YC Electric Proforma Invoice PDF\n";
    if (isManager) {
      text += "/weekly_report - Generate formal Weekly Executive Sales Report in Notion\n";
    }
    text += "/help - Show this commands overview";
    await ctx.reply(text);
  });

  // 6. Inline callback queries (Role selection, Manager approvals, Invoice generation)
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith("inv:")) {
      const dealId = data.substring(4);
      const userId = ctx.from.id;
      const isManager = salesRepsService?.isManager
        ? await salesRepsService.isManager(userId, managerChatIds)
        : managerChatIds.includes(userId);

      let callerRep: any = null;
      if (!isManager) {
        try {
          callerRep = await salesRepsService.findSalesRepByTelegramId(userId);
        } catch {}
      }

      await ctx.answerCallbackQuery({ text: "Generating Proforma Invoice..." }).catch(() => {});
      await deliverProformaPdf(ctx, dealId, isManager, callerRep);
      return;
    }

    if (data.startsWith("stock_appr:") || data.startsWith("stock_rej:")) {
      const isApprove = data.startsWith("stock_appr:");
      const requestId = data.split(":")[1]!;
      const userId = ctx.from.id;

      const isManager = salesRepsService?.isManager
        ? await salesRepsService.isManager(userId, managerChatIds)
        : managerChatIds.includes(userId);

      if (!isManager) {
        await ctx.answerCallbackQuery({
          text: "⛔ Unauthorized: Only Executive Managers can approve inventory adjustments.",
          show_alert: true,
        }).catch(() => {});
        return;
      }

      let managerName = "Executive Manager";
      try {
        const caller = await salesRepsService.findSalesRepByTelegramId(userId);
        if (caller?.fullName) managerName = caller.fullName;
      } catch {}

      if (!registeredInventoryService) {
        await ctx.answerCallbackQuery({ text: "Error: Inventory service unavailable." }).catch(() => {});
        return;
      }

      const pending = registeredInventoryService.getPendingAdjustment(requestId);
      if (!pending || pending.status !== "Pending") {
        await ctx.answerCallbackQuery({ text: "Adjustment request already processed or expired." }).catch(() => {});
        return;
      }

      const isNew = Boolean(pending.isNewItem);
      const deltaSign = pending.delta > 0 ? `+${pending.delta}` : `${pending.delta}`;

      if (isApprove) {
        await registeredInventoryService.approveAdjustment(requestId, managerName);
        await ctx.answerCallbackQuery({ text: isNew ? "✅ New item added to catalog!" : "✅ Stock adjustment approved!" }).catch(() => {});
        if (ctx.callbackQuery.message) {
          const approvedMsg = isNew
            ? `✅ *NEW INVENTORY ITEM APPROVED & ADDED*\n\n` +
              `• *Item Code:* \`${pending.itemCode}\`\n` +
              `• *Product Name:* ${pending.productName}\n` +
              `• *Catalog Price:* ETB ${Number(pending.unitPrice).toLocaleString()}\n` +
              `• *Initial Stock:* ${pending.newStock} units\n` +
              `• *Approved by:* Manager ${managerName}\n` +
              `• *Originally Requested by:* ${pending.requestedByName}\n` +
              `• *Status:* Added to Notion Inventory & Stock Catalog`
            : `✅ *INVENTORY ADJUSTMENT APPROVED*\n\n` +
              `• *Item Code:* \`${pending.itemCode}\`\n` +
              `• *Product Name:* ${pending.productName}\n` +
              `• *Updated Stock:* ${pending.newStock} units (${deltaSign} applied)\n` +
              `• *Approved by:* Manager ${managerName}\n` +
              `• *Originally Requested by:* ${pending.requestedByName}\n` +
              `• *Reason:* ${pending.reason}`;

          await ctx.editMessageText(approvedMsg, { parse_mode: "Markdown" }).catch(() => {});
        }
      } else {
        await registeredInventoryService.rejectAdjustment(requestId, managerName);
        await ctx.answerCallbackQuery({ text: isNew ? "❌ New item proposal rejected." : "❌ Stock adjustment rejected." }).catch(() => {});
        if (ctx.callbackQuery.message) {
          const rejectedMsg = isNew
            ? `❌ *NEW INVENTORY ITEM PROPOSAL REJECTED*\n\n` +
              `• *Item Code:* \`${pending.itemCode}\`\n` +
              `• *Product Name:* ${pending.productName}\n` +
              `• *Rejected by:* Manager ${managerName}\n` +
              `• *Originally Requested by:* ${pending.requestedByName}\n` +
              `• *Reason:* ${pending.reason}`
            : `❌ *INVENTORY ADJUSTMENT REJECTED*\n\n` +
              `• *Item Code:* \`${pending.itemCode}\`\n` +
              `• *Product Name:* ${pending.productName}\n` +
              `• *Stock Kept at:* ${pending.currentStock} units\n` +
              `• *Rejected by:* Manager ${managerName}\n` +
              `• *Originally Requested by:* ${pending.requestedByName}\n` +
              `• *Reason:* ${pending.reason}`;

          await ctx.editMessageText(rejectedMsg, { parse_mode: "Markdown" }).catch(() => {});
        }
      }
      return;
    }

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

export function getBot(options?: CreateBotOptions) {
  if (options?.reportsService) {
    registeredReportsService = options.reportsService;
  }
  if (!botInstance) {
    botInstance = createBot(options);
  }
  return botInstance;
}
