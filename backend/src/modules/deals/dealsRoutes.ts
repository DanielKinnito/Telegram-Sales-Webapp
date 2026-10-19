import { Router } from "express";
import { verifyTelegramAuth, type AuthenticatedRequest } from "../auth/telegramAuth.js";
import { DealsService } from "./dealsService.js";
import type { SalesRepsService } from "../notion/salesRepsService.js";
import { ProformaPdfService } from "../proforma/proformaPdfService.js";

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
        error: err.message || "Failed to process payment link in CRM",
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

      const deals = await dealsService.listDealsForRep(rep.pageId, rep.fullName);
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

  // 3b. Update deal stage (e.g. Won, Lost)
  router.patch("/:id/stage", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let submitterName = `${telegramUser.firstName || ""} ${telegramUser.lastName || ""}`.trim();
      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        if (caller?.fullName) {
          submitterName = caller.fullName;
        }
      }

      const { stage, reason, productType, offerAmount } = req.body || {};
      if (!stage || typeof stage !== "string") {
        return res.status(400).json({ error: "Validation Error: Stage is required." });
      }

      const updatedDeal = await dealsService.updateDealStage(dealId, {
        stage,
        reason: reason ? String(reason).trim() : undefined,
        productType: productType ? String(productType).trim() : undefined,
        offerAmount: offerAmount != null ? Number(offerAmount) : undefined,
        updatedByTelegramId: telegramUser.id,
        updatedByName: submitterName,
      });

      return res.status(200).json({ success: true, deal: updatedDeal });
    } catch (err: any) {
      if (err.message?.includes("Deal not found")) {
        return res.status(404).json({ error: "Not Found", message: err.message });
      }
      return res.status(500).json({ error: err.message || "Failed to update deal stage", details: err.message });
    }
  });

  // 3c. Submit Proposed Offer (Generator/Pump with VAT price)
  router.post("/:id/proposed-offer", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let submitterName = `${telegramUser.firstName || ""} ${telegramUser.lastName || ""}`.trim();
      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        if (caller?.fullName) {
          submitterName = caller.fullName;
        }
      }

      const { productType, offerAmount, companyName } = req.body || {};
      if (!productType || typeof productType !== "string" || !productType.trim()) {
        return res.status(400).json({ error: "Validation Error: Equipment Type is required." });
      }
      if (offerAmount == null || isNaN(Number(offerAmount)) || Number(offerAmount) <= 0) {
        return res.status(400).json({ error: "Validation Error: Valid offer amount is required." });
      }

      const updatedDeal = await dealsService.submitProposedOffer(dealId, {
        productType: String(productType).trim(),
        offerAmount: Number(offerAmount),
        repTelegramId: telegramUser.id,
        repName: submitterName,
        companyName: companyName ? String(companyName).trim() : undefined,
      });

      return res.status(200).json({ success: true, deal: updatedDeal });
    } catch (err: any) {
      if (err.message?.includes("Deal not found")) {
        return res.status(404).json({ error: "Not Found", message: err.message });
      }
      return res.status(500).json({ error: err.message || "Failed to submit proposed offer", details: err.message });
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

  // 6. Download Proforma Invoice PDF
  router.get("/:id/proforma-invoice", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check caller authorization
      let isManager = false;
      let repFullName = "";
      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        if (!caller || caller.status !== "Active") {
          return res.status(403).json({ error: "Forbidden: Not an active staff member" });
        }
        isManager = caller.role === "Manager";
        repFullName = caller.fullName || "";
      }

      const deal = await dealsService.getDeal(dealId);
      // If not manager, sales rep can only access their own deal (or unassigned deal)
      if (!isManager && repFullName && deal.repName) {
        if (deal.repName.trim().toLowerCase() !== repFullName.trim().toLowerCase()) {
          return res.status(403).json({ error: "Forbidden: You are not assigned to this deal" });
        }
      }

      const proformaData = await dealsService.getProformaInvoiceData(dealId);
      const pdfBuffer = await ProformaPdfService.generateProformaPdf(proformaData);

      const safeName = (proformaData.customerName || dealId).replace(/[^a-zA-Z0-9_-]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Proforma_Invoice_${safeName}.pdf"`);
      return res.status(200).send(pdfBuffer);
    } catch (err: any) {
      if (err.message?.includes("Deal not found")) {
        return res.status(404).json({ error: "Not Found", message: err.message });
      }
      return res.status(500).json({ error: "Failed to generate Proforma Invoice", details: err.message });
    }
  });

  // 7. Send Proforma Invoice PDF directly to user's Telegram chat
  router.post("/:id/send-proforma-to-chat", verifyTelegramAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const telegramUser = req.telegramUser;
      if (!telegramUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check caller authorization
      let isManager = false;
      let repFullName = "";
      if (salesRepsService) {
        const caller = await salesRepsService.findSalesRepByTelegramId(telegramUser.id);
        if (!caller || caller.status !== "Active") {
          return res.status(403).json({ error: "Forbidden: Not an active staff member" });
        }
        isManager = caller.role === "Manager";
        repFullName = caller.fullName || "";
      }

      const deal = await dealsService.getDeal(dealId);
      // If not manager, sales rep can only access their own deal (or unassigned deal)
      if (!isManager && repFullName && deal.repName) {
        if (deal.repName.trim().toLowerCase() !== repFullName.trim().toLowerCase()) {
          return res.status(403).json({ error: "Forbidden: You are not assigned to this deal" });
        }
      }

      const result = await dealsService.sendProformaInvoiceToTelegram(dealId, telegramUser.id);
      return res.status(200).json({
        success: true,
        message: "Proforma Invoice PDF sent to your Telegram chat!",
        sentToChatId: result.sentToChatId,
      });
    } catch (err: any) {
      if (err.message?.includes("Deal not found")) {
        return res.status(404).json({ error: "Not Found", message: err.message });
      }
      return res.status(500).json({ error: "Failed to send Proforma Invoice to Telegram", details: err.message });
    }
  });

  return router;
}
