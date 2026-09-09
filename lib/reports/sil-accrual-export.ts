/**
 * SIL leave balance Excel (Service Incentive Leave) — not MAIN AccrualExcel hours import.
 */

import XLSX from "xlsx-js-style";

export type SilAccrualRow = {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  hire_date?: string | null;
  sil_allotted?: number | null;
  sil_days_used?: number | null;
  sil_credits?: number | null;
  sil_balance_year?: number | null;
  sil_last_accrual?: string | null;
  status?: string | null;
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export const SIL_ACCRUAL_HEADERS = [
  "Employee code",
  "Last name",
  "First name",
  "Hire date",
  "Status",
  "Balance year",
  "Allotted",
  "Days used",
  "Credits",
  "Last accrual",
] as const;

export function silAccrualRowValues(row: SilAccrualRow): unknown[] {
  return [
    text(row.employee_code),
    text(row.last_name),
    text(row.first_name),
    text(row.hire_date).slice(0, 10),
    text(row.status),
    n(row.sil_balance_year) || "",
    n(row.sil_allotted),
    n(row.sil_days_used),
    n(row.sil_credits),
    text(row.sil_last_accrual).slice(0, 10),
  ];
}

export function buildSilAccrualSheet(rows: SilAccrualRow[]): {
  headers: string[];
  rows: unknown[][];
} {
  return {
    headers: [...SIL_ACCRUAL_HEADERS],
    rows: rows.map(silAccrualRowValues),
  };
}

export function silAccrualWorkbookBuffer(
  rows: SilAccrualRow[],
  meta?: { year?: number; client_name?: string }
): Buffer {
  const sheet = buildSilAccrualSheet(rows);
  const wb = XLSX.utils.book_new();
  const metaRows: unknown[][] = [
    ["Green Pasture People Management Inc."],
    ["SIL accrual balances"],
    ["Client", text(meta?.client_name)],
    ["Year", meta?.year ?? ""],
    [],
    sheet.headers,
    ...sheet.rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(metaRows);
  ws["!cols"] = sheet.headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, "SIL");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function silAccrualFilename(year: number, clientLabel?: string): string {
  const label = text(clientLabel).replace(/\s+/g, "-") || "all";
  return `SIL-accrual-${year}-${label}.xlsx`;
}
