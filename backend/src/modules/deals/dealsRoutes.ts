import { Router } from "express";
import { verifyTelegramAuth, type AuthenticatedRequest } from "../auth/telegramAuth.js";
import { DealsService } from "./dealsService.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";

export interface DealsRouterOptions {
  dealsService: DealsService;
  salesRepsService?: SalesRepsService | undefined;
}

export function createDealsRouter(options: DealsRouterOptions): Router {
  const router = Router();
  const { dealsService, salesRepsService } = options;

  // 1. Submit Bank Transaction Share Link (SMS / Mobile Banking Receipt URL)
  router.post("/:id/payment-proof", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const telegramUser = req.telegramUser;

      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized: Missing Telegram user context" });
      }

      // Verify caller is active staff if salesRepsService provided
      let submitterName = `${telegramUser.firstName || ""} ${telegramUser.lastName || ""}`.trim();
      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        if (!caller || caller.status !== "Active") {
          return res.status(403).json({
            error: "Forbidden: Only active sales representatives or managers can submit payment proofs.",
          });
        }
        if (caller.fullName) {
          submitterName = caller.fullName;
        }
      }

      const { proofUrl, depositRef } = req.body || {};

      if (!proofUrl || typeof proofUrl !== "string" || !proofUrl.startsWith("http")) {
        return res.status(400).json({
          error: "Validation Error: A valid transaction link (http/https) from bank SMS or mobile app is required.",
        });
      }

      const result = await dealsService.submitPaymentProof({
        dealId,
        proofUrl: proofUrl.trim(),
        depositRef: depositRef ? String(depositRef).trim() : undefined,
        submittedByTelegramId: telegramUser.id,
        submittedByName: submitterName || "Sales Representative",
      });

      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message?.includes("Validation Error")) {
        return res.status(400).json({ error: err.message });
      }

      if (err.message?.includes("Deal not found") || err.message?.includes("Page not found")) {
        return res.status(404).json({ error: "Not Found", message: err.message });
      }

      return res.status(500).json({
        error: "Internal Server Error",
        details: err.message,
      });
    }
  });

  // 2. List deals for current authenticated user
  router.get("/", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!salesRepsService) {
        const deals = await dealsService.listAllDeals();
        return res.status(200).json({ success: true, deals });
      }

      const rep = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
      if (!rep || rep.status !== "Active") {
        return res.status(403).json({ error: "Forbidden: Not an active sales team member" });
      }

      if (rep.role === "Manager") {
        const deals = await dealsService.listAllDeals();
        return res.status(200).json({ success: true, deals });
      }

      const deals = await dealsService.listDealsForRep(rep.pageId);
      return res.status(200).json({ success: true, deals });
    } catch (err: any) {
      return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  // 3. Get single deal details
  router.get("/:id", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const deal = await dealsService.getDeal(dealId);
      return res.status(200).json({ success: true, deal });
    } catch (err: any) {
      if (err.message?.includes("Deal not found")) {
        return res.status(404).json({ error: "Not Found", message: err.message });
      }
      return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  // 4. List activities & progress notes for a deal / company
  router.get("/:id/activities", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const companyName = typeof req.query.companyName === "string" ? req.query.companyName : undefined;
      const activities = await dealsService.listActivities(dealId, companyName);
      return res.status(200).json({ success: true, activities });
    } catch (err: any) {
      return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  // 5. Add a note or schedule a follow-up call
  router.post("/:id/activities", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        type = "Note",
        content,
        scheduledDate,
        scheduledTime,
        companyName,
        contactPerson,
        contactPhone,
      } = req.body || {};

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ error: "Validation Error: Note content is required" });
      }

      const activity = await dealsService.addActivity({
        dealId,
        type: type === "Call" ? "Call" : type === "Meeting" ? "Meeting" : "Note",
        content: content.trim(),
        scheduledDate,
        scheduledTime,
        repTelegramId: telegramUser.id,
        repName: telegramUser.firstName,
        companyName,
        contactPerson,
        contactPhone,
      });

      return res.status(201).json({ success: true, activity });
    } catch (err: any) {
      return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  return router;
}
