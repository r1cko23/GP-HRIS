import autoTable from "jspdf-autotable";
import type { GpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";
import { PAYROLL_REGISTER_HOUR_COLUMN_INDEXES } from "@/lib/payroll-summary/register-columns";
import {
  GP_REPORT_GREEN,
  createGpLandscapeReport,
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

export function generateGpPayrollRegisterPDF(
  table: GpPayrollRegisterTable,
  opts?: { logoDataUrl?: string | null }
) {
  const auditLayout = table.headers[0] === "Employee" || table.headers[0] === "Employee Name";
  const firstNumeric = auditLayout ? 1 : 4;
  const { doc, contentTop } = createGpLandscapeReport({
    title: table.title,
    subtitle: table.subtitle,
    format: auditLayout ? "legal" : "a4",
    margin: auditLayout ? 8 : 14,
    logoDataUrl: opts?.logoDataUrl,
  });

  const body = [
    ...table.rows.map((row) =>
      row.map((cell, i) => formatCell(cell, i, firstNumeric))
    ),
    table.totalsRow.map((cell, i) => formatCell(cell, i, firstNumeric)),
  ];

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = auditLayout ? 8 : 14;
  const usableWidth = pageWidth - margin * 2;
  const rawWidths = table.columnWidths ?? [];
  const widthSum = rawWidths.reduce((sum, w) => sum + (Number(w) || 0), 0);
  const scale =
    auditLayout && widthSum > 0 ? Math.min(1, usableWidth / widthSum) : 1;

  const columnStyles: Record<
    number,
    { halign?: "left" | "right" | "center"; cellWidth?: number; fontStyle?: "bold" }
  > = {};
  for (let i = 0; i < table.headers.length; i++) {
    const width = rawWidths[i];
    const scaled =
      typeof width === "number" && width > 0 ? Math.max(6, width * scale) : undefined;
    columnStyles[i] = {
      halign: i < firstNumeric ? "left" : "right",
      ...(scaled != null ? { cellWidth: scaled } : {}),
    };
  }
  if (auditLayout) {
    columnStyles[0] = {
      ...columnStyles[0],
      halign: "left",
      cellWidth: Math.max(24, (rawWidths[0] ?? 32) * scale),
      fontStyle: "bold",
    };
  } else {
    columnStyles[0] = {
      ...columnStyles[0],
      halign: "center",
      cellWidth: 8,
    };
  }

  autoTable(doc, {
    startY: contentTop,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    tableWidth: usableWidth,
    head: [table.headers],
    body,
    styles: {
      fontSize: auditLayout ? 6 : 7,
      cellPadding: auditLayout ? 1.1 : 1.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      textColor: [30, 30, 30],
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: GP_REPORT_GREEN,
      textColor: 255,
      fontStyle: "bold",
      fontSize: auditLayout ? 5.5 : 7,
      cellPadding: auditLayout ? 1.2 : 1.5,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    columnStyles,
    didParseCell(data) {
      if (data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [232, 245, 233];
        data.cell.styles.textColor = [20, 20, 20];
      }
    },
  });

  stampGpReportFooter(doc);
  return doc;
}
