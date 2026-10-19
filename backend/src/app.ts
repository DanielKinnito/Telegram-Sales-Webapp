import express from "express";
import cors from "cors";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { verifyTelegramAuth, type AuthenticatedRequest } from "./modules/auth/telegramAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { LeadsService } from "./modules/leads/leadsService.js";
import { createLeadsRouter } from "./modules/leads/leadsRoutes.js";
import { QueueService } from "./modules/queue/queueService.js";
import { createQueueRouter } from "./modules/queue/queueRoutes.js";
import { DealsService } from "./modules/deals/dealsService.js";
import { createDealsRouter } from "./modules/deals/dealsRoutes.js";
import { InventoryService } from "./modules/inventory/inventoryService.js";
import { createInventoryRouter } from "./modules/inventory/inventoryRoutes.js";
import { getNotionClient } from "./modules/notion/notionClient.js";
import { SalesRepsService } from "./modules/notion/salesRepsService.js";
import { getTinCache } from "./modules/leads/tinCache.js";
import { getBot, parseManagerChatIds, setBotDealsService, setBotInventoryService } from "./modules/bot/bot.js";
import type { StorageProvider } from "./services/storage/types.js";
import { getStorageProvider } from "./services/storage/index.js";
import { env } from "./config/env.js";
import { webhookCallback } from "grammy";

export interface AppOptions {
  leadsService?: LeadsService | undefined;
  queueService?: QueueService | undefined;
  salesRepsService?: SalesRepsService | undefined;
  dealsService?: DealsService | undefined;
  inventoryService?: InventoryService | undefined;
  storageProvider?: StorageProvider | undefined;
  bot?: any | undefined;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Public health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "telegram-sales-backend",
    });
  });

  // Telegram Bot Webhook endpoint (Inbound bot commands wake Render from sleep)
  // timeoutMilliseconds is set to 60_000 to comfortably accommodate Render cold starts
  app.use(
    "/api/bot/webhook",
    env.TELEGRAM_WEBHOOK_SECRET
      ? webhookCallback(getBot(), "express", "return", 60_000, env.TELEGRAM_WEBHOOK_SECRET)
      : webhookCallback(getBot(), "express", "return", 60_000)
  );

  const salesRepsService =
    options.salesRepsService ||
    new SalesRepsService(getNotionClient(), env.NOTION_SALES_REPS_DB_ID);

  // Protected endpoint verifying Telegram Mini App caller identity and CRM profile
  app.get("/api/auth/me", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.telegramUser) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const rep = await salesRepsService.findSalesRepByTelegramId(req.telegramUser.id);
      const isConfigManager = parseManagerChatIds(env.TELEGRAM_MANAGER_CHAT_IDS).includes(req.telegramUser.id);
      const isManager = isConfigManager || rep?.role === "Manager";

      const effectiveRole = isManager ? "Manager" : (rep?.role || "Sales Rep");
      const effectiveStatus = (isManager || rep?.status === "Active") ? "Active" : (rep?.status || "Pending Approval");
      const effectiveName = rep?.fullName || `${req.telegramUser.firstName || ""} ${req.telegramUser.lastName || ""}`.trim() || (isManager ? "Executive Manager" : "Staff Member");

      res.json({
        success: true,
        user: req.telegramUser,
        rep: {
          pageId: rep?.pageId || "mgr-active",
          fullName: effectiveName,
          role: effectiveRole,
          status: effectiveStatus,
          phone: rep?.phone || "",
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Leads & Accounts management routes
  const leadsService =
    options.leadsService ||
    new LeadsService({
      notionClient: getNotionClient(),
      salesRepsService,
      tinCache: getTinCache(),
      accountsDbId: env.NOTION_ACCOUNTS_DB_ID,
    });

  // Queue & Walk-in assignment routes
  const queueService =
    options.queueService ||
    new QueueService({
      notionClient: getNotionClient(),
      salesRepsService,
      leadsService,
      queueDbId: env.NOTION_QUEUE_DB_ID,
      accountsDbId: env.NOTION_ACCOUNTS_DB_ID,
      bot: options.bot || getBot(),
    });

  // Inventory catalog & stock adjustments
  const inventoryService =
    options.inventoryService ||
    new InventoryService({
      notionClient: getNotionClient(),
      inventoryDbId: env.NOTION_INVENTORY_DB_ID,
      salesLogsDbId: env.NOTION_SALES_LOGS_DB_ID,
    });

  setBotInventoryService(inventoryService);

  // Deals progression & payment proofs
  const dealsService =
    options.dealsService ||
    new DealsService({
      notionClient: getNotionClient(),
      salesRepsService,
      dealsDbId: env.NOTION_DEALS_DB_ID,
      managerChatIds: parseManagerChatIds(env.TELEGRAM_MANAGER_CHAT_IDS),
      bot: options.bot || getBot(),
      inventoryService,
    });

  setBotDealsService(dealsService);

  app.use("/api/leads", createLeadsRouter(leadsService));
  app.use("/api/queue", createQueueRouter({ queueService, salesRepsService }));
  app.use("/api/deals", createDealsRouter({ dealsService, salesRepsService }));
  app.use(
    "/api/inventory",
    createInventoryRouter({
      inventoryService,
      salesRepsService,
      bot: options.bot || getBot(),
      managerChatIds: parseManagerChatIds(env.TELEGRAM_MANAGER_CHAT_IDS),
    })
  );

  // Static assets (logos, corporate branding, icons)
  const assetsPaths = [
    path.resolve(__dirname, "../assets"),
    path.resolve(__dirname, "assets"),
    path.resolve(process.cwd(), "assets"),
    path.resolve(process.cwd(), "backend/assets"),
  ];
  for (const assetDir of assetsPaths) {
    if (fs.existsSync(assetDir)) {
      app.use("/assets", express.static(assetDir));
      break;
    }
  }

  // Static files for Telegram Mini App frontend when built
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/(api|health|assets)).*$/, (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  return app;
}

export const app = createApp();


