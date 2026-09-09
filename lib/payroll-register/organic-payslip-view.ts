/**
 * Employee-facing rows for the Organic payslip (PDF + on-screen preview).
 * Register JSON also stores billing rates, days_work, and employer shares —
 * those belong on reports, not the slip the employee keeps.
 */

export const EARNING_ORDER = [
  "basic",
  "basic_pay",
  "regular_pay",
  "overtime",
  "ot_pay",
  "night_diff",
  "nd_pay",
  "legal_holiday",
  "special_holiday",
  "rest_day",
  "pto",
  "allowance",
  "cola",
  "cola_payroll",
  "sea",
  "sea_payroll",
  "ctpa",
  "ctpa_payroll",
  "adjustment",
  "other",
];

export const HOUR_ORDER = [
  "regular",
  "actual_regular_hours",
  "overtime",
  "overtime_hours",
  "night_diff",
  "night_diff_hours",
  "legal_holiday",
  "legal_holiday_hours",
  "special_holiday",
  "special_holiday_hours",
  "rest_day",
  "rest_day_hours",
  "pto",
  "pto_hours",
];

const PRIMARY_DEDUCTION_SKIP = new Set([
  "sss",
  "philhealth",
  "pagibig",
  "withholding_tax",
  "loans",
  "other",
]);

const HIDDEN_DEDUCTION_KEYS = new Set([
  ...PRIMARY_DEDUCTION_SKIP,
  "sss_regular",
  "sss_wisp",
  "sss_er",
  "sss_wisp_er",
  "sss_ecc",
  "philhealth_er",
  "pagibig_er",
  "taxable_income",
]);

/** Stored on earnings JSON but not take-home peso amounts. */
const HIDDEN_EARNING_KEYS = new Set([
  "days_work",
  "hours_work",
  "cola_per_day",
  "sea_per_day",
  "ctpa_per_day",
  "billing_daily_rate",
  "billing_gross_estimate",
]);

const HOUR_SKIP = new Set(["hours_work"]);

const LABEL_ALIASES: Record<string, string> = {
  actual_regular_hours: "Regular hours",
  overtime_hours: "Overtime hours",
  night_diff_hours: "Night diff hours",
  legal_holiday_hours: "Legal holiday hours",
  special_holiday_hours: "Special holiday hours",
  rest_day_hours: "Rest day hours",
  pto_hours: "PTO hours",
  basic: "Basic pay",
  cola_payroll: "COLA",
  sea_payroll: "SEA",
  ctpa_payroll: "CTPA",
};

export function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/** Helvetica / WinAnsi cannot draw ₱; PHP keeps amounts aligned in the PDF. */
export function formatPayslipPhp(value: unknown): string {
  return `PHP ${n(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function labelizePayslipKey(key: string): string {
  if (LABEL_ALIASES[key]) return LABEL_ALIASES[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOt\b/g, "OT")
    .replace(/\bNd\b/g, "ND")
    .replace(/\bSss\b/g, "SSS")
    .replace(/\bWtax\b/g, "WTax")
    .replace(/\bCola\b/g, "COLA")
    .replace(/\bSea\b/g, "SEA")
    .replace(/\bCtpa\b/g, "CTPA");
}

function sortedEntries(
  map: Record<string, number>,
  preferred: string[]
): Array<[string, number]> {
  const keys = Object.keys(map);
  const ordered = [
    ...preferred.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferred.includes(k)).sort(),
  ];
  return ordered
    .map((k) => [k, n(map[k])] as [string, number])
    .filter(([, amount]) => amount !== 0);
}

export type OrganicPayslipViewInput = {
  earnings?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
  hours?: Record<string, number> | null;
};

export type OrganicPayslipView = {
  daysWork: number;
  earningRows: Array<[string, number]>;
  hourRows: Array<[string, number]>;
  primaryDeductionRows: Array<[string, number]>;
  extraDeductionRows: Array<[string, number]>;
};

export function organicPayslipView(
  line: OrganicPayslipViewInput
): OrganicPayslipView {
  const earnings = line.earnings ?? {};
  const deductions = line.deductions ?? {};
  const hours = line.hours ?? {};

  const earningRows = sortedEntries(earnings, EARNING_ORDER).filter(
    ([key]) => !HIDDEN_EARNING_KEYS.has(key)
  );
  const hourRows = sortedEntries(hours, HOUR_ORDER).filter(
    ([key]) => !HOUR_SKIP.has(key)
  );
  const primaryDeductionRows: Array<[string, number]> = [
    ["SSS", n(deductions.sss)],
    ["PhilHealth", n(deductions.philhealth)],
    ["Pag-IBIG", n(deductions.pagibig)],
    ["Withholding tax", n(deductions.withholding_tax)],
    ["Loans", n(deductions.loans)],
    ["Other", n(deductions.other)],
  ].filter(([, amount]) => amount !== 0);

  const extraDeductionRows = Object.entries(deductions)
    .filter(([key, amount]) => !HIDDEN_DEDUCTION_KEYS.has(key) && n(amount) !== 0)
    .map(([key, amount]) => [key, n(amount)] as [string, number])
    .sort(([a], [b]) => a.localeCompare(b));

  return {
    daysWork: n(earnings.days_work),
    earningRows,
    hourRows,
    primaryDeductionRows,
    extraDeductionRows,
  };
}
