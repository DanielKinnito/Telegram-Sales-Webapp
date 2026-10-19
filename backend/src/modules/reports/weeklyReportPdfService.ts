import PDFDocument from "pdfkit";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WeeklyReportPdfData {
  reportTitle: string;
  periodString: string;
  publicationDate: string;
  totalWonRevenue: number;
  dealsWonCount: number;
  dealsLostCount: number;
  activePipelineCount: number;
  newAccountsCount: number;
  wonDeals: Array<{
    title: string;
    company: string;
    amount: number;
    product: string;
    rep: string;
  }>;
  lostDeals: Array<{
    title: string;
    company: string;
    reason: string;
    rep: string;
  }>;
  pipelineDeals: Array<{
    title: string;
    company: string;
    stage: string;
    amount: number | null;
    rep: string;
  }>;
  repPerformance: Array<{
    repName: string;
    role: string;
    wonCount: number;
    wonRevenue: number;
    lostCount: number;
    pipelineCount: number;
    logsCount: number;
    wonDeals: Array<{ title: string; amount: number; product: string }>;
    lostDeals: Array<{ title: string; reason: string }>;
    pipelineDeals: Array<{ title: string; stage: string; amount: number | null }>;
    consultedCompanies: string[];
  }>;
}

export class WeeklyReportPdfService {
  /**
   * Generates a pixel-perfect, print-ready Weekly Executive Sales Performance Report PDF
   * matching YC Electric Equipment Manufacturing PLC institutional standards.
   */
  public static async generateReportPdf(data: WeeklyReportPdfData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 36, // 0.5 in margins
          bufferPages: true,
          info: {
            Title: data.reportTitle,
            Author: "YC Electric Equipment Manufacturing PLC",
            Subject: `Weekly Executive Sales Performance Report — ${data.periodString}`,
          },
        });

        const buffers: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err: Error) => reject(err));

        const leftMargin = 36;
        const pageWidth = 595.28;
        const contentWidth = pageWidth - leftMargin * 2; // 523.28

        // --- 1. HEADER: SIDE-BY-SIDE LOGO & COMPANY LETTERHEAD ---
        const logoCandidates = [
          path.resolve(__dirname, "../../assets/company_logo.png"),
          path.resolve(__dirname, "../../../assets/company_logo.png"),
          path.resolve(process.cwd(), "assets/company_logo.png"),
          path.resolve(process.cwd(), "backend/assets/company_logo.png"),
          path.resolve(process.cwd(), "backend/src/assets/company_logo.png"),
        ];

        let logoPath: string | null = null;
        for (const candidate of logoCandidates) {
          if (fs.existsSync(candidate)) {
            logoPath = candidate;
            break;
          }
        }

        const headerTop = 36;
        if (logoPath) {
          doc.image(logoPath, leftMargin, headerTop, { width: 120 });
        } else {
          // Fallback vector logo
          doc.save();
          doc.rect(leftMargin, headerTop, 120, 36).fillAndStroke("#cf1515", "#b01010");
          doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
          doc.text("YUCHAI POWER", leftMargin + 8, headerTop + 8, { width: 104, align: "center" });
          doc.fontSize(6).font("Helvetica");
          doc.text("MARINE & GENSET POWER", leftMargin + 5, headerTop + 22, { width: 110, align: "center" });
          doc.restore();
        }

        // Corporate Letterhead Details
        const textLeft = leftMargin + 130;
        doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold");
        doc.text("YC Electric Equipment Manufacturing PLC.", textLeft, headerTop);

        doc.fillColor("#0056b3").fontSize(8.5).font("Helvetica-Bold");
        doc.text("玉柴船电动力 | YUCHAI MARINE & GENSET POWER", textLeft, headerTop + 15);

        doc.fillColor("#4b5563").fontSize(7.5).font("Helvetica");
        doc.text(
          "Add: Nifasselk Lafto, Addis Ababa, Ethiopia | Email: Ycelectric24@gmail.com",
          textLeft,
          headerTop + 27
        );
        doc.text(
          "Contact: +251900640028 / +251929296636 | Commercial Operations Division",
          textLeft,
          headerTop + 37
        );

        // Header Divider
        const dividerY = headerTop + 52;
        doc.save();
        doc.moveTo(leftMargin, dividerY).lineTo(leftMargin + contentWidth, dividerY).lineWidth(1).stroke("#e5e7eb");
        doc.restore();

        // --- 2. REPORT TITLE & AUDIT METADATA CARD ---
        const metaTop = dividerY + 10;
        doc.save();
        doc.rect(leftMargin, metaTop, contentWidth, 38).fill("#f8fafc");
        doc.rect(leftMargin, metaTop, contentWidth, 38).lineWidth(0.8).stroke("#e2e8f0");

        doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold");
        doc.text("WEEKLY EXECUTIVE SALES PERFORMANCE REPORT", leftMargin + 10, metaTop + 8);

        doc.fillColor("#64748b").fontSize(7.5).font("Helvetica");
        doc.text(`Reporting Period: ${data.periodString}`, leftMargin + 10, metaTop + 22);
        doc.text(`Publication Date: ${data.publicationDate}`, leftMargin + 250, metaTop + 22);
        doc.fillColor("#0284c7").font("Helvetica-Bold");
        doc.text("CLASSIFICATION: EXECUTIVE AUDIT", leftMargin + contentWidth - 160, metaTop + 22);
        doc.restore();

        // --- 3. EXECUTIVE KPI CARDS (4 COLUMNS) ---
        const kpiTop = metaTop + 46;
        const cardWidth = (contentWidth - 18) / 4; // 4 cards with 6px gap
        const cardHeight = 44;

        const kpis = [
          {
            label: "Closed Revenue",
            value: `ETB ${data.totalWonRevenue.toLocaleString()}`,
            color: "#16a34a",
            bg: "#f0fdf4",
            border: "#bbf7d0",
          },
          {
            label: "Contracts Closed",
            value: `${data.dealsWonCount} Won / ${data.dealsLostCount} Lost`,
            color: "#0284c7",
            bg: "#f0f9ff",
            border: "#bae6fd",
          },
          {
            label: "Active Negotiations",
            value: `${data.activePipelineCount} Pipeline`,
            color: "#7c3aed",
            bg: "#faf5ff",
            border: "#e9d5ff",
          },
          {
            label: "Enterprise Accounts",
            value: `${data.newAccountsCount} Total`,
            color: "#d97706",
            bg: "#fffbeb",
            border: "#fde68a",
          },
        ];

        kpis.forEach((kpi, idx) => {
          const cardX = leftMargin + idx * (cardWidth + 6);
          doc.save();
          doc.rect(cardX, kpiTop, cardWidth, cardHeight).fill(kpi.bg);
          doc.rect(cardX, kpiTop, cardWidth, cardHeight).lineWidth(0.8).stroke(kpi.border);

          doc.fillColor("#64748b").fontSize(7).font("Helvetica-Bold");
          doc.text(kpi.label.toUpperCase(), cardX + 8, kpiTop + 8, { width: cardWidth - 16 });

          doc.fillColor(kpi.color).fontSize(10).font("Helvetica-Bold");
          doc.text(kpi.value, cardX + 8, kpiTop + 22, { width: cardWidth - 16, ellipsis: true });
          doc.restore();
        });

        let currentY = kpiTop + cardHeight + 16;

        const checkPageBreak = (neededHeight: number) => {
          if (currentY + neededHeight > 780) {
            doc.addPage();
            currentY = 36;
          }
        };

        const renderSectionHeading = (title: string) => {
          checkPageBreak(30);
          doc.save();
          doc.rect(leftMargin, currentY, 3, 14).fill("#0056b3");
          doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold");
          doc.text(title, leftMargin + 8, currentY + 1);
          doc.restore();
          currentY += 20;
        };

        // --- 4. EXECUTED CONTRACTS & CLOSED REVENUE ---
        renderSectionHeading("1. Executed Contracts & Closed Revenue");

        if (data.wonDeals.length === 0) {
          checkPageBreak(18);
          doc.fillColor("#64748b").fontSize(8).font("Helvetica-Oblique");
          doc.text("No contracts reached finalized closing stage during this reporting window.", leftMargin + 8, currentY);
          currentY += 16;
        } else {
          for (const deal of data.wonDeals) {
            checkPageBreak(18);
            doc.fillColor("#16a34a").fontSize(8).font("Helvetica-Bold");
            doc.text("•  ", leftMargin + 4, currentY, { continued: true });
            doc.fillColor("#0f172a").text(`${deal.title}: `, { continued: true });
            doc.fillColor("#334155").font("Helvetica").text(
              `Contract Value: ETB ${deal.amount.toLocaleString()} | Equipment: ${deal.product} | Representative: ${deal.rep}`
            );
            currentY += 15;
          }
        }
        currentY += 8;

        // --- 5. COMMERCIAL LOSSES & ROOT CAUSE ANALYSIS ---
        renderSectionHeading("2. Commercial Losses & Root Cause Analysis");

        if (data.lostDeals.length === 0) {
          checkPageBreak(18);
          doc.fillColor("#64748b").fontSize(8).font("Helvetica-Oblique");
          doc.text("Zero commercial contract losses recorded during this reporting cycle.", leftMargin + 8, currentY);
          currentY += 16;
        } else {
          for (const deal of data.lostDeals) {
            checkPageBreak(18);
            doc.fillColor("#dc2626").fontSize(8).font("Helvetica-Bold");
            doc.text("•  ", leftMargin + 4, currentY, { continued: true });
            doc.fillColor("#0f172a").text(`${deal.title}: `, { continued: true });
            doc.fillColor("#334155").font("Helvetica").text(
              `Documented Reason: "${deal.reason}" | Representative: ${deal.rep}`
            );
            currentY += 15;
          }
        }
        currentY += 8;

        // --- 6. REPRESENTATIVE PERFORMANCE MATRIX ---
        renderSectionHeading("3. Representative Performance Matrix");

        if (data.repPerformance.length === 0) {
          checkPageBreak(18);
          doc.fillColor("#64748b").fontSize(8).font("Helvetica-Oblique");
          doc.text("No representative performance profiles available.", leftMargin + 8, currentY);
          currentY += 16;
        } else {
          for (const rep of data.repPerformance) {
            checkPageBreak(24);
            // Rep Summary Header Line
            doc.save();
            doc.rect(leftMargin, currentY - 2, contentWidth, 16).fill("#f1f5f9");
            doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica-Bold");
            doc.text(`${rep.repName} (${rep.role}):`, leftMargin + 6, currentY + 1, { continued: true });
            doc.fillColor("#334155").font("Helvetica").text(
              `  Won: ${rep.wonCount} (ETB ${rep.wonRevenue.toLocaleString()}) | Lost: ${rep.lostCount} | Pipeline: ${rep.pipelineCount} deals | Consultations: ${rep.logsCount}`
            );
            doc.restore();
            currentY += 18;

            // Indented Detail Sub-bullets
            for (const w of rep.wonDeals) {
              checkPageBreak(14);
              doc.fillColor("#16a34a").fontSize(7.5).font("Helvetica-Bold");
              doc.text("   – Won: ", leftMargin + 12, currentY, { continued: true });
              doc.fillColor("#0f172a").font("Helvetica-Bold").text(`${w.title}`, { continued: true });
              doc.fillColor("#475569").font("Helvetica").text(
                ` — ETB ${w.amount.toLocaleString()} | ${w.product}`
              );
              currentY += 13;
            }

            for (const l of rep.lostDeals) {
              checkPageBreak(14);
              doc.fillColor("#dc2626").fontSize(7.5).font("Helvetica-Bold");
              doc.text("   – Lost: ", leftMargin + 12, currentY, { continued: true });
              doc.fillColor("#0f172a").font("Helvetica-Bold").text(`${l.title}`, { continued: true });
              doc.fillColor("#475569").font("Helvetica").text(` — Reason: "${l.reason}"`);
              currentY += 13;
            }

            for (const p of rep.pipelineDeals) {
              checkPageBreak(14);
              doc.fillColor("#7c3aed").fontSize(7.5).font("Helvetica-Bold");
              doc.text("   – Pipeline: ", leftMargin + 12, currentY, { continued: true });
              doc.fillColor("#0f172a").font("Helvetica-Bold").text(`${p.title}`, { continued: true });
              doc.fillColor("#475569").font("Helvetica").text(
                ` — Stage: ${p.stage}${p.amount ? ` (Est. ETB ${p.amount.toLocaleString()})` : ""}`
              );
              currentY += 13;
            }

            if (rep.logsCount > 0) {
              checkPageBreak(14);
              const comps = rep.consultedCompanies.length > 0 ? ` (${rep.consultedCompanies.join(", ")})` : "";
              doc.fillColor("#0284c7").fontSize(7.5).font("Helvetica-Bold");
              doc.text("   – Consultations: ", leftMargin + 12, currentY, { continued: true });
              doc.fillColor("#475569").font("Helvetica").text(
                `${rep.logsCount} client interaction${rep.logsCount === 1 ? "" : "s"} logged${comps}`
              );
              currentY += 13;
            }

            currentY += 4;
          }
        }
        currentY += 8;

        // --- 7. ACTIVE PIPELINE & UPCOMING CYCLE PRIORITIES ---
        renderSectionHeading("4. Active Pipeline & Commercial Priorities");

        if (data.pipelineDeals.length === 0) {
          checkPageBreak(18);
          doc.fillColor("#64748b").fontSize(8).font("Helvetica-Oblique");
          doc.text("All active deals have transitioned out of negotiation stage.", leftMargin + 8, currentY);
          currentY += 16;
        } else {
          for (const deal of data.pipelineDeals.slice(0, 8)) {
            checkPageBreak(18);
            doc.fillColor("#7c3aed").fontSize(8).font("Helvetica-Bold");
            doc.text("•  ", leftMargin + 4, currentY, { continued: true });
            doc.fillColor("#0f172a").text(`${deal.title}: `, { continued: true });
            doc.fillColor("#334155").font("Helvetica").text(
              `Current Stage: ${deal.stage}${
                deal.amount ? ` | Estimated Value: ETB ${deal.amount.toLocaleString()}` : ""
              } | Lead Representative: ${deal.rep}`
            );
            currentY += 15;
          }
        }

        // --- PAGE NUMBERING & DOCUMENT FOOTER (ON ALL PAGES) ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.save();
          // Footer line
          doc.moveTo(leftMargin, 800).lineTo(leftMargin + contentWidth, 800).lineWidth(0.5).stroke("#e2e8f0");
          doc.fillColor("#94a3b8").fontSize(7).font("Helvetica");
          doc.text(
            "YC Electric Equipment Manufacturing PLC — Relational CRM Datastore Audit — Confidential",
            leftMargin,
            806
          );
          doc.text(`Page ${i + 1} of ${range.count}`, leftMargin, 806, {
            width: contentWidth,
            align: "right",
          });
          doc.restore();
        }

        doc.end();
      } catch (err: any) {
        reject(err);
      }
    });
  }
}
