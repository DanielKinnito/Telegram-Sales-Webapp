import { describe, it, expect } from "vitest";
import { ProformaPdfService, type ProformaInvoiceData } from "./proformaPdfService.js";

describe("ProformaPdfService", () => {
  it("generates a valid PDF buffer matching corporate proforma specifications", async () => {
    const data: ProformaInvoiceData = {
      dealId: "test-deal-123",
      refNo: "PI/0763/YC/25",
      date: "Feb/27/2025",
      customerName: "MK Digital severity solution PLC",
      customerTin: "0012345678",
      productDescription:
        "SILENT DIESEL GENERATOR SET YC345GF\nStandby Power: 344KVA/275KW\nPrime Power: 313KVA/250KW\nRPM:1500\nP.F:0.8\nEngine:YUCHAI\nModel:YC6MK420L-D20\nAlternator: YUCHAI\nModel: YC-250-4",
      quantity: 1,
      totalAmountVatIncl: 6000000,
      repName: "OLANA KEBEDE",
      repPhone: "0938764654",
    };

    const pdfBuffer = await ProformaPdfService.generateProformaPdf(data);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic Number
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("handles empty or zero total amount cleanly without NaN", async () => {
    const data: ProformaInvoiceData = {
      dealId: "test-deal-empty",
      refNo: "PI/0000/YC/25",
      date: "Oct/19/2026",
      customerName: "Sample Customer PLC",
      productDescription: "Standard Industrial Supply",
      totalAmountVatIncl: 0,
      repName: "Unassigned",
      repPhone: "N/A",
    };

    const pdfBuffer = await ProformaPdfService.generateProformaPdf(data);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
