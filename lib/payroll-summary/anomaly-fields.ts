import type { PayrollRegisterRow } from "./register-columns";

export type AnomalyFieldKind = "hours" | "currency" | "count";

export interface EmployeeAnomalyFieldDef {
  key: keyof PayrollRegisterRow;
  label: string;
  kind: AnomalyFieldKind;
  /** Positive delta increases client manpower cost */
  costImpact: boolean;
}

/** Fields compared per employee for payroll audit / fraud detection. */
export const EMPLOYEE_ANOMALY_FIELDS: EmployeeAnomalyFieldDef[] = [
  { key: "hoursWorked", label: "Regular hours", kind: "hours", costImpact: false },
  { key: "daysWorked", label: "Days worked", kind: "count", costImpact: false },
  { key: "dailyRate", label: "Daily rate", kind: "currency", costImpact: false },
  { key: "basicSalary", label: "Basic salary", kind: "currency", costImpact: true },
  { key: "totalSalary", label: "Regular pay", kind: "currency", costImpact: true },
  { key: "regOTHours", label: "Reg OT hours", kind: "hours", costImpact: false },
  { key: "regOTAmount", label: "Reg OT pay", kind: "currency", costImpact: true },
  { key: "nightDiffAmount", label: "Night diff pay", kind: "currency", costImpact: true },
  {
    key: "regNightdiffOTAmount",
    label: "Reg nightdiff OT pay",
    kind: "currency",
    costImpact: true,
  },
  { key: "specialHolidayAmount", label: "Holiday pay", kind: "currency", costImpact: true },
  {
    key: "specialHolidayOTAmount",
    label: "Holiday OT pay",
    kind: "currency",
    costImpact: true,
  },
  { key: "restdayAmount", label: "Restday pay", kind: "currency", costImpact: true },
  { key: "totalOTAmount", label: "Total OT pay", kind: "currency", costImpact: true },
  {
    key: "serviceIncentiveLeaveAmount",
    label: "SIL pay",
    kind: "currency",
    costImpact: true,
  },
  { key: "transpoAllowance", label: "Transpo allowance", kind: "currency", costImpact: true },
  { key: "loadAllowance", label: "Load allowance", kind: "currency", costImpact: true },
  { key: "allowance", label: "Other allowance", kind: "currency", costImpact: true },
  { key: "refund", label: "Refund", kind: "currency", costImpact: true },
  { key: "grossAmount", label: "Gross pay", kind: "currency", costImpact: true },
  { key: "sssLoan", label: "Salary / SSS loan", kind: "currency", costImpact: false },
  { key: "otherDeduction", label: "Other deduction", kind: "currency", costImpact: false },
  { key: "totalDeduction", label: "Total deduction", kind: "currency", costImpact: false },
  { key: "netAmount", label: "Net pay", kind: "currency", costImpact: true },
  { key: "silCutoff", label: "SIL cutoff", kind: "currency", costImpact: true },
  {
    key: "thirteenthMonthCutoff",
    label: "13th month cutoff",
    kind: "currency",
    costImpact: true,
  },
];

const COST_IMPACT_KEYS = new Set(
  EMPLOYEE_ANOMALY_FIELDS.filter((f) => f.costImpact).map((f) => f.key)
);

export interface EmployeeFieldChange {
  key: string;
  label: string;
  kind: AnomalyFieldKind;
  previous: number;
  current: number;
  delta: number;
}

export function roundAnomaly(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeEmployeeFieldChanges(
  previous: PayrollRegisterRow,
  current: PayrollRegisterRow
): EmployeeFieldChange[] {
  const changes: EmployeeFieldChange[] = [];

  for (const field of EMPLOYEE_ANOMALY_FIELDS) {
    const prevVal = Number(previous[field.key] ?? 0);
    const currVal = Number(current[field.key] ?? 0);
    const delta = roundAnomaly(currVal - prevVal);
    if (delta === 0) continue;
    changes.push({
      key: field.key,
      label: field.label,
      kind: field.kind,
      previous: prevVal,
      current: currVal,
      delta,
    });
  }

  return changes.sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.label.localeCompare(b.label)
  );
}

export function computeManpowerCostDelta(changes: EmployeeFieldChange[]): number {
  return roundAnomaly(
    changes
      .filter((c) => COST_IMPACT_KEYS.has(c.key as keyof PayrollRegisterRow) && c.delta > 0)
      .reduce((sum, c) => sum + c.delta, 0)
  );
}

export function topCostChangeLabel(changes: EmployeeFieldChange[]): string | null {
  const costChanges = changes.filter((c) =>
    COST_IMPACT_KEYS.has(c.key as keyof PayrollRegisterRow)
  );
  if (costChanges.length === 0) {
    return changes[0]?.label ?? null;
  }
  const top = [...costChanges].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  return top?.label ?? null;
}

export type EmployeeRiskFlag =
  | "potential_ghost"
  | "possible_rename"
  | "hours_increase"
  | "days_increase"
  | "regular_pay_increase"
  | "ot_increase"
  | "holiday_pay_increase"
  | "allowance_increase"
  | "gross_increase"
  | "net_increase"
  | "sil_increase"
  | "rate_increase";

const RISK_FLAG_LABELS: Record<EmployeeRiskFlag, string> = {
  potential_ghost: "Potential ghost",
  possible_rename: "Possible rename",
  hours_increase: "Hours ↑",
  days_increase: "Days ↑",
  regular_pay_increase: "Regular pay ↑",
  ot_increase: "OT ↑",
  holiday_pay_increase: "Holiday pay ↑",
  allowance_increase: "Allowance ↑",
  gross_increase: "Gross ↑",
  net_increase: "Net ↑",
  sil_increase: "SIL ↑",
  rate_increase: "Rate ↑",
};

export function riskFlagLabel(flag: string): string {
  return RISK_FLAG_LABELS[flag as EmployeeRiskFlag] ?? flag;
}

export function deriveRiskFlags(
  status: "added" | "removed" | "changed" | "renamed",
  employee: PayrollRegisterRow,
  changes: EmployeeFieldChange[]
): EmployeeRiskFlag[] {
  const flags = new Set<EmployeeRiskFlag>();

  if (status === "renamed") {
    flags.add("possible_rename");
  }

  if (
    status === "added" &&
    (employee.hoursWorked > 0 ||
      employee.daysWorked > 0 ||
      employee.grossAmount > 0 ||
      employee.netAmount > 0)
  ) {
    flags.add("potential_ghost");
  }

  for (const change of changes) {
    if (change.delta <= 0) continue;
    switch (change.key) {
      case "hoursWorked":
        flags.add("hours_increase");
        break;
      case "daysWorked":
        flags.add("days_increase");
        break;
      case "dailyRate":
        flags.add("rate_increase");
        break;
      case "basicSalary":
      case "totalSalary":
        flags.add("regular_pay_increase");
        break;
      case "regOTHours":
      case "regOTAmount":
      case "totalOTAmount":
      case "nightDiffAmount":
      case "regNightdiffOTAmount":
        flags.add("ot_increase");
        break;
      case "specialHolidayAmount":
      case "specialHolidayOTAmount":
      case "restdayAmount":
        flags.add("holiday_pay_increase");
        break;
      case "transpoAllowance":
      case "loadAllowance":
      case "allowance":
        flags.add("allowance_increase");
        break;
      case "grossAmount":
        flags.add("gross_increase");
        break;
      case "netAmount":
        flags.add("net_increase");
        break;
      case "serviceIncentiveLeaveAmount":
      case "silCutoff":
        flags.add("sil_increase");
        break;
      default:
        break;
    }
  }

  return [...flags];
}
