import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";

function fmtMoney(n: number) {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function generateGpPayrollRegisterPDF(table: GpPayrollRegisterTable) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(table.title, doc.internal.pageSize.getWidth() / 2, 14, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(table.subtitle, doc.internal.pageSize.getWidth() / 2, 21, {
    align: "center",
  });

  const body = [
    ...table.rows.map((row) =>
      row.map((cell, i) =>
        typeof cell === "number" && i >= 4 ? fmtMoney(cell) : String(cell ?? "")
      )
    ),
    table.totalsRow.map((cell, i) =>
      typeof cell === "number" && i >= 4 ? fmtMoney(cell) : String(cell ?? "")
    ),
  ];

  autoTable(doc, {
    startY: 26,
    head: [table.headers],
    body,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [46, 125, 50], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
      11: { halign: "right" },
      12: { halign: "right" },
      13: { halign: "right" },
    },
    didParseCell(data) {
      if (data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  return doc;
}
