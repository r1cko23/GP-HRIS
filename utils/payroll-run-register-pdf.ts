import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import type { GpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";
import type { CutoffSummaryBreakdown } from "@/lib/payroll-register/cutoff-summary-breakdown";
import { renderSummaryBreakdownOnPdf } from "@/lib/payroll-register/render-summary-breakdown-pdf";
import { PAYROLL_REGISTER_HOUR_COLUMN_INDEXES } from "@/lib/payroll-summary/register-columns";
import {
  GP_REPORT_GREEN,
  createGpLandscapeReport,
  gpReportTableBottomMargin,
  stampGpReportFooter,
} from "@/lib/reports/gp-report-pdf";

function fmtMoney(n: number) {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtHours(n: number) {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatCell(value: unknown, colIndex: number, firstNumeric: number) {
  if (typeof value !== "number" || colIndex < firstNumeric) {
    return String(value ?? "");
  }
  if (PAYROLL_REGISTER_HOUR_COLUMN_INDEXES.has(colIndex)) {
    return fmtHours(value);
  }
  return fmtMoney(value);
}

function measureText(
  doc: jsPDF,
  text: string,
  fontSize: number,
  fontStyle: "normal" | "bold"
) {
  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(fontSize);
  return doc.getTextWidth(text);
}

/**
 * Size audit-register columns from rendered text so pesos never mid-wrap.
 * Shrinks the name column first, then font size, until the row fits Legal width.
 */
export function fitAuditRegisterPdfColumns(input: {
  doc: jsPDF;
  headers: string[];
  body: string[][];
  usableWidth: number;
  firstNumeric: number;
}): {
  widths: number[];
  fontSize: number;
  headFontSize: number;
  cellPadding: number;
} {
  const { doc, headers, body, usableWidth, firstNumeric } = input;
  const fontCandidates = [5.5, 5, 4.5, 4];

  for (const fontSize of fontCandidates) {
    const cellPadding = fontSize <= 4.5 ? 0.4 : 0.55;
    const headFontSize = Math.max(3.8, fontSize - 0.4);
    const slack = 0.4;
    const widths = headers.map((header, i) => {
      let max = measureText(doc, header, headFontSize, "bold");
      for (const row of body) {
        const cell = String(row[i] ?? "");
        const bold = i === 0 || String(row[0] ?? "") === "TOTAL";
        max = Math.max(
          max,
          measureText(doc, cell, fontSize, bold ? "bold" : "normal")
        );
      }
      return max + cellPadding * 2 + slack;
    });

    let sum = widths.reduce((a, b) => a + b, 0);
    if (sum > usableWidth) {
      const nameMin =
        measureText(doc, headers[0] ?? "Employee", headFontSize, "bold") +
        cellPadding * 2 +
        slack;
      const nameFloor = Math.max(nameMin, 14);
      const canShrink = Math.max(0, (widths[0] ?? 0) - nameFloor);
      const take = Math.min(sum - usableWidth, canShrink);
      widths[0] = (widths[0] ?? 0) - take;
      sum -= take;
    }

    // Never shrink money/hour columns below their content width.
    if (sum <= usableWidth + 0.05) {
      const leftover = usableWidth - sum;
      if (leftover > 0) {
        widths[0] = (widths[0] ?? 0) + leftover;
      }
      return { widths, fontSize, headFontSize, cellPadding };
    }
  }

  // Last resort: keep content mins for numeric cols; compress name to leftover.
  const fontSize = 4;
  const cellPadding = 0.35;
  const headFontSize = 3.6;
  const slack = 0.3;
  const widths = headers.map((header, i) => {
    let max = measureText(doc, header, headFontSize, "bold");
    for (const row of body) {
      const cell = String(row[i] ?? "");
      const bold = i === 0 || String(row[0] ?? "") === "TOTAL";
      max = Math.max(
        max,
        measureText(doc, cell, fontSize, bold ? "bold" : "normal")
      );
    }
    return max + cellPadding * 2 + slack;
  });
  const numericSum = widths
    .slice(firstNumeric)
    .reduce((a, b) => a + b, 0);
  widths[0] = Math.max(12, usableWidth - numericSum);
  // If still over, scale only name+hour cols proportionally while locking money.
  let sum = widths.reduce((a, b) => a + b, 0);
  if (sum > usableWidth) {
    const moneyIdx = [...widths.keys()].filter(
      (i) => i >= firstNumeric && !PAYROLL_REGISTER_HOUR_COLUMN_INDEXES.has(i)
    );
    const moneySum = moneyIdx.reduce((a, i) => a + (widths[i] ?? 0), 0);
    const flexIdx = [...widths.keys()].filter((i) => !moneyIdx.includes(i));
    const flexBudget = Math.max(usableWidth - moneySum, flexIdx.length * 4);
    const flexSum = flexIdx.reduce((a, i) => a + (widths[i] ?? 0), 0) || 1;
    for (const i of flexIdx) {
      widths[i] = ((widths[i] ?? 0) / flexSum) * flexBudget;
    }
  }

  return { widths, fontSize, headFontSize, cellPadding };
}

export function generateGpPayrollRegisterPDF(
  table: GpPayrollRegisterTable,
  opts?: {
    logoDataUrl?: string | null;
    summaryBreakdown?: CutoffSummaryBreakdown | null;
  }
) {
  const auditLayout =
    table.headers[0] === "Employee" || table.headers[0] === "Employee Name";
  const firstNumeric = auditLayout ? 1 : 4;
  const { doc, contentTop } = createGpLandscapeReport({
    title: table.title,
    subtitle: table.subtitle,
    format: auditLayout ? "legal" : "a4",
    margin: auditLayout ? 6 : 14,
    logoDataUrl: opts?.logoDataUrl,
  });

  const body = [
    ...table.rows.map((row) =>
      row.map((cell, i) => formatCell(cell, i, firstNumeric))
    ),
    table.totalsRow.map((cell, i) => formatCell(cell, i, firstNumeric)),
  ];

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = auditLayout ? 6 : 14;
  const usableWidth = pageWidth - margin * 2;

  let fontSize = auditLayout ? 6 : 7;
  let headFontSize = auditLayout ? 5.5 : 7;
  let cellPadding = auditLayout ? 1.1 : 1.5;
  const columnStyles: Record<
    number,
    {
      halign?: "left" | "right" | "center";
      cellWidth?: number;
      fontStyle?: "bold";
      overflow?: "linebreak" | "ellipsize" | "visible" | "hidden";
    }
  > = {};

  if (auditLayout) {
    const fitted = fitAuditRegisterPdfColumns({
      doc,
      headers: table.headers,
      body,
      usableWidth,
      firstNumeric,
    });
    fontSize = fitted.fontSize;
    headFontSize = fitted.headFontSize;
    cellPadding = fitted.cellPadding;
    for (let i = 0; i < table.headers.length; i++) {
      columnStyles[i] = {
        halign: i < firstNumeric ? "left" : "right",
        cellWidth: fitted.widths[i],
        // Name may ellipsize; amounts stay one line via content-fit widths.
        overflow: i === 0 ? "ellipsize" : "hidden",
      };
    }
    columnStyles[0] = {
      ...columnStyles[0],
      halign: "left",
      fontStyle: "bold",
    };
  } else {
    const rawWidths = table.columnWidths ?? [];
    const widthSum = rawWidths.reduce((sum, w) => sum + (Number(w) || 0), 0);
    const scale = widthSum > 0 ? Math.min(1, usableWidth / widthSum) : 1;
    for (let i = 0; i < table.headers.length; i++) {
      const width = rawWidths[i];
      const scaled =
        typeof width === "number" && width > 0
          ? Math.max(6, width * scale)
          : undefined;
      columnStyles[i] = {
        halign: i < firstNumeric ? "left" : "right",
        ...(scaled != null ? { cellWidth: scaled } : {}),
      };
    }
    columnStyles[0] = {
      ...columnStyles[0],
      halign: "center",
      cellWidth: 8,
    };
  }

  autoTable(doc, {
    startY: contentTop,
    margin: {
      left: margin,
      right: margin,
      top: margin,
      bottom: gpReportTableBottomMargin(margin),
    },
    tableWidth: usableWidth,
    head: [table.headers],
    body,
    styles: {
      fontSize,
      cellPadding,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      textColor: [30, 30, 30],
      overflow: auditLayout ? "hidden" : "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: GP_REPORT_GREEN,
      textColor: 255,
      fontStyle: "bold",
      fontSize: headFontSize,
      cellPadding,
      halign: "center",
      valign: "middle",
      overflow: auditLayout ? "hidden" : "linebreak",
    },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    columnStyles,
    didParseCell(data) {
      if (data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [232, 245, 233];
        data.cell.styles.textColor = [20, 20, 20];
      }
      if (auditLayout && data.column.index >= firstNumeric) {
        // Never linebreak mid-amount; widths are content-fitted above.
        data.cell.styles.overflow = "visible";
      }
    },
  });

  const registerTable = (
    doc as import("jspdf").jsPDF & { lastAutoTable?: { finalY: number } }
  ).lastAutoTable;
  if (opts?.summaryBreakdown) {
    renderSummaryBreakdownOnPdf({
      doc,
      breakdown: opts.summaryBreakdown,
      startY: registerTable?.finalY ?? contentTop,
      margin,
    });
  }

  stampGpReportFooter(doc, margin);
  return doc;
}
