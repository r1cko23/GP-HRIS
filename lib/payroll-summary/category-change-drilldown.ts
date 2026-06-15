import type { PayrollRegisterRow } from "./register-columns";
import { normalizeEmployeeName } from "./normalize-name";
import type { PayrollCategoryTotals } from "./category-breakdown";
import type { PeriodChangeRow } from "./category-breakdown";
import type { PayrollSummaryMetrics } from "./types";

export interface CategoryChangeContributor {
  name: string;
  status: "changed" | "added" | "removed";
  previous: number;
  current: number;
  delta: number;
  /** Plain-language hint, e.g. "Regular hours +12.00" */
  reason: string | null;
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

/** Related register fields checked to explain a category movement. */
const REASON_FIELDS: Partial<Record<CategoryKey, RegisterField[]>> = {
  totalSalary: ["hoursWorked", "daysWorked", "dailyRate"],
  basicSalary: ["hoursWorked", "daysWorked", "dailyRate"],
  regOTAmount: ["regOTHours"],
  nightDiffAmount: ["nightDiffHours"],
  regNightdiffOTAmount: ["regNightdiffOTHours"],
  specialHolidayAmount: ["specialHolidayHours"],
  specialHolidayOTAmount: ["specialHolidayOTHours"],
  restdayAmount: ["restdayHours"],
  grossAmount: ["hoursWorked", "regOTHours", "totalSalary", "regOTAmount"],
  netAmount: ["grossAmount", "totalDeduction", "sssLoan"],
  totalDeduction: ["sss", "philhealth", "pagibig", "withholdingTax", "sssLoan"],
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

function formatReasonDelta(
  field: RegisterField,
  delta: number
): string {
  const label = FIELD_LABELS[field] ?? field;
  const prefix = delta > 0 ? "+" : "";
  const isHours =
    field.includes("Hours") ||
    field === "hoursWorked" ||
    field === "daysWorked" ||
    field.includes("OTHours");
  if (isHours) {
    return `${label} ${prefix}${delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  const formatted = Math.abs(delta).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${label} ${prefix}₱${formatted}`;
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

  const related = REASON_FIELDS[categoryKey] ?? [];
  const hints: string[] = [];

  for (const field of related) {
    const d = round2((current[field] ?? 0) - (previous[field] ?? 0));
    if (Math.abs(d) < 0.01) continue;
    hints.push(formatReasonDelta(field, d));
  }

  if (hints.length > 0) return hints.slice(0, 2).join(" · ");

  if (categoryKey === "totalSalary" || categoryKey === "basicSalary") {
    const rateDelta = round2(current.dailyRate - previous.dailyRate);
    if (Math.abs(rateDelta) >= 0.01) {
      return formatReasonDelta("dailyRate", rateDelta);
    }
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
