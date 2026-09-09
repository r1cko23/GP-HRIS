/**
 * MAIN ALDEX / PLK SOA body: Rate × Hours columns.
 * Map GP billing_lines hour buckets; zero missing combo buckets.
 * GENERIC stays on the Hours×Amount body in outputs.ts.
 */

import { PREMIUM_RATES } from "@/lib/ph-payroll/premiums";
import type { BillingOutputPack } from "./output-pack";
import type { StoredBillingLine } from "./outputs";

const round4 = (n: number) => Math.round(n * 10000) / 10000;

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function regHours(hours: Record<string, unknown> | null | undefined): number {
  const work = n(hours?.hours_work);
  if (work > 0) return work;
  return n(hours?.actual_regular_hours);
}

function rate(hourly: number, mult: number): number {
  if (hourly <= 0) return 0;
  return round4(hourly * mult);
}

const ALDEX_HEADERS = [
  "Employee code",
  "Employee name",
  "Department",
  "Position",
  "Daily rate",
  "Daily rate billing",
  "Reg rate",
  "Reg hours",
  "CoverUp OT rate",
  "CoverUp OT hours",
  "Reg OT rate",
  "Reg OT hours",
  "ND rate",
  "ND hours",
  "Reg ND OT rate",
  "Reg ND OT hours",
  "LH rate",
  "LH hours",
  "LH OT rate",
  "LH OT hours",
  "LH ND rate",
  "LH ND hours",
  "LH OT ND rate",
  "LH OT ND hours",
  "SH rate",
  "SH hours",
  "SH OT rate",
  "SH OT hours",
  "SH ND rate",
  "SH ND hours",
  "SH OT ND rate",
  "SH OT ND hours",
  "WDO RD rate",
  "WDO RD hours",
  "WDO RD OT rate",
  "WDO RD OT hours",
  "WDO RD ND rate",
  "WDO RD ND hours",
  "WDO hours",
  "WDO rate",
  "LH WDO rate",
  "LH WDO hours",
  "LH WDO OT rate",
  "LH WDO OT hours",
  "LH WDO ND rate",
  "LH WDO ND hours",
  "LH WDO OT ND rate",
  "LH WDO OT ND hours",
  "SH WDO rate",
  "SH WDO hours",
  "SH WDO OT rate",
  "SH WDO OT hours",
  "SH WDO ND rate",
  "SH WDO ND hours",
  "SH WDO OT ND rate",
  "SH WDO OT ND hours",
  "Billing department",
  "SSS ER",
  "PhilHealth ER",
  "Pag-IBIG ER",
  "SSS ECC",
  "Uniform",
  "Nameplate",
  "HMO",
  "Income adjustment",
  "Other charges",
  "Allowance",
  "Labor",
  "Mandatories",
  "Billable",
] as const;

const PLK_HEADERS = [
  "Employee code",
  "Employee name",
  "Department",
  "Position",
  "Daily rate",
  "Reg rate",
  "Reg hours",
  "CoverUp OT rate",
  "CoverUp OT hours",
  "Reg OT rate",
  "Reg OT hours",
  "ND rate",
  "ND hours",
  "Reg ND OT rate",
  "Reg ND OT hours",
  "LH rate",
  "LH hours",
  "LH rate 2",
  "LH hours 2",
  "LH OT rate",
  "LH OT hours",
  "LH ND rate",
  "LH ND hours",
  "LH OT ND rate",
  "LH OT ND hours",
  "SH rate",
  "SH hours",
  "SH rate 2",
  "SH hours 2",
  "SH OT rate",
  "SH OT hours",
  "SH ND rate",
  "SH ND hours",
  "SH OT ND rate",
  "SH OT ND hours",
  "WDO RD rate",
  "WDO RD hours",
  "WDO RD OT rate",
  "WDO RD OT hours",
  "WDO RD ND rate",
  "WDO RD ND hours",
  "WDO RD ND OT rate",
  "WDO RD ND OT hours",
  "WDO rate",
  "WDO hours",
  "LH WDO rate",
  "LH WDO hours",
  "LH WDO OT rate",
  "LH WDO OT hours",
  "LH WDO ND rate",
  "LH WDO ND hours",
  "LH WDO OT ND rate",
  "LH WDO OT ND hours",
  "SH WDO rate",
  "SH WDO hours",
  "SH WDO OT rate",
  "SH WDO OT hours",
  "SH WDO ND rate",
  "SH WDO ND hours",
  "SH WDO OT ND rate",
  "SH WDO OT ND hours",
  "Tardiness hours",
  "Allowance",
  "Labor",
  "Mandatories",
  "Billable",
] as const;

export function soaBodyHeadersForPack(pack: BillingOutputPack): readonly string[] {
  if (pack === "aldex") return ALDEX_HEADERS;
  if (pack === "plk") return PLK_HEADERS;
  return [];
}

export function usesMainRateHoursBody(pack: BillingOutputPack): boolean {
  return pack === "aldex" || pack === "plk";
}

function employeeName(line: StoredBillingLine): string {
  const last = text(line.last_name);
  const first = text(line.first_name);
  if (last && first) return `${last}, ${first}`;
  return last || first;
}

function hoursMap(line: StoredBillingLine): Record<string, unknown> {
  return (line.hours ?? {}) as Record<string, unknown>;
}

function amountsMap(line: StoredBillingLine): Record<string, unknown> {
  return (line.amounts ?? {}) as Record<string, unknown>;
}

/** Shared Rate×Hours core used by ALDEX and PLK. */
function coreRateHours(line: StoredBillingLine): {
  code: string;
  name: string;
  department: string;
  position: string;
  daily: number;
  hourly: number;
  h: Record<string, number>;
  r: Record<string, number>;
} {
  const hours = hoursMap(line);
  const hourly = n(line.billing_hourly_rate);
  const h = {
    reg: regHours(hours),
    ot: n(hours.overtime_hours),
    nd: n(hours.night_diff_hours),
    ndOt: n(hours.regular_night_ot_hours),
    lh: n(hours.legal_holiday_hours),
    lhOt: n(hours.legal_holiday_ot_hours),
    lhNd: n(hours.legal_holiday_nd_hours),
    sh: n(hours.special_holiday_hours),
    shOt: n(hours.special_holiday_ot_hours),
    rd: n(hours.rest_day_hours),
    rdOt: n(hours.rest_day_ot_hours),
    wdo: n(hours.wdo_hours),
    tardiness: n(hours.tardiness_hours),
  };
  const r = {
    reg: rate(hourly, PREMIUM_RATES.regular),
    ot: rate(hourly, PREMIUM_RATES.overtime),
    nd: rate(hourly, PREMIUM_RATES.night_diff),
    ndOt: rate(hourly, PREMIUM_RATES.regular_night_ot),
    lh: rate(hourly, PREMIUM_RATES.legal_holiday),
    lhOt: rate(hourly, PREMIUM_RATES.legal_holiday_ot),
    lhNd: rate(hourly, PREMIUM_RATES.legal_holiday_nd),
    sh: rate(hourly, PREMIUM_RATES.special_holiday),
    shOt: rate(hourly, PREMIUM_RATES.special_holiday_ot),
    rd: rate(hourly, PREMIUM_RATES.rest_day),
    rdOt: rate(hourly, PREMIUM_RATES.rest_day_ot),
    wdo: rate(hourly, PREMIUM_RATES.wdo),
  };
  return {
    code: text(line.employee_code),
    name: employeeName(line),
    department: text((line as { department?: string | null }).department),
    position: text((line as { position?: string | null }).position),
    daily: n(line.billing_daily_rate),
    hourly,
    h,
    r,
  };
}

export function aldexBodyValues(line: StoredBillingLine): unknown[] {
  const { code, name, department, position, daily, hourly, h, r } =
    coreRateHours(line);
  const amounts = amountsMap(line);
  const z = 0;
  return [
    code,
    name,
    department,
    position,
    daily,
    daily,
    r.reg,
    h.reg,
    z,
    z, // CoverUp
    r.ot,
    h.ot,
    r.nd,
    h.nd,
    r.ndOt,
    h.ndOt,
    r.lh,
    h.lh,
    r.lhOt,
    h.lhOt,
    r.lhNd,
    h.lhNd,
    z,
    z, // LH OT ND
    r.sh,
    h.sh,
    r.shOt,
    h.shOt,
    z,
    z, // SH ND
    z,
    z, // SH OT ND
    r.rd,
    h.rd,
    r.rdOt,
    h.rdOt,
    z,
    z, // WDO RD ND
    h.wdo,
    r.wdo,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z, // LH WDO*
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z, // SH WDO*
    department,
    z,
    z,
    z,
    z, // contribs
    z,
    z,
    z,
    z,
    z, // uniform…other
    n(amounts.allowance),
    n(line.labor),
    n(line.mandatories),
    n(line.billable),
  ];
}

export function plkBodyValues(line: StoredBillingLine): unknown[] {
  const { code, name, department, position, daily, h, r } = coreRateHours(line);
  const amounts = amountsMap(line);
  const z = 0;
  return [
    code,
    name,
    department,
    position,
    daily,
    r.reg,
    h.reg,
    z,
    z,
    r.ot,
    h.ot,
    r.nd,
    h.nd,
    r.ndOt,
    h.ndOt,
    r.lh,
    h.lh,
    z,
    z, // LH2
    r.lhOt,
    h.lhOt,
    r.lhNd,
    h.lhNd,
    z,
    z,
    r.sh,
    h.sh,
    z,
    z, // SH2
    r.shOt,
    h.shOt,
    z,
    z,
    z,
    z,
    r.rd,
    h.rd,
    r.rdOt,
    h.rdOt,
    z,
    z,
    z,
    z, // WDO RD ND / NDOT
    r.wdo,
    h.wdo,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    z,
    h.tardiness,
    n(amounts.allowance),
    n(line.labor),
    n(line.mandatories),
    n(line.billable),
  ];
}

export function mainPackBodyValues(
  pack: BillingOutputPack,
  line: StoredBillingLine
): unknown[] {
  if (pack === "aldex") return aldexBodyValues(line);
  if (pack === "plk") return plkBodyValues(line);
  return [];
}
