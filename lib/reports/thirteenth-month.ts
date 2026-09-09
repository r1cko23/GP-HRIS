/**
 * 13th-month accrual from posted register basic pay (MAIN thirteenmonth grain, compute only).
 * Accrual = basic / 12 per cutoff; YTD = sum of accruals in the Client year window.
 */

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Accrue 1/12 of basic for one posted cutoff line. */
export function thirteenthMonthAccrual(basicPay: unknown): number {
  const basic = n(basicPay);
  if (basic <= 0) return 0;
  return round2(basic / 12);
}

export type ThirteenthMonthLine = {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  directory_employee_id?: string | null;
  basic_pay?: number | null;
  accrual?: number | null;
  period_start?: string | null;
  period_end?: string | null;
};

export type ThirteenthMonthYtdRow = {
  directory_employee_id: string | null;
  employee_code: string;
  last_name: string;
  first_name: string;
  cutoff_count: number;
  ytd_basic: number;
  ytd_accrual: number;
};

/** Roll posted cutoff accruals into per-person YTD. */
export function rollThirteenthMonthYtd(
  lines: ThirteenthMonthLine[]
): ThirteenthMonthYtdRow[] {
  const byKey = new Map<string, ThirteenthMonthYtdRow>();
  for (const line of lines) {
    const dirId = text(line.directory_employee_id) || null;
    const code = text(line.employee_code);
    const key = dirId || `code:${code}` || `name:${text(line.last_name)}:${text(line.first_name)}`;
    if (!key || key === "code:" || key.startsWith("name::")) continue;
    const basic = n(line.basic_pay);
    const accrual =
      line.accrual != null && Number.isFinite(Number(line.accrual))
        ? n(line.accrual)
        : thirteenthMonthAccrual(basic);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        directory_employee_id: dirId,
        employee_code: code,
        last_name: text(line.last_name),
        first_name: text(line.first_name),
        cutoff_count: 1,
        ytd_basic: round2(basic),
        ytd_accrual: round2(accrual),
      });
      continue;
    }
    existing.cutoff_count += 1;
    existing.ytd_basic = round2(existing.ytd_basic + basic);
    existing.ytd_accrual = round2(existing.ytd_accrual + accrual);
    if (!existing.employee_code && code) existing.employee_code = code;
    if (!existing.last_name) existing.last_name = text(line.last_name);
    if (!existing.first_name) existing.first_name = text(line.first_name);
  }
  return [...byKey.values()].sort((a, b) =>
    a.last_name.localeCompare(b.last_name) ||
    a.first_name.localeCompare(b.first_name)
  );
}

export const THIRTEENTH_MONTH_HEADERS = [
  "Employee code",
  "Last name",
  "First name",
  "Cutoff count",
  "YTD basic",
  "YTD 13th month accrual",
] as const;

export function thirteenthMonthRowValues(row: ThirteenthMonthYtdRow): unknown[] {
  return [
    row.employee_code,
    row.last_name,
    row.first_name,
    row.cutoff_count,
    row.ytd_basic,
    row.ytd_accrual,
  ];
}
