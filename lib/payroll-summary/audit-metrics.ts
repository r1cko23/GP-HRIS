import type { PayrollRegisterRow } from "./register-columns";
import { sumOTPayComponents } from "./register-columns";
import { totalsFromMetrics } from "./category-breakdown";
import type {
  PayrollEmployeeAnomalies,
  PayrollSummaryMetrics,
} from "./types";

export type AuditMetricKind = "count" | "hours" | "currency";

export interface AuditMetricDefinition {
  key: string;
  label: string;
  kind: AuditMetricKind;
  /** Register fields used to count employee-level anomalies */
  anomalyFieldKeys: Array<keyof PayrollRegisterRow>;
}

/** Manning & payroll drivers tracked for audit review. */
export const AUDIT_TRACKED_METRICS: AuditMetricDefinition[] = [
  {
    key: "employeeCount",
    label: "Manning / employees",
    kind: "count",
    anomalyFieldKeys: [],
  },
  {
    key: "hoursWorked",
    label: "Regular hours",
    kind: "hours",
    anomalyFieldKeys: ["hoursWorked"],
  },
  {
    key: "totalSalary",
    label: "Regular pay amount",
    kind: "currency",
    anomalyFieldKeys: ["totalSalary", "basicSalary"],
  },
  {
    key: "silHours",
    label: "SIL hours",
    kind: "hours",
    anomalyFieldKeys: [],
  },
  {
    key: "silAmount",
    label: "SIL amount",
    kind: "currency",
    anomalyFieldKeys: ["serviceIncentiveLeaveAmount", "silCutoff"],
  },
  {
    key: "holidayHours",
    label: "Holiday hours",
    kind: "hours",
    anomalyFieldKeys: ["specialHolidayHours", "specialHolidayOTHours", "restdayHours"],
  },
  {
    key: "holidayPay",
    label: "Holiday pay amount",
    kind: "currency",
    anomalyFieldKeys: [
      "specialHolidayAmount",
      "specialHolidayOTAmount",
      "restdayAmount",
    ],
  },
  {
    key: "salaryLoan",
    label: "Salary loan amount",
    kind: "currency",
    anomalyFieldKeys: ["sssLoan"],
  },
  {
    key: "totalOTHours",
    label: "Total OT hours",
    kind: "hours",
    anomalyFieldKeys: [
      "regOTHours",
      "nightDiffHours",
      "specialHolidayOTHours",
      "restdayHours",
    ],
  },
  {
    key: "totalOTAmount",
    label: "Total OT amount",
    kind: "currency",
    anomalyFieldKeys: [
      "totalOTAmount",
      "regOTAmount",
      "nightDiffAmount",
      "regNightdiffOTAmount",
    ],
  },
];

export interface AuditMetricTotals {
  employeeCount: number;
  hoursWorked: number;
  totalSalary: number;
  silHours: number | null;
  silAmount: number;
  holidayHours: number;
  holidayPay: number;
  salaryLoan: number;
  totalOTHours: number;
  totalOTAmount: number;
}

export interface AuditMetricAnomalySummary {
  /** Employees with any movement on this metric */
  affected: number;
  /** Added employees with non-zero values (manning / ghost risk) */
  added: number;
  /** Removed employees */
  removed: number;
  /** Changed or renamed with field delta */
  changed: number;
  /** Subset with positive delta (cost / hours increase) */
  increases: number;
}

export interface AuditMetricRow {
  key: string;
  label: string;
  kind: AuditMetricKind;
  previous: number | null;
  current: number;
  delta: number | null;
  deltaPercent: number | null;
  /** False when register has no column (e.g. SIL hours) */
  tracked: boolean;
  anomalies: AuditMetricAnomalySummary;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumFromEmployees(metrics: PayrollSummaryMetrics): AuditMetricTotals | null {
  if (!metrics.employees?.length) return null;

  let silAmount = 0;
  let holidayHours = 0;
  let holidayPay = 0;
  let salaryLoan = 0;
  let totalOTHours = 0;
  let totalOTAmount = 0;

  for (const emp of metrics.employees) {
    silAmount += (emp.serviceIncentiveLeaveAmount ?? 0) + (emp.silCutoff ?? 0);
    holidayHours +=
      (emp.specialHolidayHours ?? 0) +
      (emp.specialHolidayOTHours ?? 0) +
      (emp.restdayHours ?? 0);
    holidayPay +=
      (emp.specialHolidayAmount ?? 0) +
      (emp.specialHolidayOTAmount ?? 0) +
      (emp.restdayAmount ?? 0);
    salaryLoan += emp.sssLoan ?? 0;
    totalOTHours +=
      (emp.regOTHours ?? 0) +
      (emp.nightDiffHours ?? 0) +
      (emp.regNightdiffOTHours ?? 0) +
      (emp.specialHolidayOTHours ?? 0) +
      (emp.restdayHours ?? 0);
    const otPay = sumOTPayComponents(emp);
    totalOTAmount += otPay > 0 ? otPay : (emp.totalOTAmount ?? 0);
  }

  const categories = totalsFromMetrics(metrics);

  return {
    employeeCount: metrics.employeeCount,
    hoursWorked: categories.hoursWorked,
    totalSalary: categories.totalSalary,
    silHours: null,
    silAmount: round2(silAmount),
    holidayHours: round2(holidayHours),
    holidayPay: round2(holidayPay),
    salaryLoan: round2(salaryLoan),
    totalOTHours: round2(totalOTHours),
    totalOTAmount: round2(
      totalOTAmount > 0
        ? totalOTAmount
        : categories.regOTAmount +
            categories.nightDiffAmount +
            categories.regNightdiffOTAmount +
            categories.specialHolidayAmount +
            categories.specialHolidayOTAmount +
            categories.restdayAmount
    ),
  };
}

function sumFromAggregates(metrics: PayrollSummaryMetrics): AuditMetricTotals {
  const categories = totalsFromMetrics(metrics);
  const ot = metrics.totalOTAmount ?? categories.totalOTAmount ?? 0;
  const sil = metrics.silTotal ?? categories.serviceIncentiveLeaveAmount ?? 0;

  return {
    employeeCount: metrics.employeeCount,
    hoursWorked: metrics.hoursWorkedTotal,
    totalSalary: categories.totalSalary,
    silHours: null,
    silAmount: round2(sil + (metrics.silCutoffTotal ?? 0)),
    holidayHours: 0,
    holidayPay: round2(
      categories.specialHolidayAmount +
        categories.specialHolidayOTAmount +
        categories.restdayAmount
    ),
    salaryLoan: round2(categories.sssLoan),
    totalOTHours: round2(metrics.regOTHoursTotal),
    totalOTAmount: round2(ot),
  };
}

export function sumAuditMetricTotals(
  metrics: PayrollSummaryMetrics
): AuditMetricTotals {
  return sumFromEmployees(metrics) ?? sumFromAggregates(metrics);
}

function valueForKey(
  totals: AuditMetricTotals,
  key: string
): { value: number; tracked: boolean } {
  switch (key) {
    case "employeeCount":
      return { value: totals.employeeCount, tracked: true };
    case "hoursWorked":
      return { value: totals.hoursWorked, tracked: true };
    case "totalSalary":
      return { value: totals.totalSalary, tracked: true };
    case "silHours":
      return {
        value: totals.silHours ?? 0,
        tracked: totals.silHours != null,
      };
    case "silAmount":
      return { value: totals.silAmount, tracked: true };
    case "holidayHours":
      return { value: totals.holidayHours, tracked: true };
    case "holidayPay":
      return { value: totals.holidayPay, tracked: true };
    case "salaryLoan":
      return { value: totals.salaryLoan, tracked: true };
    case "totalOTHours":
      return { value: totals.totalOTHours, tracked: true };
    case "totalOTAmount":
      return { value: totals.totalOTAmount, tracked: true };
    default:
      return { value: 0, tracked: false };
  }
}

function rowTouchesMetric(
  fieldKeys: Array<keyof PayrollRegisterRow>,
  fieldKey: string
): boolean {
  if (fieldKeys.length === 0) return false;
  return fieldKeys.includes(fieldKey as keyof PayrollRegisterRow);
}

function summarizeMetricAnomalies(
  metricKey: string,
  fieldKeys: Array<keyof PayrollRegisterRow>,
  anomalies: PayrollEmployeeAnomalies | null
): AuditMetricAnomalySummary {
  const empty: AuditMetricAnomalySummary = {
    affected: 0,
    added: 0,
    removed: 0,
    changed: 0,
    increases: 0,
  };

  if (!anomalies?.hasBaseline) return empty;

  if (metricKey === "employeeCount") {
    return {
      affected: anomalies.added.length + anomalies.removed.length,
      added: anomalies.added.length,
      removed: anomalies.removed.length,
      changed: 0,
      increases: anomalies.added.filter((r) =>
        r.riskFlags.includes("potential_ghost")
      ).length,
    };
  }

  let affected = 0;
  let added = 0;
  let removed = 0;
  let changed = 0;
  let increases = 0;

  for (const row of anomalies.added) {
    const relevant = row.fieldChanges.filter(
      (c) => rowTouchesMetric(fieldKeys, c.key) && c.current !== 0
    );
    if (relevant.length === 0) continue;
    added += 1;
    affected += 1;
    if (relevant.some((c) => c.delta > 0)) increases += 1;
  }

  if (metricKey === "employeeCount") {
    removed = anomalies.removed.length;
    affected += removed;
  }

  for (const row of [...anomalies.changed, ...anomalies.renamed]) {
    const relevant = row.fieldChanges.filter((c) =>
      rowTouchesMetric(fieldKeys, c.key)
    );
    if (relevant.length === 0) continue;
    changed += 1;
    affected += 1;
    if (relevant.some((c) => c.delta > 0)) increases += 1;
  }

  return { affected, added, removed, changed, increases };
}

function computeDelta(
  previous: number | null,
  current: number
): { delta: number | null; deltaPercent: number | null } {
  if (previous == null) return { delta: null, deltaPercent: null };
  const delta = round2(current - previous);
  const deltaPercent =
    previous === 0
      ? current === 0
        ? 0
        : null
      : round2((delta / previous) * 100);
  return { delta, deltaPercent };
}

export interface AuditMetricsSummary {
  rows: AuditMetricRow[];
  hasPrevious: boolean;
  currentPeriodLabel: string | null;
  previousPeriodLabel: string | null;
}

export function buildAuditMetricsSummary(
  current: PayrollSummaryMetrics,
  previous: PayrollSummaryMetrics | null,
  anomalies: PayrollEmployeeAnomalies | null,
  options?: {
    currentPeriodLabel?: string | null;
    previousPeriodLabel?: string | null;
  }
): AuditMetricsSummary {
  const currTotals = sumAuditMetricTotals(current);
  const prevTotals = previous ? sumAuditMetricTotals(previous) : null;

  const rows: AuditMetricRow[] = AUDIT_TRACKED_METRICS.map((def) => {
    const tracked = def.key !== "silHours";
    const curr = valueForKey(currTotals, def.key);
    const prev = prevTotals ? valueForKey(prevTotals, def.key) : null;
    const previousValue =
      tracked && prev?.tracked ? prev.value : tracked ? prev?.value ?? null : null;
    const { delta, deltaPercent } = computeDelta(
      tracked ? previousValue : null,
      curr.value
    );

    return {
      key: def.key,
      label: def.label,
      kind: def.kind,
      previous: tracked ? previousValue : null,
      current: curr.value,
      delta: tracked ? delta : null,
      deltaPercent: tracked ? deltaPercent : null,
      tracked,
      anomalies: summarizeMetricAnomalies(
        def.key,
        def.anomalyFieldKeys,
        anomalies
      ),
    };
  });

  return {
    rows,
    hasPrevious: previous != null,
    currentPeriodLabel: options?.currentPeriodLabel ?? null,
    previousPeriodLabel: options?.previousPeriodLabel ?? null,
  };
}
