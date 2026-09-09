/**
 * MAIN-shaped alphalist row from posted register YTD (USP_FORALPHALIST grain).
 * Does not lock alphalisttab; exports a Finance CSV/xlsx for review.
 */

import { thirteenthMonthAccrual } from "./thirteenth-month";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export type AlphalistSourceLine = {
  directory_employee_id?: string | null;
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  tin?: string | null;
  gross_pay?: number | null;
  net_pay?: number | null;
  basic_pay?: number | null;
  deductions?: Record<string, unknown> | null;
  earnings?: Record<string, unknown> | null;
};

export type AlphalistRow = {
  employee_code: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  tin: string;
  gross_taxable: number;
  nontaxable_13th: number;
  sss_ee: number;
  philhealth_ee: number;
  pagibig_ee: number;
  wtax: number;
  net_amount: number;
  cutoff_count: number;
};

export const ALPHALIST_HEADERS = [
  "Employee code",
  "Last name",
  "First name",
  "Middle name",
  "TIN",
  "Gross taxable",
  "Nontaxable 13th",
  "SSS EE",
  "PhilHealth EE",
  "Pag-IBIG EE",
  "WTAX",
  "Net amount",
  "Cutoff count",
] as const;

function deduct(d: Record<string, unknown> | null | undefined, key: string): number {
  return n(d?.[key]);
}

export function rollAlphalistRows(lines: AlphalistSourceLine[]): AlphalistRow[] {
  const byKey = new Map<string, AlphalistRow>();
  for (const line of lines) {
    const dirId = text(line.directory_employee_id);
    const code = text(line.employee_code);
    const key = dirId || `code:${code}`;
    if (!key || key === "code:") continue;
    const basic = n(line.basic_pay ?? line.earnings?.basic);
    const thirteenth =
      n(line.earnings?.thirteenth_month_accrual) ||
      n(line.earnings?.thirteenth_month) ||
      thirteenthMonthAccrual(basic);
    const gross = n(line.gross_pay);
    const sss = deduct(line.deductions, "sss_ee");
    const ph = deduct(line.deductions, "philhealth_ee");
    const pag = deduct(line.deductions, "pagibig_ee");
    const wtax = deduct(line.deductions, "wtax");
    const net = n(line.net_pay);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        employee_code: code,
        last_name: text(line.last_name),
        first_name: text(line.first_name),
        middle_name: text(line.middle_name),
        tin: text(line.tin),
        gross_taxable: round2(gross),
        nontaxable_13th: round2(thirteenth),
        sss_ee: round2(sss),
        philhealth_ee: round2(ph),
        pagibig_ee: round2(pag),
        wtax: round2(wtax),
        net_amount: round2(net),
        cutoff_count: 1,
      });
      continue;
    }
    existing.cutoff_count += 1;
    existing.gross_taxable = round2(existing.gross_taxable + gross);
    existing.nontaxable_13th = round2(existing.nontaxable_13th + thirteenth);
    existing.sss_ee = round2(existing.sss_ee + sss);
    existing.philhealth_ee = round2(existing.philhealth_ee + ph);
    existing.pagibig_ee = round2(existing.pagibig_ee + pag);
    existing.wtax = round2(existing.wtax + wtax);
    existing.net_amount = round2(existing.net_amount + net);
    if (!existing.tin && text(line.tin)) existing.tin = text(line.tin);
    if (!existing.employee_code && code) existing.employee_code = code;
  }
  return [...byKey.values()].sort((a, b) =>
    a.last_name.localeCompare(b.last_name) ||
    a.first_name.localeCompare(b.first_name)
  );
}

export function alphalistRowValues(row: AlphalistRow): unknown[] {
  return [
    row.employee_code,
    row.last_name,
    row.first_name,
    row.middle_name,
    row.tin,
    row.gross_taxable,
    row.nontaxable_13th,
    row.sss_ee,
    row.philhealth_ee,
    row.pagibig_ee,
    row.wtax,
    row.net_amount,
    row.cutoff_count,
  ];
}
