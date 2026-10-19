import { describe, it, expect } from "vitest";
import {
  WeeklyReportPdfService,
  type WeeklyReportPdfData,
} from "./weeklyReportPdfService.js";

describe("WeeklyReportPdfService", () => {
  it("generates a valid, beautifully formatted Weekly Executive Sales Report PDF buffer", async () => {
    const data: WeeklyReportPdfData = {
      reportTitle: "Weekly Sales Performance Report — Week ending October 19, 2026",
      periodString: "October 12, 2026 – October 19, 2026",
      publicationDate: "October 19, 2026",
      totalWonRevenue: 38480000,
      dealsWonCount: 4,
      dealsLostCount: 1,
      activePipelineCount: 1,
      newAccountsCount: 11,
      wonDeals: [
        {
          title: "Ermi Order",
          company: "Ermi PLC",
          amount: 10000000,
          product: "100kva",
          rep: "Firaol Dagne",
        },
        {
          title: "sunshine plc Order",
          company: "Sunshine PLC",
          amount: 28000000,
          product: "50KVA",
          rep: "Firaol Dagne",
        },
      ],
      lostDeals: [
        {
          title: "Abiulkhase PLC Order",
          company: "Abiulkhase PLC",
          reason: "No response",
          rep: "Firaol Dagne",
        },
      ],
      pipelineDeals: [
        {
          title: "Finfinne Commercial Tower",
          company: "Finfinne Tower",
          stage: "Negotiation",
          amount: 4200000,
          rep: "Olana kebede",
        },
      ],
      repPerformance: [
        {
          repName: "Firaol Dagne",
          role: "Sales Rep",
          wonCount: 2,
          wonRevenue: 38000000,
          lostCount: 1,
          pipelineCount: 0,
          logsCount: 4,
          wonDeals: [
            { title: "Ermi Order", amount: 10000000, product: "100kva" },
            { title: "sunshine plc Order", amount: 28000000, product: "50KVA" },
          ],
          lostDeals: [{ title: "Abiulkhase PLC Order", reason: "No response" }],
          pipelineDeals: [],
          consultedCompanies: ["Ermi PLC", "Sunshine PLC"],
        },
        {
          repName: "Olana kebede",
          role: "Sales Rep",
          wonCount: 0,
          wonRevenue: 0,
          lostCount: 0,
          pipelineCount: 1,
          logsCount: 0,
          wonDeals: [],
          lostDeals: [],
          pipelineDeals: [
            { title: "Finfinne Commercial Tower", stage: "Negotiation", amount: 4200000 },
          ],
          consultedCompanies: [],
        },
      ],
    };

    const pdfBuffer = await WeeklyReportPdfService.generateReportPdf(data);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(2000);
    // PDF magic bytes %PDF
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("handles empty or zero report data gracefully without NaN or crashing", async () => {
    const data: WeeklyReportPdfData = {
      reportTitle: "Weekly Sales Performance Report — Week ending October 26, 2026",
      periodString: "October 19, 2026 – October 26, 2026",
      publicationDate: "October 26, 2026",
      totalWonRevenue: 0,
      dealsWonCount: 0,
      dealsLostCount: 0,
      activePipelineCount: 0,
      newAccountsCount: 0,
      wonDeals: [],
      lostDeals: [],
      pipelineDeals: [],
      repPerformance: [],
    };

    const pdfBuffer = await WeeklyReportPdfService.generateReportPdf(data);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
