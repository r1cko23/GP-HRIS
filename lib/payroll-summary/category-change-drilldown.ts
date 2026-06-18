import type { PayrollRegisterRow } from "./register-columns";
import { normalizeEmployeeName } from "./normalize-name";
import type { PayrollCategoryTotals } from "./category-breakdown";
import type { PeriodChangeRow } from "./category-breakdown";
import type { PayrollSummaryMetrics } from "./types";

export type ChangeDriverKind = "hours" | "money" | "rate";

export interface ChangeDriver {
  key: RegisterField;
  label: string;
  delta: number;
  kind: ChangeDriverKind;
}

export interface CategoryChangeContributor {
  name: string;
  status: "changed" | "added" | "removed";
  previous: number;
  current: number;
  delta: number;
  /** Plain-language hint, e.g. "Regular hours +12.00" */
  reason: string | null;
  /** Structured breakdown: which line items moved for this employee */
  drivers: ChangeDriver[];
  sharePct: number;
}

export interface CategoryChangeDrilldown {
  category: PeriodChangeRow;
  contributors: CategoryChangeContributor[];
  previousPeriodLabel: string;
  currentPeriodLabel: string;
}

type CategoryKey = keyof PayrollCategoryTotals;
type RegisterField = keyof Omit<PayrollRegisterRow, "name">;

const CATEGORY_FIELD: Partial<Record<CategoryKey, RegisterField>> = {
  hoursWorked: "hoursWorked",
  daysWorked: "daysWorked",
  regOTHours: "regOTHours",
  totalSalary: "totalSalary",
  basicSalary: "basicSalary",
  regOTAmount: "regOTAmount",
  nightDiffAmount: "nightDiffAmount",
  regNightdiffOTAmount: "regNightdiffOTAmount",
  specialHolidayAmount: "specialHolidayAmount",
  specialHolidayOTAmount: "specialHolidayOTAmount",
  restdayAmount: "restdayAmount",
  totalOTAmount: "totalOTAmount",
  serviceIncentiveLeaveAmount: "serviceIncentiveLeaveAmount",
  transpoAllowance: "transpoAllowance",
  loadAllowance: "loadAllowance",
  allowance: "allowance",
  refund: "refund",
  grossAmount: "grossAmount",
  sss: "sss",
  sssPRO: "sssPRO",
  philhealth: "philhealth",
  pagibig: "pagibig",
  withholdingTax: "withholdingTax",
  sssLoan: "sssLoan",
  otherDeduction: "otherDeduction",
  totalDeduction: "totalDeduction",
  netAmount: "netAmount",
  silCutoff: "silCutoff",
  thirteenthMonthCutoff: "thirteenthMonthCutoff",
};

const FIELD_LABELS: Partial<Record<RegisterField, string>> = {
  hoursWorked: "Regular hours",
  daysWorked: "Days worked",
  dailyRate: "Daily rate",
  basicSalary: "Basic salary",
  regOTHours: "Reg OT hours",
  regOTAmount: "Reg OT pay",
  nightDiffHours: "Night diff hours",
  nightDiffAmount: "Night diff pay",
  regNightdiffOTHours: "Reg nightdiff OT hours",
  regNightdiffOTAmount: "Reg nightdiff OT pay",
  specialHolidayHours: "Holiday hours",
  specialHolidayAmount: "Holiday pay",
  specialHolidayOTHours: "Holiday OT hours",
  specialHolidayOTAmount: "Holiday OT pay",
  restdayHours: "Restday hours",
  restdayAmount: "Restday pay",
  totalOTAmount: "Total OT pay",
  serviceIncentiveLeaveAmount: "SIL pay",
  grossAmount: "Gross pay",
  netAmount: "Net pay",
  sssLoan: "Salary loan",
};

/** Primary register fields that explain a category total movement. */
const REASON_FIELDS: Partial<Record<CategoryKey, RegisterField[]>> = {
  hoursWorked: ["hoursWorked", "daysWorked"],
  daysWorked: ["daysWorked", "hoursWorked"],
  regOTHours: ["regOTHours"],
  totalSalary: ["hoursWorked", "daysWorked", "dailyRate"],
  basicSalary: ["hoursWorked", "daysWorked", "dailyRate"],
  regOTAmount: ["regOTHours", "regOTAmount"],
  nightDiffAmount: ["nightDiffHours", "nightDiffAmount"],
  regNightdiffOTAmount: ["regNightdiffOTHours", "regNightdiffOTAmount"],
  specialHolidayAmount: ["specialHolidayHours", "specialHolidayAmount"],
  specialHolidayOTAmount: ["specialHolidayOTHours", "specialHolidayOTAmount"],
  restdayAmount: ["restdayHours", "restdayAmount"],
  totalOTAmount: [
    "regOTHours",
    "regOTAmount",
    "nightDiffAmount",
    "specialHolidayAmount",
    "restdayAmount",
    "totalOTAmount",
  ],
  serviceIncentiveLeaveAmount: [
    "serviceIncentiveLeaveAmount",
    "hoursWorked",
  ],
  silCutoff: ["silCutoff", "serviceIncentiveLeaveAmount"],
  grossAmount: [
    "hoursWorked",
    "daysWorked",
    "totalSalary",
    "regOTHours",
    "regOTAmount",
    "nightDiffAmount",
    "specialHolidayAmount",
    "restdayAmount",
    "totalOTAmount",
    "serviceIncentiveLeaveAmount",
    "transpoAllowance",
    "loadAllowance",
    "allowance",
    "refund",
  ],
  netAmount: [
    "grossAmount",
    "totalDeduction",
    "sss",
    "philhealth",
    "pagibig",
    "withholdingTax",
    "sssLoan",
    "otherDeduction",
  ],
  totalDeduction: [
    "sss",
    "philhealth",
    "pagibig",
    "withholdingTax",
    "sssLoan",
    "otherDeduction",
  ],
  sss: ["sss"],
  philhealth: ["philhealth"],
  pagibig: ["pagibig"],
  withholdingTax: ["withholdingTax"],
  sssLoan: ["sssLoan"],
};

/** Extra line items shown when explaining regular pay / gross (cross-category context). */
const CONTEXT_FIELDS: Partial<Record<CategoryKey, RegisterField[]>> = {
  totalSalary: [
    "regOTHours",
    "regOTAmount",
    "serviceIncentiveLeaveAmount",
    "nightDiffAmount",
    "specialHolidayAmount",
    "totalOTAmount",
  ],
  grossAmount: ["dailyRate"],
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function periodLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

function driverKind(field: RegisterField): ChangeDriverKind {
  if (
    field.includes("Hours") ||
    field === "hoursWorked" ||
    field === "daysWorked"
  ) {
    return "hours";
  }
  if (field === "dailyRate") return "rate";
  return "money";
}

export function formatDriverValue(driver: ChangeDriver): string {
  const prefix = driver.delta > 0 ? "+" : "";
  if (driver.kind === "hours") {
    return `${prefix}${driver.delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (driver.kind === "rate") {
    return `${prefix}₱${Math.abs(driver.delta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const formatted = Math.abs(driver.delta).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${prefix}₱${formatted}`;
}

export function formatDriverDelta(driver: ChangeDriver): string {
  return `${driver.label} ${formatDriverValue(driver)}`;
}

function buildContributorDrivers(
  categoryKey: CategoryKey,
  previous: PayrollRegisterRow | null,
  current: PayrollRegisterRow | null
): ChangeDriver[] {
  if (!previous || !current) return [];

  const primary = REASON_FIELDS[categoryKey] ?? [];
  const context = CONTEXT_FIELDS[categoryKey] ?? [];
  const field = CATEGORY_FIELD[categoryKey];
  const fields = [
    ...new Set([
      ...primary,
      ...context,
      ...(field ? [field] : []),
    ]),
  ] as RegisterField[];

  const drivers: ChangeDriver[] = [];
  for (const f of fields) {
    const delta = round2((current[f] ?? 0) - (previous[f] ?? 0));
    if (Math.abs(delta) < 0.01) continue;
    drivers.push({
      key: f,
      label: FIELD_LABELS[f] ?? f,
      delta,
      kind: driverKind(f),
    });
  }

  drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return drivers.slice(0, 6);
}

function inferReason(
  categoryKey: CategoryKey,
  previous: PayrollRegisterRow | null,
  current: PayrollRegisterRow | null
): string | null {
  if (!previous || !current) {
    if (current && categoryKey === "employeeCount") return "New on this register";
    if (previous && categoryKey === "employeeCount") return "No longer on register";
    return current ? "New employee" : "Removed employee";
  }

  const drivers = buildContributorDrivers(categoryKey, previous, current);
  if (drivers.length > 0) {
    return drivers.map(formatDriverDelta).join(" · ");
  }

  return null;
}

function headcountDrilldown(
  previous: PayrollSummaryMetrics,
  current: PayrollSummaryMetrics,
  category: PeriodChangeRow
): CategoryChangeContributor[] {
  const prevMap = new Map(
    previous.employees.map((e) => [normalizeEmployeeName(e.name), e])
  );
  const currMap = new Map(
    current.employees.map((e) => [normalizeEmployeeName(e.name), e])
  );

  const contributors: CategoryChangeContributor[] = [];

  for (const emp of current.employees) {
    const key = normalizeEmployeeName(emp.name);
    if (prevMap.has(key)) continue;
    contributors.push({
      name: emp.name,
      status: "added",
      previous: 0,
      current: 1,
      delta: 1,
      reason: inferReason("employeeCount", null, emp),
      drivers: buildContributorDrivers("employeeCount", null, emp),
      sharePct: 0,
    });
  }

  for (const emp of previous.employees) {
    const key = normalizeEmployeeName(emp.name);
    if (currMap.has(key)) continue;
    contributors.push({
      name: emp.name,
      status: "removed",
      previous: 1,
      current: 0,
      delta: -1,
      reason: inferReason("employeeCount", emp, null),
      drivers: buildContributorDrivers("employeeCount", emp, null),
      sharePct: 0,
    });
  }

  const absSum = contributors.reduce((s, c) => s + Math.abs(c.delta), 0);
  for (const c of contributors) {
    c.sharePct =
      absSum === 0 ? 0 : round2((Math.abs(c.delta) / absSum) * 100);
  }

  return contributors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function buildCategoryChangeDrilldown(
  previous: PayrollSummaryMetrics,
  current: PayrollSummaryMetrics,
  category: PeriodChangeRow
): CategoryChangeDrilldown {
  const previousPeriodLabel = periodLabel(
    previous.periodStart,
    previous.periodEnd
  );
  const currentPeriodLabel = periodLabel(current.periodStart, current.periodEnd);

  if (category.key === "employeeCount") {
    return {
      category,
      contributors: headcountDrilldown(previous, current, category),
      previousPeriodLabel,
      currentPeriodLabel,
    };
  }

  const field = CATEGORY_FIELD[category.key];
  if (!field) {
    return {
      category,
      contributors: [],
      previousPeriodLabel,
      currentPeriodLabel,
    };
  }

  const prevMap = new Map(
    previous.employees.map((e) => [normalizeEmployeeName(e.name), e])
  );
  const currMap = new Map(
    current.employees.map((e) => [normalizeEmployeeName(e.name), e])
  );

  const contributors: CategoryChangeContributor[] = [];
  const seen = new Set<string>();

  for (const emp of current.employees) {
    const key = normalizeEmployeeName(emp.name);
    seen.add(key);
    const prev = prevMap.get(key);
    const prevVal = prev ? Number(prev[field] ?? 0) : 0;
    const currVal = Number(emp[field] ?? 0);
    const delta = round2(currVal - prevVal);
    if (delta === 0) continue;

    contributors.push({
      name: emp.name,
      status: prev ? "changed" : "added",
      previous: prevVal,
      current: currVal,
      delta,
      reason: inferReason(category.key, prev ?? null, emp),
      drivers: buildContributorDrivers(category.key, prev ?? null, emp),
      sharePct: 0,
    });
  }

  for (const emp of previous.employees) {
    const key = normalizeEmployeeName(emp.name);
    if (seen.has(key)) continue;
    const prevVal = Number(emp[field] ?? 0);
    if (prevVal === 0) continue;
    contributors.push({
      name: emp.name,
      status: "removed",
      previous: prevVal,
      current: 0,
      delta: round2(-prevVal),
      reason: inferReason(category.key, emp, null),
      drivers: buildContributorDrivers(category.key, emp, null),
      sharePct: 0,
    });
  }

  const absSum = contributors.reduce((s, c) => s + Math.abs(c.delta), 0);
  for (const c of contributors) {
    c.sharePct =
      absSum === 0 ? 0 : round2((Math.abs(c.delta) / absSum) * 100);
  }

  contributors.sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name)
  );

  return {
    category,
    contributors,
    previousPeriodLabel,
    currentPeriodLabel,
  };
}
