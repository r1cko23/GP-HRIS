import type {
  PayrollSummaryDiff,
  PayrollSummaryDiffField,
  PayrollSummaryMetrics,
} from "./types";

const DIFF_FIELDS: Array<{
  key: PayrollSummaryDiffField["key"];
  label: string;
}> = [
  { key: "employeeCount", label: "Employees" },
  { key: "hoursWorkedTotal", label: "Hours Worked" },
  { key: "regOTHoursTotal", label: "Reg OT Hours" },
  { key: "totalOTAmount", label: "Total OT Amount" },
  { key: "silTotal", label: "SIL Amount" },
  { key: "silCutoffTotal", label: "SIL Cutoff" },
  { key: "grossAmountTotal", label: "Gross Pay" },
  { key: "netAmountTotal", label: "Net Pay" },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeDelta(
  previous: number | null,
  current: number | null
): { delta: number | null; deltaPercent: number | null } {
  if (previous == null || current == null) {
    return { delta: null, deltaPercent: null };
  }
  const delta = round2(current - previous);
  const deltaPercent =
    previous === 0
      ? current === 0
        ? 0
        : null
      : round2((delta / previous) * 100);
  return { delta, deltaPercent };
}

export function diffPayrollSummary(
  current: PayrollSummaryMetrics,
  previous: PayrollSummaryMetrics | null
): PayrollSummaryDiff {
  const fields: PayrollSummaryDiffField[] = DIFF_FIELDS.map(({ key, label }) => {
    const currentValue = current[key] as number | null;
    const previousValue = previous
      ? (previous[key] as number | null)
      : null;
    const { delta, deltaPercent } = computeDelta(
      previousValue,
      currentValue ?? null
    );

    return {
      key,
      label,
      previous: previousValue,
      current: currentValue ?? 0,
      delta,
      deltaPercent,
    };
  });

  return {
    fields,
    hasPrevious: previous != null,
  };
}
