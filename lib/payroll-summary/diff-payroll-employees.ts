import { normalizeEmployeeName } from "./normalize-name";
import type { PayrollEmployeeRow, PayrollSummaryMetrics } from "./types";

export interface EmployeeAnomalyRow {
  name: string;
  status: "added" | "removed" | "changed";
  hoursWorked: number | null;
  grossAmount: number | null;
  silCutoff: number | null;
  hoursDelta: number | null;
  grossDelta: number | null;
  silCutoffDelta: number | null;
}

export interface PayrollEmployeeAnomalies {
  added: EmployeeAnomalyRow[];
  removed: EmployeeAnomalyRow[];
  changed: EmployeeAnomalyRow[];
  hasBaseline: boolean;
  baselinePeriodStart: string | null;
  baselinePeriodEnd: string | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toAnomalyRow(
  emp: PayrollEmployeeRow,
  status: EmployeeAnomalyRow["status"],
  prev?: PayrollEmployeeRow
): EmployeeAnomalyRow {
  return {
    name: emp.name,
    status,
    hoursWorked: emp.hoursWorked,
    grossAmount: emp.grossAmount,
    silCutoff: emp.silCutoff,
    hoursDelta: prev ? round2(emp.hoursWorked - prev.hoursWorked) : null,
    grossDelta: prev ? round2(emp.grossAmount - prev.grossAmount) : null,
    silCutoffDelta: prev ? round2(emp.silCutoff - prev.silCutoff) : null,
  };
}

/**
 * Compare employee rosters between two payroll register parses.
 * Used to detect added/removed/changed employees (plantilla derived from register).
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
      hasBaseline: false,
      baselinePeriodStart: null,
      baselinePeriodEnd: null,
    };
  }

  const prevMap = new Map(
    previous.employees.map((e) => [normalizeEmployeeName(e.name), e])
  );
  const currMap = new Map(
    current.employees.map((e) => [normalizeEmployeeName(e.name), e])
  );

  const added: EmployeeAnomalyRow[] = [];
  const changed: EmployeeAnomalyRow[] = [];

  for (const emp of current.employees) {
    const key = normalizeEmployeeName(emp.name);
    const prev = prevMap.get(key);
    if (!prev) {
      added.push(toAnomalyRow(emp, "added"));
      continue;
    }
    const row = toAnomalyRow(emp, "changed", prev);
    if (
      row.hoursDelta !== 0 ||
      row.grossDelta !== 0 ||
      row.silCutoffDelta !== 0
    ) {
      changed.push(row);
    }
  }

  const removed: EmployeeAnomalyRow[] = [];
  for (const emp of previous.employees) {
    const key = normalizeEmployeeName(emp.name);
    if (!currMap.has(key)) {
      removed.push({
        name: emp.name,
        status: "removed",
        hoursWorked: emp.hoursWorked,
        grossAmount: emp.grossAmount,
        silCutoff: emp.silCutoff,
        hoursDelta: null,
        grossDelta: null,
        silCutoffDelta: null,
      });
    }
  }

  added.sort((a, b) => a.name.localeCompare(b.name));
  removed.sort((a, b) => a.name.localeCompare(b.name));
  changed.sort(
    (a, b) =>
      Math.abs(b.silCutoffDelta ?? 0) - Math.abs(a.silCutoffDelta ?? 0) ||
      Math.abs(b.grossDelta ?? 0) - Math.abs(a.grossDelta ?? 0)
  );

  return {
    added,
    removed,
    changed,
    hasBaseline: true,
    baselinePeriodStart: previous.periodStart || null,
    baselinePeriodEnd: previous.periodEnd || null,
  };
}
