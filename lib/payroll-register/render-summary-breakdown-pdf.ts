/**
 * Render grouped payroll summary totals below the register table on summary PDFs.
 */

import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import {
  GP_REPORT_FOOTER_RESERVE_MM,
  GP_REPORT_GREEN,
  gpReportTableBottomMargin,
} from "@/lib/reports/gp-report-pdf";
import type { CutoffSummaryBreakdown } from "./cutoff-summary-breakdown";

function fmtMoney(n: number) {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function summaryBreakdownPdfGrid(breakdown: CutoffSummaryBreakdown): {
  headers: string[];
  rows: string[][];
} {
  const sections = [
    breakdown.earnings,
    breakdown.deductions,
    breakdown.employeeShare,
    breakdown.employerShare,
    breakdown.accruals13th,
    breakdown.accrualsSil,
  ];
  const maxItems = Math.max(1, ...sections.map((section) => section.items.length));
  const headers = sections.map((section) => section.title);
  const rows: string[][] = [];
  for (let i = 0; i < maxItems; i += 1) {
    rows.push(
      sections.map((section) => {
        const item = section.items[i];
        if (!item) return "";
        return `${item.label}: ${fmtMoney(item.amount)}`;
      })
    );
  }
  return { headers, rows };
}

export function renderSummaryBreakdownOnPdf(input: {
  doc: jsPDF;
  breakdown: CutoffSummaryBreakdown;
  startY: number;
  margin: number;
}): number {
  const { doc, breakdown, margin } = input;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomReserve = GP_REPORT_FOOTER_RESERVE_MM;
  let startY = input.startY + 5;

  if (startY + 28 > pageHeight - bottomReserve) {
    doc.addPage();
    startY = margin + 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text("Summary", margin, startY);
  startY += 4;

  const { headers, rows } = summaryBreakdownPdfGrid(breakdown);
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const colWidth = usableWidth / headers.length;

  autoTable(doc, {
    startY,
    margin: {
      left: margin,
      right: margin,
      top: margin,
      bottom: gpReportTableBottomMargin(margin),
    },
    tableWidth: usableWidth,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      textColor: [40, 40, 40],
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: GP_REPORT_GREEN,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6,
      halign: "left",
      valign: "middle",
    },
    columnStyles: Object.fromEntries(
      headers.map((_, index) => [
        index,
        { cellWidth: colWidth, halign: "left" },
      ])
    ),
  });

  const table = (
    doc as jsPDF & { lastAutoTable?: { finalY: number } }
  ).lastAutoTable;
  return table?.finalY ?? startY;
}
