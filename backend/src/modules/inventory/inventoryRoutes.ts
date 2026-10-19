import { Router } from "express";
import { verifyTelegramAuth, type AuthenticatedRequest } from "../auth/telegramAuth.js";
import { InventoryService } from "./inventoryService.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { sendStockAdjustmentAlertToManagers } from "../bot/bot.js";

export interface InventoryRouterOptions {
  inventoryService: InventoryService;
  salesRepsService?: SalesRepsService | undefined;
  bot?: any | undefined;
  managerChatIds?: number[] | undefined;
}

export function createInventoryRouter(options: InventoryRouterOptions): Router {
  const router = Router();
  const { inventoryService, salesRepsService, bot, managerChatIds = [] } = options;

  // 1. Get live inventory catalog
  router.get("/", verifyTelegramAuth, async (_req: AuthenticatedRequest, res) => {
    try {
      const catalog = await inventoryService.listCatalog();
      return res.status(200).json({ success: true, catalog });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to retrieve inventory catalog", details: err.message });
    }
  });

  // 2. Front Desk submits stock adjustment request (requires Manager approval)
  router.post("/adjust-request", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized: Missing Telegram user" });
      }

      let requesterName = `${telegramUser.firstName || ""} ${telegramUser.lastName || ""}`.trim();
      let isFrontDeskOrManager = false;

      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        if (!caller || caller.status !== "Active") {
          return res.status(403).json({ error: "Forbidden: Not an active staff member" });
        }
        if (caller.fullName) requesterName = caller.fullName;
        isFrontDeskOrManager = caller.role === "Front Desk" || caller.role === "Manager";
      } else {
        isFrontDeskOrManager = true;
      }

      if (!isFrontDeskOrManager) {
        return res.status(403).json({
          error: "Forbidden: Only Front Desk staff or Managers can submit inventory adjustments.",
        });
      }

      const { itemCode, productName, delta, reason } = req.body || {};
      if (!itemCode && !productName) {
        return res.status(400).json({ error: "Validation Error: Item Code or Product Name is required." });
      }
      if (delta === undefined || isNaN(Number(delta)) || Number(delta) === 0) {
        return res.status(400).json({ error: "Validation Error: A non-zero adjustment delta (+/-) is required." });
      }

      const adjustment = await inventoryService.createAdjustmentRequest({
        itemCode: itemCode ? String(itemCode).trim() : undefined as any,
        productName: productName ? String(productName).trim() : undefined,
        delta: Number(delta),
        reason: reason ? String(reason).trim() : "Front Desk Stock Adjustment",
        requestedByTelegramId: telegramUser.id,
        requestedByName: requesterName || "Front Desk Staff",
      });

      // Dispatch detailed alert to managers via Telegram
      let managersNotified = 0;
      if (bot && managerChatIds.length > 0) {
        managersNotified = await sendStockAdjustmentAlertToManagers(
          bot,
          managerChatIds,
          adjustment
        );
      }

      return res.status(201).json({
        success: true,
        adjustment,
        managersNotified,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: "Failed to submit inventory adjustment request",
        details: err.message,
      });
    }
  });

  // 3. Direct stock adjustment (for Managers)
  router.post("/adjust-direct", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let isManager = false;
      let managerName = `${telegramUser.firstName || ""} ${telegramUser.lastName || ""}`.trim();

      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        isManager = caller?.role === "Manager" || caller?.status === "Active" && managerChatIds.includes(telegramUser.id);
        if (caller?.fullName) managerName = caller.fullName;
      } else {
        isManager = managerChatIds.includes(telegramUser.id);
      }

      if (!isManager) {
        return res.status(403).json({ error: "Forbidden: Only Executive Managers can directly adjust stock." });
      }

      const { itemCode, productName, delta, newQuantity, reason } = req.body || {};
      if (!itemCode && !productName) {
        return res.status(400).json({ error: "Validation Error: Item Code or Product Name is required." });
      }

      const updated = await inventoryService.directAdjustStock({
        itemCode: itemCode ? String(itemCode).trim() : undefined as any,
        productName: productName ? String(productName).trim() : undefined,
        delta: delta !== undefined ? Number(delta) : undefined,
        newQuantity: newQuantity !== undefined ? Number(newQuantity) : undefined,
        reason: reason ? String(reason).trim() : "Direct Manager adjustment",
        updatedByName: managerName || "Executive Manager",
      });

      return res.status(200).json({ success: true, item: updated });
    } catch (err: any) {
      return res.status(500).json({
        error: "Failed to adjust stock directly",
        details: err.message,
      });
    }
  });

  return router;
}
