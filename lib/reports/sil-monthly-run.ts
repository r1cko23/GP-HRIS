/**
 * SIL monthly run — monetary entitlement from days worked, paid on hire anniversary.
 * Casual/on-call (hotel sheet):
 *   Months = DaysWorked / 26
 *   Computation = (5/12) * Months
 *   Days Entitlement = round(Computation, 2)
 *   Amount = Rate * Days Entitlement
 * Full 313:
 *   Year fraction = DaysWorked / 313
 *   Amount = round(DaysWorked / 313 × 5 × Rate, 2)
 */

import { SIL_WORKING_DAYS } from "@/lib/reports/sil-cutoff-accrual";
import {
  silFull313Amount,
  silFull313Days,
  type SilPayMethod,
} from "@/lib/reports/sil-pay-method";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function silMonthsFromDays(daysWorked: unknown): number {
  const days = n(daysWorked);
  if (days <= 0) return 0;
  return days / 26;
}

export function silDaysEntitlement(daysWorked: unknown): number {
  const months = silMonthsFromDays(daysWorked);
  if (months <= 0) return 0;
  return round2((5 / 12) * months);
}

export function silAmount(dailyRate: unknown, daysWorked: unknown): number {
  const rate = n(dailyRate);
  const entitlement = silDaysEntitlement(daysWorked);
  if (rate <= 0 || entitlement <= 0) return 0;
  return round2(rate * entitlement);
}

function parseIsoDate(value: string | null | undefined): {
  y: number;
  m: number;
  d: number;
} | null {
  const raw = String(value ?? "").trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Anniversary date in `year`, clamping day for short months (e.g. Feb 29 → 28). */
export function anniversaryDateInYear(
  hireDate: string | null | undefined,
  year: number
): string | null {
  const parsed = parseIsoDate(hireDate);
  if (!parsed || !Number.isFinite(year) || year < 1900) return null;
  const day = Math.min(parsed.d, daysInMonth(year, parsed.m));
  return `${year}-${pad2(parsed.m)}-${pad2(day)}`;
}

export function priorAnniversaryDate(
  hireDate: string | null | undefined,
  year: number
): string | null {
  return anniversaryDateInYear(hireDate, year - 1);
}

export function silMonthlyRunWindow(
  hireDate: string | null | undefined,
  year: number
): { from: string; to: string } | null {
  const from = priorAnniversaryDate(hireDate, year);
  const to = anniversaryDateInYear(hireDate, year);
  if (!from || !to) return null;
  return { from, to };
}

function monthEndIso(year: number, month: number): string {
  return `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`;
}

/**
 * Hire anniversary month matches `month`, and first anniversary
 * (hire + 1 year) is on or before the selected month-end.
 */
export function isEligibleForSilMonthlyRun(
  hireDate: string | null | undefined,
  year: number,
  month: number
): boolean {
  const parsed = parseIsoDate(hireDate);
  if (!parsed) return false;
  if (month < 1 || month > 12) return false;
  if (parsed.m !== month) return false;
  const firstAnniv = anniversaryDateInYear(hireDate, parsed.y + 1);
  if (!firstAnniv) return false;
  return firstAnniv <= monthEndIso(year, month);
}

export function employmentStatusLabel(status: string | null | undefined): string {
  const raw = String(status ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "active") return "Active";
  if (
    raw === "inactive" ||
    raw === "for_release" ||
    raw === "barred"
  ) {
    return "Inactive";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).replaceAll("_", " ");
}

export type SilMonthlySource = {
  directory_employee_id?: string | null;
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  hire_date?: string | null;
  status?: string | null;
  daily_rate?: number | null;
  days_worked?: number | null;
  pay_method?: SilPayMethod | null;
};

export type SilMonthlyRow = {
  directory_employee_id: string | null;
  employee_code: string;
  last_name: string;
  first_name: string;
  hire_date: string;
  employment_status: string;
  status: string;
  daily_rate: number;
  days_worked: number;
  months: number;
  computation: number;
  days_entitlement: number;
  amount: number;
  remarks: string;
};

export function buildSilMonthlyRow(source: SilMonthlySource): SilMonthlyRow {
  const days = Math.max(0, n(source.days_worked));
  const rate = Math.max(0, n(source.daily_rate));
  const full313 = source.pay_method === "full_313_anniversary";
  const months = full313
    ? days > 0
      ? days / SIL_WORKING_DAYS
      : 0
    : silMonthsFromDays(days);
  const computation = full313
    ? silFull313Days(days)
    : months > 0
      ? (5 / 12) * months
      : 0;
  const entitlement = full313
    ? round2(silFull313Days(days))
    : silDaysEntitlement(days);
  const amount = full313
    ? round2(silFull313Amount(rate, days))
    : silAmount(rate, days);
  const status = String(source.status ?? "").trim().toLowerCase();
  return {
    directory_employee_id: source.directory_employee_id ?? null,
    employee_code: String(source.employee_code ?? "").trim(),
    last_name: String(source.last_name ?? "").trim(),
    first_name: String(source.first_name ?? "").trim(),
    hire_date: String(source.hire_date ?? "").trim().slice(0, 10),
    employment_status: employmentStatusLabel(status),
    status,
    daily_rate: rate,
    days_worked: days,
    months,
    computation,
    days_entitlement: entitlement,
    amount,
    remarks: days <= 0 ? "Missing posted days worked" : "",
  };
}

/** Prefer earnings.days_work, then hours.days_work, then hours÷8. */
export function daysWorkedFromRegisterLine(line: {
  earnings?: Record<string, unknown> | null;
  hours?: Record<string, unknown> | null;
}): number {
  const earnings = line.earnings ?? {};
  const hours = line.hours ?? {};
  const fromEarn = n(earnings.days_work);
  if (fromEarn > 0) return round2(fromEarn);
  const fromHoursField = n(hours.days_work);
  if (fromHoursField > 0) return round2(fromHoursField);
  const regular = n(hours.actual_regular_hours);
  const pto = n(hours.pto_hours);
  if (regular > 0 || pto > 0) return round2((regular + pto) / 8);
  return 0;
}

export type DaysWorkedLine = {
  payroll_date?: string | null;
  days_worked?: number | null;
};

export function sumDaysWorkedInWindow(
  lines: DaysWorkedLine[],
  window: { from: string; to: string }
): number {
  let total = 0;
  for (const line of lines) {
    const d = String(line.payroll_date ?? "").trim().slice(0, 10);
    if (!d) continue;
    if (d < window.from || d > window.to) continue;
    total += Math.max(0, n(line.days_worked));
  }
  return round2(total);
}

/** Active / Inactive / All — same grouping as Final Pay status filter. */
export function matchesSilStatusFilter(
  employeeStatus: string | null | undefined,
  filterRaw: string | null | undefined
): boolean {
  const filter = String(filterRaw ?? "active").trim().toLowerCase() || "active";
  if (filter === "all") return true;
  const status = String(employeeStatus ?? "").trim().toLowerCase();
  if (filter === "active") return status === "active";
  if (filter === "inactive") {
    return (
      status === "inactive" ||
      status === "for_release" ||
      status === "barred"
    );
  }
  return status === filter;
}

export const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

export function silMonthTitle(year: number, month: number): string {
  const name = MONTH_NAMES[month - 1] ?? String(month);
  return `SERVICE INCENTIVE LEAVE - ${name} ${year}`;
}
