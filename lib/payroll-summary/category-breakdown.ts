import type { PayrollRegisterRow } from "./register-columns";
import type { PayrollSummaryMetrics } from "./types";

export type BridgeMetric = "grossAmount" | "netAmount";

export interface PayrollCategoryTotals {
  employeeCount: number;
  hoursWorked: number;
  daysWorked: number;
  regOTHours: number;
  totalSalary: number;
  basicSalary: number;
  regOTAmount: number;
  nightDiffAmount: number;
  specialHolidayAmount: number;
  specialHolidayOTAmount: number;
  restdayAmount: number;
  totalOTAmount: number;
  serviceIncentiveLeaveAmount: number;
  refund: number;
  transpoAllowance: number;
  loadAllowance: number;
  allowance: number;
  grossAmount: number;
  sss: number;
  sssPRO: number;
  philhealth: number;
  pagibig: number;
  withholdingTax: number;
  sssLoan: number;
  otherDeduction: number;
  totalDeduction: number;
  netAmount: number;
  silCutoff: number;
  thirteenthMonthCutoff: number;
}

export interface CategoryDefinition {
  key: keyof PayrollCategoryTotals;
  label: string;
  /** earnings increase gross/net; deductions reduce net when metric is netAmount */
  kind: "count" | "hours" | "earnings" | "deduction" | "accrual";
}

/** BI categories aligned with payroll register columns. */
export const PAYROLL_BRIDGE_CATEGORIES: CategoryDefinition[] = [
  { key: "employeeCount", label: "Employee count", kind: "count" },
  { key: "hoursWorked", label: "Regular hours", kind: "hours" },
  { key: "regOTHours", label: "Reg OT hours", kind: "hours" },
  { key: "totalSalary", label: "Regular pay", kind: "earnings" },
  { key: "regOTAmount", label: "Regular OT pay", kind: "earnings" },
  { key: "nightDiffAmount", label: "Night differential", kind: "earnings" },
  { key: "specialHolidayAmount", label: "Special holiday pay", kind: "earnings" },
  { key: "specialHolidayOTAmount", label: "Special holiday OT", kind: "earnings" },
  { key: "restdayAmount", label: "Restday pay", kind: "earnings" },
  { key: "totalOTAmount", label: "Total OT", kind: "earnings" },
  { key: "serviceIncentiveLeaveAmount", label: "SIL pay", kind: "earnings" },
  { key: "transpoAllowance", label: "Transpo allowance", kind: "earnings" },
  { key: "loadAllowance", label: "Load allowance", kind: "earnings" },
  { key: "allowance", label: "Other allowance", kind: "earnings" },
  { key: "refund", label: "Refunds", kind: "earnings" },
  { key: "grossAmount", label: "Gross pay", kind: "earnings" },
  { key: "sss", label: "SSS", kind: "deduction" },
  { key: "sssPRO", label: "SSS Provident", kind: "deduction" },
  { key: "philhealth", label: "PhilHealth", kind: "deduction" },
  { key: "pagibig", label: "Pag-IBIG", kind: "deduction" },
  { key: "withholdingTax", label: "Withholding tax", kind: "deduction" },
  { key: "sssLoan", label: "SSS / salary loan", kind: "deduction" },
  { key: "otherDeduction", label: "Other deductions", kind: "deduction" },
  { key: "totalDeduction", label: "Total deductions", kind: "deduction" },
  { key: "netAmount", label: "Net pay", kind: "earnings" },
  { key: "silCutoff", label: "SIL cutoff accrual", kind: "accrual" },
  { key: "thirteenthMonthCutoff", label: "13th month accrual", kind: "accrual" },
];

const NUMERIC_KEYS = PAYROLL_BRIDGE_CATEGORIES.map((c) => c.key).filter(
  (k) => k !== "employeeCount"
) as Array<Exclude<keyof PayrollCategoryTotals, "employeeCount">>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function emptyCategoryTotals(): PayrollCategoryTotals {
  return {
    employeeCount: 0,
    hoursWorked: 0,
    daysWorked: 0,
    regOTHours: 0,
    totalSalary: 0,
    basicSalary: 0,
    regOTAmount: 0,
    nightDiffAmount: 0,
    specialHolidayAmount: 0,
    specialHolidayOTAmount: 0,
    restdayAmount: 0,
    totalOTAmount: 0,
    serviceIncentiveLeaveAmount: 0,
    refund: 0,
    transpoAllowance: 0,
    loadAllowance: 0,
    allowance: 0,
    grossAmount: 0,
    sss: 0,
    sssPRO: 0,
    philhealth: 0,
    pagibig: 0,
    withholdingTax: 0,
    sssLoan: 0,
    otherDeduction: 0,
    totalDeduction: 0,
    netAmount: 0,
    silCutoff: 0,
    thirteenthMonthCutoff: 0,
  };
}

export function sumEmployeeCategories(
  employees: PayrollRegisterRow[]
): PayrollCategoryTotals {
  const totals = emptyCategoryTotals();
  totals.employeeCount = employees.length;

  for (const emp of employees) {
    for (const key of NUMERIC_KEYS) {
      totals[key] += emp[key] ?? 0;
    }
  }

  for (const key of NUMERIC_KEYS) {
    totals[key] = round2(totals[key]);
  }
  return totals;
}

/** Build category totals from parsed upload metrics (employee rows preferred). */
export function totalsFromMetrics(
  metrics: PayrollSummaryMetrics
): PayrollCategoryTotals {
  if (metrics.employees?.length) {
    return sumEmployeeCategories(metrics.employees);
  }

  const t = emptyCategoryTotals();
  const ot = metrics.totalOTAmount ?? 0;
  const sil = metrics.silTotal ?? 0;
  const gross = metrics.grossAmountTotal;
  const net = metrics.netAmountTotal;

  t.employeeCount = metrics.employeeCount;
  t.hoursWorked = metrics.hoursWorkedTotal;
  t.regOTHours = metrics.regOTHoursTotal;
  t.regOTAmount = ot;
  t.totalOTAmount = ot;
  t.serviceIncentiveLeaveAmount = sil;
  t.silCutoff = metrics.silCutoffTotal;
  t.grossAmount = gross;
  t.netAmount = net;
  t.totalDeduction = round2(Math.max(0, gross - net));
  t.totalSalary = round2(Math.max(0, gross - ot - sil));

  if (t.totalSalary === 0 && gross > 0) {
    t.totalSalary = gross;
  }

  return t;
}

export interface PeriodChangeRow {
  key: keyof PayrollCategoryTotals;
  label: string;
  kind: CategoryDefinition["kind"];
  previous: number;
  current: number;
  delta: number;
  sharePct: number;
}

/** All category movements between periods — includes accruals, hours, and headcount. */
export function buildPeriodChanges(
  previous: PayrollSummaryMetrics,
  current: PayrollSummaryMetrics
): PeriodChangeRow[] {
  const prevTotals = totalsFromMetrics(previous);
  const currTotals = totalsFromMetrics(current);

  const rows: PeriodChangeRow[] = PAYROLL_BRIDGE_CATEGORIES.map((def) => {
    const prev = prevTotals[def.key];
    const curr = currTotals[def.key];
    const delta = round2(curr - prev);
    return {
      key: def.key,
      label: def.label,
      kind: def.kind,
      previous: prev,
      current: curr,
      delta,
      sharePct: 0,
    };
  }).filter((r) => r.delta !== 0);

  const absSum = rows.reduce((s, r) => s + Math.abs(r.delta), 0);
  for (const row of rows) {
    row.sharePct =
      absSum === 0 ? 0 : round2((Math.abs(row.delta) / absSum) * 100);
  }

  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function topMoverFromChanges(
  changes: PeriodChangeRow[]
): PeriodChangeRow | null {
  return changes[0] ?? null;
}

export interface CategoryBridgeItem {
  key: keyof PayrollCategoryTotals;
  label: string;
  kind: CategoryDefinition["kind"];
  previous: number;
  current: number;
  delta: number;
  /** Share of total absolute movement (for ranking drivers) */
  contributionPct: number;
  /** Signed impact on selected bridge metric */
  impact: number;
}

export interface PeriodBridgeAnalysis {
  metric: BridgeMetric;
  metricLabel: string;
  previousLabel: string;
  currentLabel: string;
  previousTotal: number;
  currentTotal: number;
  totalDelta: number;
  totalDeltaPct: number | null;
  items: CategoryBridgeItem[];
  /** Top drivers sorted by |impact| */
  topDrivers: CategoryBridgeItem[];
}

function periodLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

function categoriesForMetric(metric: BridgeMetric): CategoryDefinition[] {
  if (metric === "grossAmount") {
    return PAYROLL_BRIDGE_CATEGORIES.filter(
      (c) =>
        c.kind === "earnings" &&
        !["grossAmount", "netAmount", "totalOTAmount"].includes(c.key)
    );
  }
  return PAYROLL_BRIDGE_CATEGORIES.filter(
    (c) =>
      c.kind !== "count" &&
      c.kind !== "hours" &&
      !["grossAmount", "netAmount", "totalDeduction", "totalOTAmount"].includes(
        c.key
      )
  );
}

function impactForCategory(
  metric: BridgeMetric,
  kind: CategoryDefinition["kind"],
  delta: number
): number {
  if (kind === "count" || kind === "hours" || kind === "accrual") return 0;
  if (metric === "grossAmount") {
    if (kind === "earnings") return delta;
    return 0;
  }
  if (kind === "earnings") return delta;
  if (kind === "deduction") return -delta;
  return 0;
}

export function buildPeriodBridge(
  previous: PayrollSummaryMetrics,
  current: PayrollSummaryMetrics,
  metric: BridgeMetric = "netAmount"
): PeriodBridgeAnalysis {
  const prevTotals = totalsFromMetrics(previous);
  const currTotals = totalsFromMetrics(current);
  const previousTotal = prevTotals[metric];
  const currentTotal = currTotals[metric];
  const totalDelta = round2(currentTotal - previousTotal);
  const totalDeltaPct =
    previousTotal === 0
      ? currentTotal === 0
        ? 0
        : null
      : round2((totalDelta / previousTotal) * 100);

  const defs = categoriesForMetric(metric);
  const items: CategoryBridgeItem[] = defs.map((def) => {
    const prev = prevTotals[def.key];
    const curr = currTotals[def.key];
    const delta = round2(curr - prev);
    return {
      key: def.key,
      label: def.label,
      kind: def.kind,
      previous: prev,
      current: curr,
      delta,
      contributionPct: 0,
      impact: round2(impactForCategory(metric, def.kind, delta)),
    };
  });

  const absImpactSum = items.reduce((s, i) => s + Math.abs(i.impact), 0);
  for (const item of items) {
    item.contributionPct =
      absImpactSum === 0
        ? 0
        : round2((Math.abs(item.impact) / absImpactSum) * 100);
  }

  const topDrivers = [...items]
    .filter((i) => i.impact !== 0)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 8);

  const metricLabel = metric === "grossAmount" ? "Gross pay" : "Net pay";

  return {
    metric,
    metricLabel,
    previousLabel: periodLabel(previous.periodStart, previous.periodEnd),
    currentLabel: periodLabel(current.periodStart, current.periodEnd),
    previousTotal,
    currentTotal,
    totalDelta,
    totalDeltaPct,
    items,
    topDrivers,
  };
}

/** Non-currency context rows (headcount & hours) for the same periods. */
export function buildVolumeContext(
  previous: PayrollSummaryMetrics,
  current: PayrollSummaryMetrics
) {
  const prev = totalsFromMetrics(previous);
  const curr = totalsFromMetrics(current);
  return [
    {
      label: "Employees",
      previous: prev.employeeCount,
      current: curr.employeeCount,
      delta: curr.employeeCount - prev.employeeCount,
      isCurrency: false,
    },
    {
      label: "Regular hours",
      previous: prev.hoursWorked,
      current: curr.hoursWorked,
      delta: round2(curr.hoursWorked - prev.hoursWorked),
      isCurrency: false,
    },
    {
      label: "Reg OT hours",
      previous: prev.regOTHours,
      current: curr.regOTHours,
      delta: round2(curr.regOTHours - prev.regOTHours),
      isCurrency: false,
    },
    {
      label: "SIL cutoff accrual",
      previous: prev.silCutoff,
      current: curr.silCutoff,
      delta: round2(curr.silCutoff - prev.silCutoff),
      isCurrency: true,
    },
  ];
}

export function metricsFromUploadRecord(
  upload: PayrollSummaryMetrics & { employees?: PayrollRegisterRow[] }
): PayrollSummaryMetrics {
  return {
    periodStart: upload.periodStart,
    periodEnd: upload.periodEnd,
    employeeCount: upload.employeeCount,
    hoursWorkedTotal: upload.hoursWorkedTotal,
    regOTHoursTotal: upload.regOTHoursTotal,
    silTotal: upload.silTotal,
    silCutoffTotal: upload.silCutoffTotal,
    grossAmountTotal: upload.grossAmountTotal,
    netAmountTotal: upload.netAmountTotal,
    totalOTAmount: upload.totalOTAmount,
    companyName: upload.companyName,
    payoutDate: upload.payoutDate,
    sourceFormat: upload.sourceFormat,
    employees: upload.employees ?? [],
  };
}
