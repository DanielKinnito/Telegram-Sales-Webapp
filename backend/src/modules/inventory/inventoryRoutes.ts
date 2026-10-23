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
  router.get("/", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const forceRefresh = req.query.refresh === "true";
      const catalog = await inventoryService.listCatalog(forceRefresh);
      return res.status(200).json({ success: true, catalog });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to retrieve inventory catalog", details: err.message });
    }
  });

  // 2. Front Desk submits stock adjustment request or proposes a new product
  router.post("/adjust-request", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized: Missing Telegram user" });
      }

      let requesterName = `${telegramUser.firstName || ""} ${telegramUser.lastName || ""}`.trim();
      const isConfigManager = managerChatIds.includes(telegramUser.id);
      let isFrontDeskOrManager = isConfigManager;

      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        if (caller) {
          if (caller.fullName) requesterName = caller.fullName;
          if (caller.role === "Front Desk" || caller.role === "Manager" || caller.status === "Active") {
            isFrontDeskOrManager = true;
          }
        }
      }

      if (!isFrontDeskOrManager) {
        return res.status(403).json({
          error: "Forbidden: Only Front Desk staff or Managers can submit inventory adjustments.",
        });
      }

      const { isNewItem, itemCode, productName, productDescription, unitPrice, delta, reason } = req.body || {};
      if (!itemCode && !productName) {
        return res.status(400).json({ error: "Validation Error: Item Code or Product Name is required." });
      }
      if (delta === undefined || isNaN(Number(delta)) || Number(delta) === 0) {
        return res.status(400).json({ error: "Validation Error: A non-zero adjustment delta (+/-) is required." });
      }

      const adjustment = await inventoryService.createAdjustmentRequest({
        isNewItem: Boolean(isNewItem),
        itemCode: itemCode ? String(itemCode).trim().toUpperCase() : undefined as any,
        productName: productName ? String(productName).trim() : undefined,
        productDescription: productDescription ? String(productDescription).trim() : undefined,
        unitPrice: unitPrice !== undefined ? Number(unitPrice) : undefined,
        delta: Number(delta),
        reason: reason ? String(reason).trim() : (isNewItem ? "New Inventory Model Proposal" : "Front Desk Stock Adjustment"),
        requestedByTelegramId: telegramUser.id,
        requestedByName: requesterName || "Front Desk Staff",
      });

      // Dispatch detailed alert to all active managers via Telegram
      let managersNotified = 0;
      let effectiveManagerIds = managerChatIds;
      if (salesRepsService && typeof salesRepsService.getActiveManagerChatIds === "function") {
        try {
          const timeoutPromise = new Promise<number[]>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 1000)
          );
          effectiveManagerIds = await Promise.race([
            salesRepsService.getActiveManagerChatIds(managerChatIds),
            timeoutPromise,
          ]);
        } catch {
          effectiveManagerIds = managerChatIds;
        }
      }

      if (bot && effectiveManagerIds.length > 0) {
        managersNotified = await sendStockAdjustmentAlertToManagers(
          bot,
          effectiveManagerIds,
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

  // 3. Direct stock adjustment or item creation (for Managers)
  router.post("/adjust-direct", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const isConfigManager = managerChatIds.includes(telegramUser.id);
      let isManager = isConfigManager;
      let managerName = `${telegramUser.firstName || ""} ${telegramUser.lastName || ""}`.trim();

      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        if (caller?.role === "Manager" || (caller?.status === "Active" && isConfigManager)) {
          isManager = true;
        }
        if (caller?.fullName) managerName = caller.fullName;
      }

      if (!isManager) {
        return res.status(403).json({ error: "Forbidden: Only Executive Managers can directly adjust stock." });
      }

      const { isNewItem, itemCode, productName, productDescription, unitPrice, delta, newQuantity, reason } = req.body || {};
      if (!itemCode && !productName) {
        return res.status(400).json({ error: "Validation Error: Item Code or Product Name is required." });
      }

      const updated = await inventoryService.directAdjustStock({
        isNewItem: Boolean(isNewItem),
        itemCode: itemCode ? String(itemCode).trim().toUpperCase() : undefined as any,
        productName: productName ? String(productName).trim() : undefined,
        productDescription: productDescription ? String(productDescription).trim() : undefined,
        unitPrice: unitPrice !== undefined ? Number(unitPrice) : undefined,
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
