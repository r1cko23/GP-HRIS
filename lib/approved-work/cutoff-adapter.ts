import {
  deriveChargeLines,
  type DerivedChargeLine,
} from "./derive-charge-lines";

export type ApprovedWorkAdapterLine = {
  id: string;
  sourceCutoffHoursId: string | null;
  directoryEmployeeId: string;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
  regularHours: number;
  payable: boolean;
  billable: boolean;
  payableAdjustmentAmount?: number;
  billableAdjustmentAmount?: number;
};

export type CutoffHoursRateRow = {
  id: string;
  directoryEmployeeId: string;
  dailyRatePayroll: number | string | null;
};

export type DirectoryRateRow = {
  directoryEmployeeId: string;
  payrollDailyRate: number | string | null;
  billingDailyRate: number | string | null;
};

export type DraftChargeLinePair = {
  approvedWorkLineId: string;
  sourceCutoffHoursId: string | null;
  rates: {
    payrollDailyRate: number;
    billingDailyRate: number;
    payrollHourlyRate: number;
    billingHourlyRate: number;
  };
  payable: DerivedChargeLine;
  billable: DerivedChargeLine;
};

function rate(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Converts immutable approved work into parallel draft charge-line payloads.
 * DirectoryRateRow is expected to contain the caller's effective-dated
 * placement rate, with employee rate fallback already resolved.
 */
export function buildDraftChargeLinesFromCutoff(input: {
  approvedWorkLines: ApprovedWorkAdapterLine[];
  cutoffHours: CutoffHoursRateRow[];
  directoryRates: DirectoryRateRow[];
  hoursPerDay?: number;
}): DraftChargeLinePair[] {
  const hoursPerDay = rate(input.hoursPerDay) || 8;
  const cutoffById = new Map(input.cutoffHours.map((row) => [row.id, row]));
  const directoryByEmployee = new Map(
    input.directoryRates.map((row) => [row.directoryEmployeeId, row])
  );

  return input.approvedWorkLines.map((line) => {
    const cutoff = line.sourceCutoffHoursId
      ? cutoffById.get(line.sourceCutoffHoursId)
      : undefined;
    const directory = directoryByEmployee.get(line.directoryEmployeeId);
    const payrollDailyRate =
      rate(cutoff?.dailyRatePayroll) || rate(directory?.payrollDailyRate);
    const billingDailyRate = rate(directory?.billingDailyRate);
    const payrollHourlyRate = payrollDailyRate / hoursPerDay;
    const billingHourlyRate = billingDailyRate / hoursPerDay;
    const charges = deriveChargeLines({
      approvedWorkLineId: line.id,
      directoryEmployeeId: line.directoryEmployeeId,
      employeeCode: line.employeeCode,
      firstName: line.firstName,
      lastName: line.lastName,
      regularHours: line.regularHours,
      payable: line.payable,
      billable: line.billable,
      payrollHourlyRate,
      billingHourlyRate,
      payableAdjustmentAmount: line.payableAdjustmentAmount,
      billableAdjustmentAmount: line.billableAdjustmentAmount,
    });

    return {
      approvedWorkLineId: line.id,
      sourceCutoffHoursId: line.sourceCutoffHoursId,
      rates: {
        payrollDailyRate,
        billingDailyRate,
        payrollHourlyRate,
        billingHourlyRate,
      },
      ...charges,
    };
  });
}
