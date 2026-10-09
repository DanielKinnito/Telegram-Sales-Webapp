import { Router } from "express";
import { verifyTelegramAuth, type AuthenticatedRequest } from "../auth/telegramAuth.js";
import type { LeadsService } from "./leadsService.js";
import { isValidTin, sanitizeTin } from "../common/tinValidator.js";

export function createLeadsRouter(leadsService: LeadsService): Router {
  const router = Router();

  // 1. Check TIN availability
  router.post("/check-tin", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { tin } = req.body || {};

      if (!tin || !isValidTin(tin)) {
        return res.status(400).json({
          error: "Validation Error: TIN Number must be exactly 10 numeric digits (e.g. 0012345678)",
        });
      }

      const result = await leadsService.checkTin(tin);

      if (!result.available) {
        return res.status(409).json(result);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message?.includes("Validation Error")) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  // 2. Register Lead / Customer Account
  router.post("/register", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        companyName,
        tin,
        address,
        industry,
        contactPerson,
        contactPhone,
        isCommission,
        beneficiaryName,
        beneficiaryPhone,
      } = req.body || {};
      const telegramUserId = req.telegramUser?.id;

      if (!telegramUserId) {
        return res.status(401).json({ error: "Unauthorized: Missing Telegram user context" });
      }

      if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
        return res.status(400).json({ error: "Validation Error: Company Name is required" });
      }

      if (!tin || !isValidTin(tin)) {
        return res.status(400).json({
          error: "Validation Error: TIN Number must be exactly 10 numeric digits (e.g. 0012345678)",
        });
      }

      const account = await leadsService.registerLead({
        telegramUserId,
        companyName: companyName.trim(),
        tin: sanitizeTin(tin),
        address,
        industry,
        contactPerson,
        contactPhone,
        isCommission: Boolean(isCommission),
        beneficiaryName,
        beneficiaryPhone,
      });

      return res.status(201).json({
        success: true,
        account,
      });
    } catch (err: any) {
      if (err.message?.includes("Forbidden")) {
        return res.status(403).json({ error: err.message });
      }
      if (err.message?.includes("Validation Error")) {
        return res.status(400).json({ error: err.message });
      }
      if (err.message?.includes("Duplicate registration blocked") || err.message?.includes("registered under")) {
        return res.status(409).json({ error: "Conflict", message: err.message });
      }
      return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  return router;
}
