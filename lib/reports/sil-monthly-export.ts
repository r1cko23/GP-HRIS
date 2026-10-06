/**
 * SIL monthly run Excel — hotel computation layout.
 */

import XLSX from "xlsx-js-style";
import {
  MONTH_NAMES,
  silMonthTitle,
  type SilMonthlyRow,
} from "./sil-monthly-run";
import type { SilPayMethod } from "./sil-pay-method";

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export const SIL_MONTHLY_HEADERS = [
  "No.",
  "Last Name",
  "First Name",
  "Date Hired",
  "Employment Status",
  "Rate",
  "# Days Worked ",
  "Months",
  "Computation",
  "Days Entitlement",
  "Amount",
  "Remarks",
] as const;

export function silMonthlyRowValues(
  row: SilMonthlyRow,
  index: number
): unknown[] {
  return [
    index + 1,
    text(row.last_name).toUpperCase(),
    text(row.first_name).toUpperCase(),
    text(row.hire_date).slice(0, 10),
    text(row.employment_status),
    row.daily_rate || "",
    row.days_worked || "",
    row.months || "",
    row.computation || "",
    row.days_entitlement || "",
    row.amount || "",
    text(row.remarks),
  ];
}

export function silMonthlyHeaders(payMethod?: SilPayMethod | null): string[] {
  if (payMethod !== "full_313_anniversary") return [...SIL_MONTHLY_HEADERS];
  return SIL_MONTHLY_HEADERS.map((header) =>
    header === "Months" ? "Days / 313" : header
  );
}

export function buildSilMonthlyWorkbook(
  rows: SilMonthlyRow[],
  meta: {
    year: number;
    month: number;
    client_name?: string;
    pay_method?: SilPayMethod | null;
  }
): Buffer {
  const title = silMonthTitle(meta.year, meta.month);
  const client = text(meta.client_name);
  const aoa: unknown[][] = [
    [title],
    [client],
    [],
    silMonthlyHeaders(meta.pay_method),
    ...rows.map((r, i) => silMonthlyRowValues(r, i)),
  ];
  if (rows.length) {
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    aoa.push([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      Math.round(total * 100) / 100,
      "",
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const headers = silMonthlyHeaders(meta.pay_method);
  ws["!cols"] = headers.map((h) => ({
    wch: Math.max(12, h.length + 2),
  }));
  XLSX.utils.book_append_sheet(wb, ws, "SIL");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function silMonthlyFilename(
  year: number,
  month: number,
  clientLabel?: string
): string {
  const name = MONTH_NAMES[month - 1] ?? String(month);
  const label = text(clientLabel).replace(/\s+/g, "-") || "all";
  return `SIL-${name}-${year}-${label}.xlsx`;
}
