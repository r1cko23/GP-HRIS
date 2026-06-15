import {
  computeEmployeeFieldChanges,
  computeManpowerCostDelta,
  deriveRiskFlags,
  topCostChangeLabel,
} from "./anomaly-fields";
import { findRenamePairs } from "./employee-name-match";
import { normalizeEmployeeName } from "./normalize-name";
import type {
  EmployeeAnomalyRow,
  PayrollEmployeeAnomalies,
  PayrollEmployeeRow,
  PayrollSummaryMetrics,
} from "./types";

function pickSnapshot(emp: PayrollEmployeeRow) {
  return {
    hoursWorked: emp.hoursWorked,
    daysWorked: emp.daysWorked,
    grossAmount: emp.grossAmount,
    netAmount: emp.netAmount,
    silCutoff: emp.silCutoff,
  };
}

function buildComparedRow(
  status: EmployeeAnomalyRow["status"],
  current: PayrollEmployeeRow,
  previous?: PayrollEmployeeRow,
  matchScore?: number
): EmployeeAnomalyRow {
  const fieldChanges = previous
    ? computeEmployeeFieldChanges(previous, current)
    : computeEmployeeFieldChanges(emptyRow(), current).filter((c) => c.current !== 0);

  const manpowerCostDelta =
    status === "added"
      ? Math.max(0, current.grossAmount)
      : computeManpowerCostDelta(fieldChanges);

  const hoursDelta = previous
    ? fieldChanges.find((c) => c.key === "hoursWorked")?.delta ?? 0
    : null;
  const grossDelta = previous
    ? fieldChanges.find((c) => c.key === "grossAmount")?.delta ?? 0
    : null;
  const netDelta = previous
    ? fieldChanges.find((c) => c.key === "netAmount")?.delta ?? 0
    : null;
  const silCutoffDelta = previous
    ? fieldChanges.find((c) => c.key === "silCutoff")?.delta ?? 0
    : null;

  return {
    name: current.name,
    previousName: previous?.name ?? null,
    status,
    matchScore: matchScore ?? null,
    riskFlags: deriveRiskFlags(status, current, fieldChanges),
    manpowerCostDelta,
    ...pickSnapshot(current),
    hoursDelta,
    grossDelta,
    netDelta,
    silCutoffDelta,
    fieldChanges,
    topChangeLabel: topCostChangeLabel(fieldChanges),
  };
}

function buildRemovedRow(previous: PayrollEmployeeRow): EmployeeAnomalyRow {
  return {
    name: previous.name,
    previousName: null,
    status: "removed",
    matchScore: null,
    riskFlags: [],
    manpowerCostDelta: 0,
    ...pickSnapshot(previous),
    hoursDelta: null,
    grossDelta: null,
    netDelta: null,
    silCutoffDelta: null,
    fieldChanges: [],
    topChangeLabel: null,
  };
}

function emptyRow(): PayrollEmployeeRow {
  return {
    name: "",
    dailyRate: 0,
    hoursWorked: 0,
    daysWorked: 0,
    basicSalary: 0,
    totalSalary: 0,
    regOTHours: 0,
    regOTAmount: 0,
    nightDiffHours: 0,
    nightDiffAmount: 0,
    regNightdiffOTHours: 0,
    regNightdiffOTAmount: 0,
    specialHolidayHours: 0,
    specialHolidayAmount: 0,
    specialHolidayOTHours: 0,
    specialHolidayOTAmount: 0,
    restdayHours: 0,
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
    thirteenthMonthCutoff: 0,
    silCutoff: 0,
    thirteenthMonthYTD: 0,
  };
}

function sortByManpowerRisk(rows: EmployeeAnomalyRow[]): EmployeeAnomalyRow[] {
  return [...rows].sort(
    (a, b) =>
      b.manpowerCostDelta - a.manpowerCostDelta ||
      Math.abs(b.hoursDelta ?? 0) - Math.abs(a.hoursDelta ?? 0) ||
      a.name.localeCompare(b.name)
  );
}

function sortAdded(rows: EmployeeAnomalyRow[]): EmployeeAnomalyRow[] {
  return [...rows].sort((a, b) => {
    const aGhost = a.riskFlags.includes("potential_ghost") ? 1 : 0;
    const bGhost = b.riskFlags.includes("potential_ghost") ? 1 : 0;
    return (
      bGhost - aGhost ||
      b.manpowerCostDelta - a.manpowerCostDelta ||
      a.name.localeCompare(b.name)
    );
  });
}

/**
 * Compare employee rosters between two payroll register parses.
 * Detects ghost employees, illegal hour/pay insertions, and likely renames.
 */
export function diffPayrollEmployees(
  current: PayrollSummaryMetrics,
  previous: PayrollSummaryMetrics | null
): PayrollEmployeeAnomalies {
  if (!previous) {
    return {
      added: [],
      removed: [],
      changed: [],
      renamed: [],
      hasBaseline: false,
      baselinePeriodStart: null,
      baselinePeriodEnd: null,
    };
  }

  const prevByKey = new Map(
    previous.employees.map((e) => [normalizeEmployeeName(e.name), e])
  );
  const currByKey = new Map(
    current.employees.map((e) => [normalizeEmployeeName(e.name), e])
  );

  const matchedPrevKeys = new Set<string>();
  const matchedCurrKeys = new Set<string>();
  const changed: EmployeeAnomalyRow[] = [];

  for (const emp of current.employees) {
    const key = normalizeEmployeeName(emp.name);
    const prev = prevByKey.get(key);
    if (!prev) continue;

    matchedPrevKeys.add(key);
    matchedCurrKeys.add(key);

    const row = buildComparedRow("changed", emp, prev);
    if (row.fieldChanges.length > 0) {
      changed.push(row);
    }
  }

  const unmatchedCurrent = current.employees.filter(
    (e) => !matchedCurrKeys.has(normalizeEmployeeName(e.name))
  );
  const unmatchedPrevious = previous.employees.filter(
    (e) => !matchedPrevKeys.has(normalizeEmployeeName(e.name))
  );

  const renamePairs = findRenamePairs(unmatchedCurrent, unmatchedPrevious);
  const renamed: EmployeeAnomalyRow[] = [];
  const renamedCurrentKeys = new Set<string>();
  const renamedPrevKeys = new Set<string>();

  for (const pair of renamePairs) {
    const currKey = normalizeEmployeeName(pair.current.name);
    const prevKey = normalizeEmployeeName(pair.previous.name);
    renamedCurrentKeys.add(currKey);
    renamedPrevKeys.add(prevKey);

    const row = buildComparedRow("renamed", pair.current, pair.previous, pair.score);
    renamed.push(row);
  }

  const added: EmployeeAnomalyRow[] = [];
  for (const emp of unmatchedCurrent) {
    const key = normalizeEmployeeName(emp.name);
    if (renamedCurrentKeys.has(key)) continue;
    added.push(buildComparedRow("added", emp));
  }

  const removed: EmployeeAnomalyRow[] = [];
  for (const emp of unmatchedPrevious) {
    const key = normalizeEmployeeName(emp.name);
    if (renamedPrevKeys.has(key)) continue;
    removed.push(buildRemovedRow(emp));
  }

  return {
    added: sortAdded(added),
    removed: removed.sort((a, b) => a.name.localeCompare(b.name)),
    changed: sortByManpowerRisk(changed),
    renamed: sortByManpowerRisk(renamed),
    hasBaseline: true,
    baselinePeriodStart: previous.periodStart || null,
    baselinePeriodEnd: previous.periodEnd || null,
  };
}

export function hasEmployeeAnomalies(anomalies: PayrollEmployeeAnomalies): boolean {
  return (
    anomalies.added.length > 0 ||
    anomalies.removed.length > 0 ||
    anomalies.changed.length > 0 ||
    anomalies.renamed.length > 0
  );
}
