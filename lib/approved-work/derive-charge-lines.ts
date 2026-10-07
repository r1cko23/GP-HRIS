export type ApprovedWorkLineInput = {
  approvedWorkLineId: string;
  directoryEmployeeId: string;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
  regularHours: number;
  payable: boolean;
  billable: boolean;
  payrollHourlyRate: number;
  billingHourlyRate: number;
  payableAdjustmentAmount?: number;
  billableAdjustmentAmount?: number;
};

export type DerivedChargeLine = {
  approvedWorkLineId: string;
  directoryEmployeeId: string;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
  regularHours: number;
  baseAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
  rate: number;
  isChargeable: boolean;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finite(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function derive(
  input: ApprovedWorkLineInput,
  kind: "payable" | "billable"
): DerivedChargeLine {
  const enabled = kind === "payable" ? input.payable : input.billable;
  const rate =
    kind === "payable"
      ? finite(input.payrollHourlyRate)
      : finite(input.billingHourlyRate);
  const adjustmentAmount = money(
    finite(
      kind === "payable"
        ? input.payableAdjustmentAmount
        : input.billableAdjustmentAmount
    )
  );
  const baseAmount = money(
    enabled ? Math.max(0, finite(input.regularHours)) * rate : 0
  );

  return {
    approvedWorkLineId: input.approvedWorkLineId,
    directoryEmployeeId: input.directoryEmployeeId,
    employeeCode: input.employeeCode,
    firstName: input.firstName,
    lastName: input.lastName,
    regularHours: finite(input.regularHours),
    baseAmount,
    adjustmentAmount,
    totalAmount: money(baseAmount + adjustmentAmount),
    rate,
    isChargeable: enabled || adjustmentAmount !== 0,
  };
}

export function deriveChargeLines(input: ApprovedWorkLineInput): {
  payable: DerivedChargeLine;
  billable: DerivedChargeLine;
} {
  return {
    payable: derive(input, "payable"),
    billable: derive(input, "billable"),
  };
}
