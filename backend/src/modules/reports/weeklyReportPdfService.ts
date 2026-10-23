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
   * Cleans names to remove any accidental embedded phone numbers or linebreaks.
   */
  private static cleanName(val: string | undefined | null): string {
    if (!val) return "";
    return val.split("\n")[0].trim();
  }

  /**
   * Generates a pixel-perfect, clean, executive Weekly Sales Performance Report PDF
   * matching YC Electric Equipment Manufacturing PLC institutional standards.
   */
  public static async generateReportPdf(data: WeeklyReportPdfData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 36, // 0.5 in margins (width: 595.28, height: 841.89)
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
          doc.image(logoPath, leftMargin, headerTop, { width: 110 });
        } else {
          // Fallback vector logo
          doc.save();
          doc.rect(leftMargin, headerTop, 110, 36).fillAndStroke("#cf1515", "#b01010");
          doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
          doc.text("YUCHAI POWER", leftMargin + 6, headerTop + 8, { width: 98, align: "center" });
          doc.fontSize(6).font("Helvetica");
          doc.text("MARINE & GENSET POWER", leftMargin + 4, headerTop + 22, { width: 102, align: "center" });
          doc.restore();
        }

        // Corporate Letterhead Details
        const textLeft = leftMargin + 124;
        doc.fillColor("#0f172a").fontSize(11.5).font("Helvetica-Bold");
        doc.text("YC Electric Equipment Manufacturing PLC.", textLeft, headerTop);

        doc.fillColor("#0284c7").fontSize(8.5).font("Helvetica-Bold");
        doc.text("YUCHAI MARINE & GENSET POWER", textLeft, headerTop + 15);

        doc.fillColor("#475569").fontSize(7.5).font("Helvetica");
        doc.text(
          "Add: Nifas Silk Lafto, Addis Ababa, Ethiopia  |  Email: Ycelectric24@gmail.com",
          textLeft,
          headerTop + 27
        );
        doc.text(
          "Tel: +251 900 640 028 / +251 929 296 636  |  Commercial Operations Division",
          textLeft,
          headerTop + 37
        );

        // Header Divider
        const dividerY = headerTop + 50;
        doc.save();
        doc.moveTo(leftMargin, dividerY).lineTo(leftMargin + contentWidth, dividerY).lineWidth(0.8).stroke("#e2e8f0");
        doc.restore();

        // --- 2. REPORT TITLE & AUDIT METADATA CARD ---
        const metaTop = dividerY + 8;
        const metaHeight = 38;
        doc.save();
        doc.rect(leftMargin, metaTop, contentWidth, metaHeight).fill("#f8fafc");
        doc.rect(leftMargin, metaTop, contentWidth, metaHeight).lineWidth(0.8).stroke("#e2e8f0");

        // Row 1: Document Title (Left) and Audit Badge (Right)
        doc.fillColor("#0f172a").fontSize(9.5).font("Helvetica-Bold");
        doc.text("WEEKLY EXECUTIVE SALES PERFORMANCE REPORT", leftMargin + 10, metaTop + 7);

        doc.fillColor("#0284c7").fontSize(7.5).font("Helvetica-Bold");
        doc.text("CLASSIFICATION: EXECUTIVE AUDIT", leftMargin + 10, metaTop + 8, {
          width: contentWidth - 20,
          align: "right",
        });

        // Row 2: Reporting Period (Left) and Publication Date (Right)
        doc.fillColor("#64748b").fontSize(7.5).font("Helvetica");
        doc.text(`Reporting Period: ${data.periodString}`, leftMargin + 10, metaTop + 22);
        doc.text(`Publication Date: ${data.publicationDate}`, leftMargin + 10, metaTop + 22, {
          width: contentWidth - 20,
          align: "right",
        });
        doc.restore();

        // --- 3. EXECUTIVE KPI CARDS (4 COLUMNS) ---
        const kpiTop = metaTop + metaHeight + 8;
        const cardWidth = (contentWidth - 18) / 4; // 4 cards with 6px gap
        const cardHeight = 42;

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

          doc.fillColor("#64748b").fontSize(6.5).font("Helvetica-Bold");
          doc.text(kpi.label.toUpperCase(), cardX + 8, kpiTop + 7, { width: cardWidth - 16 });

          doc.fillColor(kpi.color).fontSize(9.5).font("Helvetica-Bold");
          doc.text(kpi.value, cardX + 8, kpiTop + 21, { width: cardWidth - 16, ellipsis: true });
          doc.restore();
        });

        let currentY = kpiTop + cardHeight + 12;

        const checkPageBreak = (neededHeight: number) => {
          if (currentY + neededHeight > 780) {
            doc.addPage();
            currentY = 36;
          }
        };

        const renderSectionHeading = (title: string, badgeText?: string) => {
          checkPageBreak(28);
          doc.save();
          doc.rect(leftMargin, currentY, 3, 13).fill("#0056b3");
          doc.fillColor("#0f172a").fontSize(9.5).font("Helvetica-Bold");
          doc.text(title, leftMargin + 8, currentY + 1);

          if (badgeText) {
            doc.fillColor("#64748b").fontSize(7.5).font("Helvetica");
            doc.text(badgeText, leftMargin + 8, currentY + 2, {
              width: contentWidth - 12,
              align: "right",
            });
          }
          doc.restore();
          currentY += 18;
        };

        // --- 4. EXECUTED CONTRACTS & CLOSED REVENUE ---
        renderSectionHeading(
          "1. Executed Contracts & Closed Revenue",
          `${data.wonDeals.length} Deal${data.wonDeals.length === 1 ? "" : "s"}`
        );

        if (data.wonDeals.length === 0) {
          checkPageBreak(22);
          doc.save();
          doc.rect(leftMargin, currentY, contentWidth, 20).fill("#f8fafc");
          doc.rect(leftMargin, currentY, contentWidth, 20).lineWidth(0.5).stroke("#e2e8f0");
          doc.fillColor("#64748b").fontSize(7.5).font("Helvetica-Oblique");
          doc.text("No contracts reached finalized closing stage during this reporting window.", leftMargin + 10, currentY + 6);
          doc.restore();
          currentY += 26;
        } else {
          // Clean Executive Table
          const colContract = 175;
          const colProduct = 135;
          const colRep = 110;
          const colAmount = contentWidth - (colContract + colProduct + colRep); // 103.28

          // Table Header
          checkPageBreak(38);
          doc.save();
          doc.rect(leftMargin, currentY, contentWidth, 16).fill("#f1f5f9");
          doc.rect(leftMargin, currentY, contentWidth, 16).lineWidth(0.5).stroke("#cbd5e1");
          doc.fillColor("#475569").fontSize(6.5).font("Helvetica-Bold");
          doc.text("CONTRACT / OPPORTUNITY", leftMargin + 8, currentY + 4.5);
          doc.text("EQUIPMENT / PRODUCT", leftMargin + colContract + 4, currentY + 4.5);
          doc.text("REPRESENTATIVE", leftMargin + colContract + colProduct + 4, currentY + 4.5);
          doc.text("CONTRACT VALUE", leftMargin + colContract + colProduct + colRep, currentY + 4.5, {
            width: colAmount - 8,
            align: "right",
          });
          doc.restore();
          currentY += 16;

          data.wonDeals.forEach((deal, idx) => {
            checkPageBreak(18);
            const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
            doc.save();
            doc.rect(leftMargin, currentY, contentWidth, 18).fill(rowBg);
            doc.moveTo(leftMargin, currentY + 18).lineTo(leftMargin + contentWidth, currentY + 18).lineWidth(0.5).stroke("#f1f5f9");

            doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica-Bold");
            doc.text(deal.title, leftMargin + 8, currentY + 5, { width: colContract - 12, ellipsis: true });

            doc.fillColor("#475569").fontSize(7.5).font("Helvetica");
            doc.text(deal.product || "Standard Supply", leftMargin + colContract + 4, currentY + 5, {
              width: colProduct - 8,
              ellipsis: true,
            });

            doc.fillColor("#334155").fontSize(7.5).font("Helvetica");
            doc.text(WeeklyReportPdfService.cleanName(deal.rep) || "Unassigned", leftMargin + colContract + colProduct + 4, currentY + 5, {
              width: colRep - 8,
              ellipsis: true,
            });

            doc.fillColor("#16a34a").fontSize(7.5).font("Helvetica-Bold");
            doc.text(`ETB ${deal.amount.toLocaleString()}`, leftMargin + colContract + colProduct + colRep, currentY + 5, {
              width: colAmount - 8,
              align: "right",
            });
            doc.restore();
            currentY += 18;
          });
          currentY += 8;
        }

        // --- 5. COMMERCIAL LOSSES & ROOT CAUSE ANALYSIS ---
        renderSectionHeading(
          "2. Commercial Losses & Root Cause Analysis",
          `${data.lostDeals.length} Lost`
        );

        if (data.lostDeals.length === 0) {
          checkPageBreak(22);
          doc.save();
          doc.rect(leftMargin, currentY, contentWidth, 20).fill("#f0fdf4");
          doc.rect(leftMargin, currentY, contentWidth, 20).lineWidth(0.5).stroke("#bbf7d0");
          doc.fillColor("#16a34a").fontSize(7.5).font("Helvetica-Bold");
          doc.text("✓  Zero commercial contract losses recorded during this reporting cycle.", leftMargin + 10, currentY + 6);
          doc.restore();
          currentY += 26;
        } else {
          const colLostDeal = 180;
          const colReason = 225;
          const colRep = contentWidth - (colLostDeal + colReason); // 118.28

          checkPageBreak(38);
          doc.save();
          doc.rect(leftMargin, currentY, contentWidth, 16).fill("#fef2f2");
          doc.rect(leftMargin, currentY, contentWidth, 16).lineWidth(0.5).stroke("#fecaca");
          doc.fillColor("#991b1b").fontSize(6.5).font("Helvetica-Bold");
          doc.text("DEAL / OPPORTUNITY", leftMargin + 8, currentY + 4.5);
          doc.text("DOCUMENTED ROOT CAUSE", leftMargin + colLostDeal + 4, currentY + 4.5);
          doc.text("REPRESENTATIVE", leftMargin + colLostDeal + colReason, currentY + 4.5, {
            width: colRep - 8,
            align: "right",
          });
          doc.restore();
          currentY += 16;

          data.lostDeals.forEach((deal, idx) => {
            checkPageBreak(18);
            const rowBg = idx % 2 === 0 ? "#ffffff" : "#fff5f5";
            doc.save();
            doc.rect(leftMargin, currentY, contentWidth, 18).fill(rowBg);
            doc.moveTo(leftMargin, currentY + 18).lineTo(leftMargin + contentWidth, currentY + 18).lineWidth(0.5).stroke("#fee2e2");

            doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica-Bold");
            doc.text(deal.title, leftMargin + 8, currentY + 5, { width: colLostDeal - 12, ellipsis: true });

            doc.fillColor("#dc2626").fontSize(7.5).font("Helvetica");
            doc.text(`"${deal.reason}"`, leftMargin + colLostDeal + 4, currentY + 5, {
              width: colReason - 8,
              ellipsis: true,
            });

            doc.fillColor("#475569").fontSize(7.5).font("Helvetica");
            doc.text(WeeklyReportPdfService.cleanName(deal.rep) || "Unassigned", leftMargin + colLostDeal + colReason, currentY + 5, {
              width: colRep - 8,
              align: "right",
              ellipsis: true,
            });
            doc.restore();
            currentY += 18;
          });
          currentY += 8;
        }

        // --- 6. REPRESENTATIVE PERFORMANCE MATRIX ---
        renderSectionHeading(
          "3. Representative Performance Matrix",
          `${data.repPerformance.length} Personnel`
        );

        if (data.repPerformance.length === 0) {
          checkPageBreak(22);
          doc.save();
          doc.rect(leftMargin, currentY, contentWidth, 20).fill("#f8fafc");
          doc.rect(leftMargin, currentY, contentWidth, 20).lineWidth(0.5).stroke("#e2e8f0");
          doc.fillColor("#64748b").fontSize(7.5).font("Helvetica-Oblique");
          doc.text("No representative performance profiles available.", leftMargin + 10, currentY + 6);
          doc.restore();
          currentY += 26;
        } else {
          // True Executive Matrix Table
          const colRep = 150;
          const colRole = 80;
          const colWon = 60;
          const colRevenue = 100;
          const colPipeline = 68;
          const colConsult = contentWidth - (colRep + colRole + colWon + colRevenue + colPipeline); // 65.28

          checkPageBreak(38);
          doc.save();
          doc.rect(leftMargin, currentY, contentWidth, 16).fill("#f1f5f9");
          doc.rect(leftMargin, currentY, contentWidth, 16).lineWidth(0.5).stroke("#cbd5e1");
          doc.fillColor("#475569").fontSize(6.5).font("Helvetica-Bold");
          doc.text("REPRESENTATIVE", leftMargin + 8, currentY + 4.5);
          doc.text("ROLE", leftMargin + colRep + 4, currentY + 4.5);
          doc.text("WON", leftMargin + colRep + colRole, currentY + 4.5, { width: colWon, align: "center" });
          doc.text("CLOSED REVENUE", leftMargin + colRep + colRole + colWon, currentY + 4.5, {
            width: colRevenue - 4,
            align: "right",
          });
          doc.text("PIPELINE", leftMargin + colRep + colRole + colWon + colRevenue, currentY + 4.5, {
            width: colPipeline,
            align: "center",
          });
          doc.text("CONSULT.", leftMargin + colRep + colRole + colWon + colRevenue + colPipeline, currentY + 4.5, {
            width: colConsult - 8,
            align: "right",
          });
          doc.restore();
          currentY += 16;

          data.repPerformance.forEach((rep, idx) => {
            checkPageBreak(18);
            const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
            doc.save();
            doc.rect(leftMargin, currentY, contentWidth, 18).fill(rowBg);
            doc.moveTo(leftMargin, currentY + 18).lineTo(leftMargin + contentWidth, currentY + 18).lineWidth(0.5).stroke("#f1f5f9");

            // Clean rep name without embedded phone numbers
            const repCleanName = WeeklyReportPdfService.cleanName(rep.repName) || "Unassigned";
            doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica-Bold");
            doc.text(repCleanName, leftMargin + 8, currentY + 5, { width: colRep - 12, ellipsis: true });

            doc.fillColor("#64748b").fontSize(7).font("Helvetica");
            doc.text(rep.role || "Sales Rep", leftMargin + colRep + 4, currentY + 5.5, {
              width: colRole - 8,
              ellipsis: true,
            });

            // Won Count
            if (rep.wonCount > 0) {
              doc.fillColor("#16a34a").fontSize(7.5).font("Helvetica-Bold");
              doc.text(`${rep.wonCount}`, leftMargin + colRep + colRole, currentY + 5, {
                width: colWon,
                align: "center",
              });
            } else {
              doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica");
              doc.text("—", leftMargin + colRep + colRole, currentY + 5, { width: colWon, align: "center" });
            }

            // Won Revenue
            if (rep.wonRevenue > 0) {
              doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica-Bold");
              doc.text(`ETB ${rep.wonRevenue.toLocaleString()}`, leftMargin + colRep + colRole + colWon, currentY + 5, {
                width: colRevenue - 4,
                align: "right",
              });
            } else {
              doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica");
              doc.text("—", leftMargin + colRep + colRole + colWon, currentY + 5, {
                width: colRevenue - 4,
                align: "right",
              });
            }

            // Pipeline Deals
            if (rep.pipelineCount > 0) {
              doc.fillColor("#7c3aed").fontSize(7.5).font("Helvetica-Bold");
              doc.text(`${rep.pipelineCount} deal${rep.pipelineCount === 1 ? "" : "s"}`, leftMargin + colRep + colRole + colWon + colRevenue, currentY + 5, {
                width: colPipeline,
                align: "center",
              });
            } else {
              doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica");
              doc.text("—", leftMargin + colRep + colRole + colWon + colRevenue, currentY + 5, {
                width: colPipeline,
                align: "center",
              });
            }

            // Consultations
            if (rep.logsCount > 0) {
              doc.fillColor("#0284c7").fontSize(7.5).font("Helvetica-Bold");
              doc.text(`${rep.logsCount}`, leftMargin + colRep + colRole + colWon + colRevenue + colPipeline, currentY + 5, {
                width: colConsult - 8,
                align: "right",
              });
            } else {
              doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica");
              doc.text("—", leftMargin + colRep + colRole + colWon + colRevenue + colPipeline, currentY + 5, {
                width: colConsult - 8,
                align: "right",
              });
            }

            doc.restore();
            currentY += 18;
          });
          currentY += 8;
        }

        // --- 7. ACTIVE PIPELINE & UPCOMING CYCLE PRIORITIES ---
        renderSectionHeading(
          "4. Active Pipeline & Commercial Priorities",
          `${data.pipelineDeals.length} Active`
        );

        if (data.pipelineDeals.length === 0) {
          checkPageBreak(22);
          doc.save();
          doc.rect(leftMargin, currentY, contentWidth, 20).fill("#f8fafc");
          doc.rect(leftMargin, currentY, contentWidth, 20).lineWidth(0.5).stroke("#e2e8f0");
          doc.fillColor("#64748b").fontSize(7.5).font("Helvetica-Oblique");
          doc.text("All active deals have transitioned out of negotiation stage.", leftMargin + 10, currentY + 6);
          doc.restore();
          currentY += 26;
        } else {
          const colPipeDeal = 185;
          const colPipeStage = 105;
          const colPipeRep = 115;
          const colPipeAmount = contentWidth - (colPipeDeal + colPipeStage + colPipeRep); // 118.28

          checkPageBreak(38);
          doc.save();
          doc.rect(leftMargin, currentY, contentWidth, 16).fill("#faf5ff");
          doc.rect(leftMargin, currentY, contentWidth, 16).lineWidth(0.5).stroke("#e9d5ff");
          doc.fillColor("#6d28d9").fontSize(6.5).font("Helvetica-Bold");
          doc.text("OPPORTUNITY / CLIENT", leftMargin + 8, currentY + 4.5);
          doc.text("STAGE", leftMargin + colPipeDeal + 4, currentY + 4.5);
          doc.text("LEAD REPRESENTATIVE", leftMargin + colPipeDeal + colPipeStage + 4, currentY + 4.5);
          doc.text("ESTIMATED VALUE", leftMargin + colPipeDeal + colPipeStage + colPipeRep, currentY + 4.5, {
            width: colPipeAmount - 8,
            align: "right",
          });
          doc.restore();
          currentY += 16;

          data.pipelineDeals.slice(0, 8).forEach((deal, idx) => {
            checkPageBreak(18);
            const rowBg = idx % 2 === 0 ? "#ffffff" : "#faf5ff";
            doc.save();
            doc.rect(leftMargin, currentY, contentWidth, 18).fill(rowBg);
            doc.moveTo(leftMargin, currentY + 18).lineTo(leftMargin + contentWidth, currentY + 18).lineWidth(0.5).stroke("#f3e8ff");

            doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica-Bold");
            doc.text(deal.title, leftMargin + 8, currentY + 5, { width: colPipeDeal - 12, ellipsis: true });

            doc.fillColor("#7c3aed").fontSize(7.5).font("Helvetica-Bold");
            doc.text(deal.stage || "In Negotiation", leftMargin + colPipeDeal + 4, currentY + 5, {
              width: colPipeStage - 8,
              ellipsis: true,
            });

            doc.fillColor("#475569").fontSize(7.5).font("Helvetica");
            doc.text(WeeklyReportPdfService.cleanName(deal.rep) || "Unassigned", leftMargin + colPipeDeal + colPipeStage + 4, currentY + 5, {
              width: colPipeRep - 8,
              ellipsis: true,
            });

            doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica-Bold");
            const amtText = deal.amount ? `ETB ${deal.amount.toLocaleString()}` : "Unspecified";
            doc.text(amtText, leftMargin + colPipeDeal + colPipeStage + colPipeRep, currentY + 5, {
              width: colPipeAmount - 8,
              align: "right",
            });
            doc.restore();
            currentY += 18;
          });
        }

        // --- PAGE NUMBERING & DOCUMENT FOOTER (ON ALL PAGES) ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          // Temporarily zero bottom margin to prevent PDFKit from auto-creating spurious pages
          const oldBottomMargin = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;

          doc.save();
          // Footer line
          doc.moveTo(leftMargin, 808).lineTo(leftMargin + contentWidth, 808).lineWidth(0.5).stroke("#cbd5e1");
          doc.fillColor("#94a3b8").fontSize(7).font("Helvetica");
          doc.text(
            "YC Electric Equipment Manufacturing PLC — Relational CRM Datastore Audit — Confidential",
            leftMargin,
            813,
            { lineBreak: false }
          );
          doc.text(`Page ${i + 1} of ${range.count}`, leftMargin, 813, {
            width: contentWidth,
            align: "right",
            lineBreak: false,
          });
          doc.restore();

          doc.page.margins.bottom = oldBottomMargin;
        }

        doc.end();
      } catch (err: any) {
        reject(err);
      }
    });
  }
}
