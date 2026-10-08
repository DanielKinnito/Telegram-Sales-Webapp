import { Router } from "express";
import { verifyTelegramAuth, type AuthenticatedRequest } from "../auth/telegramAuth.js";
import { QueueService, NoAvailableRepsError } from "./queueService.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { isValidTin, sanitizeTin } from "../common/tinValidator.js";

export interface QueueRouterOptions {
  queueService: QueueService;
  salesRepsService: SalesRepsService;
}

export function createQueueRouter(options: QueueRouterOptions): Router {
  const router = Router();
  const { queueService, salesRepsService } = options;

  router.post("/assign", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramUserId = req.telegramUser?.id;
      if (!telegramUserId) {
        return res.status(401).json({ error: "Unauthorized: Missing Telegram user context" });
      }

      // Check caller authorization: must be active staff
      const caller = await salesRepsService.findSalesRepByTelegramId(telegramUserId);
      if (!caller || caller.status !== "Active") {
        return res.status(403).json({
          error: "Forbidden: Only active staff members can assign walk-in leads.",
        });
      }

      const { companyName, tin, address, industry, contactName, contactPhone } = req.body || {};

      if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
        return res.status(400).json({ error: "Validation Error: Company Name is required" });
      }

      if (!tin || !isValidTin(tin)) {
        return res.status(400).json({
          error: "Validation Error: TIN Number must be exactly 10 numeric digits (e.g. 0012345678)",
        });
      }

      const result = await queueService.assignWalkIn({
        companyName: companyName.trim(),
        tin: sanitizeTin(tin),
        address,
        industry,
        contactName,
        contactPhone,
        assignedByStaffName: caller.fullName || caller.role,
      });

      return res.status(201).json(result);
    } catch (err: any) {
      if (err instanceof NoAvailableRepsError) {
        return res.status(422).json({
          error: "Unprocessable Entity",
          message: err.message,
        });
      }

      if (err.message?.includes("Validation Error")) {
        return res.status(400).json({ error: err.message });
      }

      if (
        err.message?.includes("Duplicate registration blocked") ||
        err.message?.includes("registered under")
      ) {
        return res.status(409).json({
          error: "Conflict",
          message: err.message,
        });
      }

      return res.status(500).json({
        error: "Internal Server Error",
        details: err.message,
      });
    }
  });

  return router;
}
