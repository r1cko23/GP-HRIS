/**
 * COLA / SEA / CTPA and billing rate columns for register reports.
 * Amounts follow Client include_* flags (MAIN zeros them when off).
 * Payroll gross/net are unchanged until a later slice adds these to earnings.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export type ClientSupplementalPolicy = {
  include_cola: boolean;
  include_sea: boolean;
  include_ctpa: boolean;
};

export type SupplementalRateSource = {
  employee_ecola?: number | null;
  employee_billing_daily_rate?: number | null;
  position_ecola?: number | null;
  position_sea?: number | null;
  position_ctpa?: number | null;
  position_billing_daily_rate?: number | null;
};

export type ResolvedSupplementalRates = {
  cola_per_day: number;
  sea_per_day: number;
  ctpa_per_day: number;
  billing_daily_rate: number;
};

export type SupplementalPayroll = ResolvedSupplementalRates & {
  days_work: number;
  cola_payroll: number;
  sea_payroll: number;
  ctpa_payroll: number;
  billing_gross_estimate: number;
};

export function resolveSupplementalRates(
  source: SupplementalRateSource
): ResolvedSupplementalRates {
  const employeeEcola = n(source.employee_ecola);
  const positionEcola = n(source.position_ecola);
  return {
    cola_per_day: employeeEcola > 0 ? employeeEcola : positionEcola,
    sea_per_day: n(source.position_sea),
    ctpa_per_day: n(source.position_ctpa),
    billing_daily_rate:
      n(source.employee_billing_daily_rate) > 0
        ? n(source.employee_billing_daily_rate)
        : n(source.position_billing_daily_rate),
  };
}

/** Days basis for per-day allowances (regular + PTO, 8h = 1 day). */
export function payrollDaysFromHours(hours: {
  actual_regular_hours?: number | null;
  pto_hours?: number | null;
}): number {
  const regular = n(hours.actual_regular_hours);
  const pto = n(hours.pto_hours);
  return round2((regular + pto) / 8);
}

export function computeSupplementalPayroll(input: {
  policy: ClientSupplementalPolicy;
  rates: ResolvedSupplementalRates;
  daysWork: number;
}): SupplementalPayroll {
  const days = round2(Math.max(0, input.daysWork));
  const { rates, policy } = input;
  const cola_payroll = policy.include_cola
    ? round2(rates.cola_per_day * days)
    : 0;
  const sea_payroll = policy.include_sea
    ? round2(rates.sea_per_day * days)
    : 0;
  const ctpa_payroll = policy.include_ctpa
    ? round2(rates.ctpa_per_day * days)
    : 0;
  const billing_gross_estimate =
    rates.billing_daily_rate > 0 ? round2(rates.billing_daily_rate * days) : 0;

  return {
    ...rates,
    days_work: days,
    cola_payroll,
    sea_payroll,
    ctpa_payroll,
    billing_gross_estimate,
  };
}

/** Keys stored on register line `earnings` for exports (not in gross_pay). */
export const SUPPLEMENTAL_EARNINGS_KEYS = [
  "cola_per_day",
  "sea_per_day",
  "ctpa_per_day",
  "billing_daily_rate",
  "days_work",
  "cola_payroll",
  "sea_payroll",
  "ctpa_payroll",
  "billing_gross_estimate",
] as const;

export function supplementalToEarnings(
  supplemental: SupplementalPayroll
): Record<string, number> {
  return {
    cola_per_day: supplemental.cola_per_day,
    sea_per_day: supplemental.sea_per_day,
    ctpa_per_day: supplemental.ctpa_per_day,
    billing_daily_rate: supplemental.billing_daily_rate,
    days_work: supplemental.days_work,
    cola_payroll: supplemental.cola_payroll,
    sea_payroll: supplemental.sea_payroll,
    ctpa_payroll: supplemental.ctpa_payroll,
    billing_gross_estimate: supplemental.billing_gross_estimate,
  };
}
