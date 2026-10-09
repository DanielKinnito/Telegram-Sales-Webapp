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
import { getNotionClient } from "./modules/notion/notionClient.js";
import { SalesRepsService } from "./modules/notion/salesRepsService.js";
import { getTinCache } from "./modules/leads/tinCache.js";
import { getBot, parseManagerChatIds } from "./modules/bot/bot.js";
import type { StorageProvider } from "./services/storage/types.js";
import { getStorageProvider } from "./services/storage/index.js";
import { env } from "./config/env.js";

export interface AppOptions {
  leadsService?: LeadsService | undefined;
  queueService?: QueueService | undefined;
  salesRepsService?: SalesRepsService | undefined;
  dealsService?: DealsService | undefined;
  storageProvider?: StorageProvider | undefined;
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

  const salesRepsService =
    options.salesRepsService ||
    new SalesRepsService(getNotionClient(), env.NOTION_SALES_REPS_DB_ID);

  // Protected endpoint verifying Telegram Mini App caller identity and CRM profile
  app.get("/api/auth/me", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const rep = await salesRepsService.findSalesRepByTelegramId(req.telegramUser.id);
      res.json({
        success: true,
        user: req.telegramUser,
        rep: rep
          ? {
              pageId: rep.pageId,
              fullName: rep.fullName,
              role: rep.role,
              status: rep.status,
              phone: rep.phone,
            }
          : null,
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
      bot: getBot(),
    });

  // Deals progression & payment proofs
  const storageProvider = options.storageProvider || getStorageProvider();
  const dealsService =
    options.dealsService ||
    new DealsService({
      notionClient: getNotionClient(),
      salesRepsService,
      dealsDbId: env.NOTION_DEALS_DB_ID,
      managerChatIds: parseManagerChatIds(env.TELEGRAM_MANAGER_CHAT_IDS),
      bot: getBot(),
    });

  app.use("/api/leads", createLeadsRouter(leadsService));
  app.use("/api/queue", createQueueRouter({ queueService, salesRepsService }));
  app.use("/api/deals", createDealsRouter({ dealsService, salesRepsService, storageProvider }));

  // Static files for Telegram Mini App frontend when built
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/(api|health)).*$/, (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  return app;
}

export const app = createApp();


