import autoTable from "jspdf-autotable";
import type { GpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";
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

export function generateGpPayrollRegisterPDF(
  table: GpPayrollRegisterTable,
  opts?: { logoDataUrl?: string | null }
) {
  const auditLayout = table.headers[0] === "Employee Name";
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
      row.map((cell, i) =>
        typeof cell === "number" && i >= firstNumeric
          ? fmtMoney(cell)
          : String(cell ?? "")
      )
    ),
    table.totalsRow.map((cell, i) =>
      typeof cell === "number" && i >= firstNumeric
        ? fmtMoney(cell)
        : String(cell ?? "")
    ),
  ];

  const numericStyles: Record<number, { halign: "right" }> = {};
  for (let i = firstNumeric; i < table.headers.length; i++) {
    numericStyles[i] = { halign: "right" };
  }

  autoTable(doc, {
    startY: contentTop,
    head: [table.headers],
    body,
    styles: {
      fontSize: auditLayout ? 5 : 7,
      cellPadding: auditLayout ? 0.6 : 1.5,
    },
    headStyles: { fillColor: GP_REPORT_GREEN, textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: auditLayout
        ? { halign: "left", cellWidth: 28 }
        : { halign: "center", cellWidth: 8 },
      ...numericStyles,
    },
    didParseCell(data) {
      if (data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  stampGpReportFooter(doc);
  return doc;
}
