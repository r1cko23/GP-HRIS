/**
 * Excel twin of the Organic payroll summary PDF table.
 * Green/white chrome matches GP-Client cutoff / transmittal exports.
 */

import XLSX from "xlsx-js-style";
import type { GpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";
import {
  applyGpTableSheetStyles,
  styleMetaLabelCell,
  styleMetaValueCell,
  styleTitleCell,
} from "./gp-report-sheet-style";

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function buildPayrollSummaryWorkbook(
  table: GpPayrollRegisterTable
): Buffer {
  const headers = table.headers ?? [];
  const rows = table.rows ?? [];
  const totals = table.totalsRow ?? [];
  const aoa: unknown[][] = [
    ["GREEN PASTURE PEOPLE MANAGEMENT INC."],
    [table.title || "Payroll Summary"],
    ["Period", table.subtitle || ""],
    [],
    headers,
    ...rows.map((row) => row.map((cell) => (cell == null ? "" : cell))),
    totals,
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  styleTitleCell(ws["A1"]);
  styleTitleCell(ws["A2"]);
  styleMetaLabelCell(ws["A3"]);
  styleMetaValueCell(ws["B3"]);

  const moneyCols: number[] = [];
  headers.forEach((h, i) => {
    const label = String(h ?? "").toLowerCase();
    if (
      label.includes("pay") ||
      label.includes("amount") ||
      label.includes("gross") ||
      label.includes("net") ||
      label.includes("sss") ||
      label.includes("phil") ||
      label.includes("pag") ||
      label.includes("tax") ||
      label.includes("deduct") ||
      label.includes("earning") ||
      label.includes("ot") ||
      label.includes("rate")
    ) {
      moneyCols.push(i);
    }
  });

  applyGpTableSheetStyles(ws, {
    headerRow: 4,
    dataStartRow: 5,
    dataEndRow: 4 + rows.length,
    totalsRow: totals.length ? 5 + rows.length : undefined,
    colCount: Math.max(headers.length, 1),
    moneyCols,
    textCols: [0, 1],
    colWidths: headers.map((_, i) => (i < 2 ? 22 : 12)),
  });

  XLSX.utils.book_append_sheet(wb, ws, "Payroll Summary");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function payrollSummaryXlsxFilename(
  clientLabel: string,
  periodStart: string,
  periodEnd: string
): string {
  const c = text(clientLabel).replace(/\s+/g, "-") || "Client";
  const a = text(periodStart).slice(0, 10);
  const b = text(periodEnd).slice(0, 10);
  return `Payroll-Summary-${c}-${a}-${b}.xlsx`;
}
