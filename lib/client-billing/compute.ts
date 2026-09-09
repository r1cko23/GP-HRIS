/**
 * Client billing from a posted payroll register.
 * Ports GREENHRISMAIN BILLINGPROCESSNEW: same hours × billing rates, then SOA wrap.
 */

import {
  computeEarningsFromHours,
  type CutoffHoursRow,
} from "@/lib/ph-payroll/premiums";

const round2 = (n: number) => Math.round(n * 100) / 100;

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/** Directory stores 0.12; a UI may still send 12. */
export function feeRate(value: unknown): number {
  const x = n(value);
  if (x <= 0) return 0;
  return x > 1 ? round2(x / 100) : x;
}

/**
 * Billing daily rate for a register line.
 * Register snapshot first, then Directory person, then position card.
 * Does not fall back to payroll daily rate (that would bill Organic house).
 */
export function resolveBillingDailyRate(input: {
  register_billing_daily_rate?: number | null;
  employee_billing_daily_rate?: number | null;
  position_billing_daily_rate?: number | null;
}): number {
  const fromRegister = n(input.register_billing_daily_rate);
  if (fromRegister > 0) return fromRegister;
  const fromPerson = n(input.employee_billing_daily_rate);
  if (fromPerson > 0) return fromPerson;
  return n(input.position_billing_daily_rate);
}

export function registerIsBillable(
  lines: Array<{ billing_daily_rate?: number | null }>
): boolean {
  return lines.some((line) => n(line.billing_daily_rate) > 0);
}

export type BillingMandatories = {
  sss_er?: number | null;
  philhealth_er?: number | null;
  pagibig_er?: number | null;
  sss_ecc?: number | null;
};

export type BillingLineAmounts = {
  regular: number;
  overtime: number;
  night_diff: number;
  regular_night_ot: number;
  legal_holiday: number;
  legal_holiday_ot: number;
  legal_holiday_nd: number;
  special_holiday: number;
  special_holiday_ot: number;
  rest_day: number;
  rest_day_ot: number;
  wdo: number;
  pto: number;
  allowance: number;
};

export type BillingLineResult = {
  billing_daily_rate: number;
  billing_hourly_rate: number;
  hours: Record<string, number>;
  amounts: BillingLineAmounts;
  labor: number;
  mandatories: number;
  billable: number;
};

export function computeBillingLine(input: {
  hours: Partial<CutoffHoursRow> & Record<string, unknown>;
  billing_daily_rate: number | null | undefined;
  allowance?: number | null;
  mandatories?: BillingMandatories;
}): BillingLineResult {
  const billingDaily = n(input.billing_daily_rate);
  const hourly = billingDaily > 0 ? billingDaily / 8 : 0;
  const hoursWork = n(input.hours.hours_work);
  const regularHours =
    hoursWork > 0 ? hoursWork : n(input.hours.actual_regular_hours);

  const billedHours: CutoffHoursRow = {
    id: "",
    directory_employee_id: null,
    office_employee_id: null,
    employee_code: null,
    last_name: null,
    first_name: null,
    daily_rate_payroll: billingDaily,
    actual_regular_hours: regularHours,
    hours_work: hoursWork || regularHours,
    overtime_hours: n(input.hours.overtime_hours),
    night_diff_hours: n(input.hours.night_diff_hours),
    regular_night_ot_hours: n(input.hours.regular_night_ot_hours),
    legal_holiday_hours: n(input.hours.legal_holiday_hours),
    legal_holiday_ot_hours: n(input.hours.legal_holiday_ot_hours),
    legal_holiday_nd_hours: n(input.hours.legal_holiday_nd_hours),
    special_holiday_hours: n(input.hours.special_holiday_hours),
    special_holiday_ot_hours: n(input.hours.special_holiday_ot_hours),
    rest_day_hours: n(input.hours.rest_day_hours),
    rest_day_ot_hours: n(input.hours.rest_day_ot_hours),
    wdo_hours: n(input.hours.wdo_hours),
    pto_hours: n(input.hours.pto_hours),
    allowance: n(input.allowance ?? input.hours.allowance),
    tardiness_hours: 0,
    undertime_hours: 0,
    absences_hours: 0,
  };

  const { earnings, hours } = computeEarningsFromHours(billedHours, billingDaily);

  const amounts: BillingLineAmounts = {
    regular: n(earnings.basic),
    overtime: n(earnings.overtime),
    night_diff: n(earnings.night_diff),
    regular_night_ot: n(earnings.regular_night_ot),
    legal_holiday: n(earnings.legal_holiday),
    legal_holiday_ot: n(earnings.legal_holiday_ot),
    legal_holiday_nd: n(earnings.legal_holiday_nd),
    special_holiday: n(earnings.special_holiday),
    special_holiday_ot: n(earnings.special_holiday_ot),
    rest_day: n(earnings.rest_day),
    rest_day_ot: n(earnings.rest_day_ot),
    wdo: n(earnings.wdo),
    pto: n(earnings.pto),
    allowance: n(earnings.allowance),
  };

  const labor = round2(
    Object.values(amounts).reduce((acc, v) => acc + v, 0)
  );
  const mandatories = round2(
    n(input.mandatories?.sss_er) +
      n(input.mandatories?.philhealth_er) +
      n(input.mandatories?.pagibig_er) +
      n(input.mandatories?.sss_ecc)
  );

  return {
    billing_daily_rate: billingDaily,
    billing_hourly_rate: round2(hourly),
    hours,
    amounts,
    labor,
    mandatories,
    billable: round2(labor + mandatories),
  };
}

export type BillingSoa = {
  labor: number;
  mandatories: number;
  subtotal: number;
  admin_fee_rate: number;
  vat_rate: number;
  ewt_rate: number;
  admin_fee_amount: number;
  vatable: number;
  vat_amount: number;
  ewt_amount: number;
  amount_due: number;
};

export function wrapBillingSoa(input: {
  labor: number;
  mandatories: number;
  admin_fee: number | null | undefined;
  vat: number | null | undefined;
  ewt: number | null | undefined;
}): BillingSoa {
  const labor = round2(n(input.labor));
  const mandatories = round2(n(input.mandatories));
  const subtotal = round2(labor + mandatories);
  const admin_fee_rate = feeRate(input.admin_fee);
  const vat_rate = feeRate(input.vat);
  const ewt_rate = feeRate(input.ewt);
  const admin_fee_amount = round2(subtotal * admin_fee_rate);
  const vatable = round2(subtotal + admin_fee_amount);
  const vat_amount = round2(vatable * vat_rate);
  const ewt_amount = round2(vatable * ewt_rate);
  const amount_due = round2(vatable + vat_amount - ewt_amount);
  return {
    labor,
    mandatories,
    subtotal,
    admin_fee_rate,
    vat_rate,
    ewt_rate,
    admin_fee_amount,
    vatable,
    vat_amount,
    ewt_amount,
    amount_due,
  };
}
