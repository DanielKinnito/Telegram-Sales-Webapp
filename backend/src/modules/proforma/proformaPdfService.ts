import PDFDocument from "pdfkit";

export interface ProformaInvoiceData {
  dealId: string;
  refNo: string;
  date: string;
  customerName: string;
  customerTin?: string | null | undefined;
  productDescription: string;
  quantity?: number | undefined;
  unit?: string | undefined;
  unitPrice?: number | undefined;
  totalAmountVatIncl: number;
  repName: string;
  repPhone: string;
}

export class ProformaPdfService {
  /**
   * Generates a high-quality, print-ready corporate Proforma Invoice PDF matching
   * YC Electric Equipment Manufacturing PLC's institutional format.
   */
  public static async generateProformaPdf(data: ProformaInvoiceData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 36, // 0.5 inch margins
          info: {
            Title: `Proforma Invoice - ${data.customerName}`,
            Author: "YC Electric Equipment Manufacturing PLC",
            Subject: `Ref No: ${data.refNo}`,
          },
        });

        const buffers: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err: Error) => reject(err));

        // Calculations for 15% Ethiopian VAT
        const totalWithVat = data.totalAmountVatIncl || 0;
        const totalBeforeVat = Math.round((totalWithVat / 1.15) * 100) / 100;
        const vatAmount = Math.round((totalWithVat - totalBeforeVat) * 100) / 100;

        const formatCurrency = (val: number) =>
          val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const unitPrice =
          data.unitPrice != null
            ? data.unitPrice
            : totalBeforeVat / (data.quantity || 1);

        // 1. Header: Corporate Badge & Letterhead
        const leftMargin = 36;
        const contentWidth = 523; // A4 width 595 - 72

        // Top Corporate Logo Badge (Vector Red Badge)
        doc.save();
        doc.rect(leftMargin, 36, 110, 36).fillAndStroke("#cf1515", "#b01010");
        doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
        doc.text("YUCHAI POWER", leftMargin + 8, 43, { width: 94, align: "center" });
        doc.fontSize(6).font("Helvetica");
        doc.text("MARINE & GENSET POWER", leftMargin + 5, 57, { width: 100, align: "center" });
        doc.restore();

        // Company Details next to Badge
        doc.fillColor("#111827").fontSize(13).font("Helvetica-Bold");
        doc.text("YC Electric Equipment Manufacturing PLC.", leftMargin + 120, 36);

        doc.fillColor("#374151").fontSize(8.5).font("Helvetica");
        doc.text("Add: Nifasselk Lafto, Addis Ababa, Ethiopia", leftMargin + 120, 52);
        doc.text("Email: Ycelectric24@gmail.com", leftMargin + 310, 52);
        doc.text(
          "Contact: Yafet Bisrat    Tel: +251900640028 / +251929296636",
          leftMargin + 120,
          65
        );

        // Date and Ref No (Right Aligned Header Card)
        doc.save();
        doc.rect(leftMargin + contentWidth - 165, 84, 165, 28).fill("#fef08a"); // Yellow highlight matching image
        doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
        doc.text(`Date: ${data.date}`, leftMargin + contentWidth - 160, 88);
        doc.text(`Ref. No.: ${data.refNo}`, leftMargin + contentWidth - 160, 99);
        doc.restore();

        // 2. Recipient Box
        const recipientTop = 118;
        doc.rect(leftMargin, recipientTop, 270, 24).lineWidth(1.2).stroke("#000000");
        doc.fillColor("#000000").fontSize(9.5).font("Helvetica-BoldOblique");
        doc.text(
          `To:  ${data.customerName}${data.customerTin ? ` (TIN: ${data.customerTin})` : ""}`,
          leftMargin + 8,
          recipientTop + 6,
          { width: 254, ellipsis: true }
        );

        // 3. Document Title
        const titleTop = 152;
        doc.fillColor("#000000").fontSize(13).font("Helvetica-Bold");
        const titleText = "PROFORMA INVOICE";
        const titleWidth = doc.widthOfString(titleText);
        const titleX = leftMargin + (contentWidth - titleWidth) / 2;
        doc.text(titleText, titleX, titleTop);
        // Underline title
        doc.moveTo(titleX, titleTop + 14).lineTo(titleX + titleWidth, titleTop + 14).lineWidth(1).stroke();

        // 4. Itemized Table
        const tableTop = 175;
        const colW = {
          itNo: 35,
          itemCode: 55,
          desc: 233,
          qty: 55,
          unitPrice: 72,
          totalPrice: 73,
        };

        const colX = {
          itNo: leftMargin,
          itemCode: leftMargin + colW.itNo,
          desc: leftMargin + colW.itNo + colW.itemCode,
          qty: leftMargin + colW.itNo + colW.itemCode + colW.desc,
          unitPrice: leftMargin + colW.itNo + colW.itemCode + colW.desc + colW.qty,
          totalPrice: leftMargin + colW.itNo + colW.itemCode + colW.desc + colW.qty + colW.unitPrice,
        };

        const headerHeight = 20;

        // Table Header Fill & Outlines
        doc.rect(leftMargin, tableTop, contentWidth, headerHeight).fillAndStroke("#f3f4f6", "#000000");
        doc.fillColor("#000000").fontSize(8.5).font("Helvetica-Bold");

        // Column vertical lines for header
        Object.values(colX).slice(1).forEach((x) => {
          doc.moveTo(x, tableTop).lineTo(x, tableTop + headerHeight).stroke("#000000");
        });

        // Header labels
        doc.text("It. No.", colX.itNo, tableTop + 5, { width: colW.itNo, align: "center" });
        doc.text("Item Code", colX.itemCode, tableTop + 5, { width: colW.itemCode, align: "center" });
        doc.text("Description", colX.desc, tableTop + 5, { width: colW.desc, align: "center" });
        doc.text("Qty", colX.qty, tableTop + 5, { width: colW.qty, align: "center" });
        doc.text("Unit price", colX.unitPrice, tableTop + 5, { width: colW.unitPrice, align: "center" });
        doc.text("Total price", colX.totalPrice, tableTop + 5, { width: colW.totalPrice, align: "center" });

        // Row 1: Product Row
        const row1Top = tableTop + headerHeight;
        const row1Height = 135;

        doc.rect(leftMargin, row1Top, contentWidth, row1Height).stroke("#000000");
        // Column vertical dividers for row 1
        Object.values(colX).slice(1).forEach((x) => {
          doc.moveTo(x, row1Top).lineTo(x, row1Top + row1Height).stroke("#000000");
        });

        // Content Row 1
        doc.font("Helvetica").fontSize(8.5);
        doc.text("1.", colX.itNo, row1Top + 8, { width: colW.itNo, align: "center" });
        doc.text("", colX.itemCode, row1Top + 8, { width: colW.itemCode, align: "center" });

        // Product description formatted lines
        doc.font("Helvetica-Bold").fontSize(8.5);
        doc.text(data.productDescription || "SILENT DIESEL GENERATOR SET", colX.desc + 6, row1Top + 8, {
          width: colW.desc - 12,
          lineGap: 2,
        });

        // Qty
        doc.font("Helvetica").fontSize(8.5);
        doc.text(`${data.quantity || 1} ${data.unit || "unit"}`, colX.qty, row1Top + 8, {
          width: colW.qty,
          align: "center",
        });

        // Unit Price & Total Price (Before VAT)
        doc.text(formatCurrency(unitPrice), colX.unitPrice, row1Top + 8, {
          width: colW.unitPrice - 6,
          align: "right",
        });
        doc.text(formatCurrency(totalBeforeVat), colX.totalPrice, row1Top + 8, {
          width: colW.totalPrice - 6,
          align: "right",
        });

        // Row 2: ATS Row (Optional accessory row matching template)
        const row2Top = row1Top + row1Height;
        const row2Height = 18;
        doc.rect(leftMargin, row2Top, contentWidth, row2Height).stroke("#000000");
        Object.values(colX).slice(1).forEach((x) => {
          doc.moveTo(x, row2Top).lineTo(x, row2Top + row2Height).stroke("#000000");
        });
        doc.font("Helvetica").fontSize(8.5);
        doc.text("2", colX.itNo, row2Top + 4, { width: colW.itNo, align: "center" });
        doc.font("Helvetica-BoldOblique");
        doc.text("ATS (Automatic Transfer Switch)", colX.desc + 6, row2Top + 4, { width: colW.desc - 12 });

        // 5. Totals Block (Right Aligned under Table)
        const totalBoxTop = row2Top + row2Height;
        const totalsHeight = 16;
        const summaryLabelWidth = colW.itNo + colW.itemCode + colW.desc + colW.qty + colW.unitPrice;

        // Subtotal row
        doc.rect(leftMargin, totalBoxTop, contentWidth, totalsHeight).stroke("#000000");
        doc.moveTo(colX.totalPrice, totalBoxTop).lineTo(colX.totalPrice, totalBoxTop + totalsHeight).stroke("#000000");
        doc.font("Helvetica-BoldOblique").fontSize(8.5);
        doc.text("Total price before VAT", leftMargin, totalBoxTop + 4, {
          width: summaryLabelWidth - 8,
          align: "right",
        });
        doc.font("Helvetica-Bold").fontSize(8.5);
        doc.text(formatCurrency(totalBeforeVat), colX.totalPrice, totalBoxTop + 4, {
          width: colW.totalPrice - 6,
          align: "right",
        });

        // VAT 15% row
        const vatBoxTop = totalBoxTop + totalsHeight;
        doc.rect(leftMargin, vatBoxTop, contentWidth, totalsHeight).stroke("#000000");
        doc.moveTo(colX.totalPrice, vatBoxTop).lineTo(colX.totalPrice, vatBoxTop + totalsHeight).stroke("#000000");
        doc.font("Helvetica-BoldOblique").fontSize(8.5);
        doc.text("15% VAT", leftMargin, vatBoxTop + 4, {
          width: summaryLabelWidth - 8,
          align: "right",
        });
        doc.font("Helvetica-Bold").fontSize(8.5);
        doc.text(formatCurrency(vatAmount), colX.totalPrice, vatBoxTop + 4, {
          width: colW.totalPrice - 6,
          align: "right",
        });

        // Grand Total row
        const grandTotalBoxTop = vatBoxTop + totalsHeight;
        doc.rect(leftMargin, grandTotalBoxTop, contentWidth, totalsHeight + 2).stroke("#000000");
        doc.moveTo(colX.totalPrice, grandTotalBoxTop).lineTo(colX.totalPrice, grandTotalBoxTop + totalsHeight + 2).stroke("#000000");
        doc.font("Helvetica-BoldOblique").fontSize(8.5);
        doc.text("Total price with VAT", leftMargin, grandTotalBoxTop + 4, {
          width: summaryLabelWidth - 8,
          align: "right",
        });
        doc.font("Helvetica-Bold").fontSize(8.5);
        doc.text(formatCurrency(totalWithVat), colX.totalPrice, grandTotalBoxTop + 4, {
          width: colW.totalPrice - 6,
          align: "right",
        });

        // 6. Conditions of Supply
        const conditionsTop = grandTotalBoxTop + 36;
        doc.font("Helvetica-Bold").fontSize(9);
        const condTitle = "Conditions of Supply";
        doc.text(condTitle, leftMargin, conditionsTop);
        const condTitleWidth = doc.widthOfString(condTitle);
        doc.moveTo(leftMargin, conditionsTop + 10).lineTo(leftMargin + condTitleWidth, conditionsTop + 10).stroke();

        doc.font("Helvetica-Oblique").fontSize(8).fillColor("#1f2937");
        let curCondY = conditionsTop + 16;
        const conditions = [
          "Payment: 40% in advance and remaining 60% delivery at sellers warehouse",
          "Delivery: 10 DAYS",
          "Price Validity: 7 Days",
          "Supplier: yc electric equipment manufacturing plc,",
          "Warranty: 18 month for manufacturing defects",
        ];

        conditions.forEach((cond) => {
          doc.text(cond, leftMargin, curCondY);
          curCondY += 12;
        });

        // 7. Signoff and Representative Contact
        const signoffTop = curCondY + 12;
        doc.font("Helvetica").fontSize(8).fillColor("#111827");
        doc.text("With best Regards", leftMargin, signoffTop);
        doc.font("Helvetica-Bold").fontSize(8.5);
        doc.text("YC Electric Equipment Manufacturing PLC", leftMargin, signoffTop + 12);

        doc.font("Helvetica-Bold").fontSize(8.5);
        doc.text(`CONTACT PERSON :   ${data.repName?.toUpperCase() || "SALES REPRESENTATIVE"}`, leftMargin, signoffTop + 34);
        doc.text(`MOBILE NUMBER :    ${data.repPhone || "N/A"}`, leftMargin, signoffTop + 46);

        // 8. Payment Note & Bank Accounts Box
        const bankBoxTop = signoffTop + 68;
        doc.rect(leftMargin, bankBoxTop, contentWidth, 54).fillAndStroke("#f9fafb", "#9ca3af");

        doc.fillColor("#111827").fontSize(7.5).font("Helvetica-Bold");
        doc.text(
          "Note: payment should be made through our company account listed below. If its check payment we will only accept commercial bank checks, otherwise the customer needs to make RTGS transfer to our account and bring the deposit slip. Thank you for your cooperation.",
          leftMargin + 10,
          bankBoxTop + 6,
          { width: contentWidth - 20, align: "center" }
        );

        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#000000");
        doc.text(
          "Bank: Commercial Bank of Ethiopia, Account Number: 1000611229953",
          leftMargin + 10,
          bankBoxTop + 27,
          { width: contentWidth - 20, align: "center" }
        );
        doc.text(
          "Awash Bank, Account Number: 013041335778100",
          leftMargin + 10,
          bankBoxTop + 40,
          { width: contentWidth - 20, align: "center" }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
