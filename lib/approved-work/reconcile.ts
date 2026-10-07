export type ReconciliationStatus =
  | "matched"
  | "pay_only"
  | "bill_only"
  | "variance";

type ApprovedWorkRow = {
  id: string;
  payable: boolean;
  billable: boolean;
  [key: string]: unknown;
};

type ChargeRow = {
  approvedWorkLineId: string;
  totalAmount: number | string | null;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function totalsByWorkLine(lines: ChargeRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const amount = Number(line.totalAmount ?? 0);
    totals.set(
      line.approvedWorkLineId,
      money((totals.get(line.approvedWorkLineId) ?? 0) + (Number.isFinite(amount) ? amount : 0))
    );
  }
  return totals;
}

export function reconcileApprovedWorkLines<T extends ApprovedWorkRow>(input: {
  approvedWorkLines: T[];
  payableLines: ChargeRow[];
  billableLines: ChargeRow[];
}): Array<
  T & {
    payableAmount: number;
    billableAmount: number;
    varianceAmount: number;
    reconciliationStatus: ReconciliationStatus;
  }
> {
  const payableByWork = totalsByWorkLine(input.payableLines);
  const billableByWork = totalsByWorkLine(input.billableLines);

  return input.approvedWorkLines.map((work) => {
    const payableAmount = payableByWork.get(work.id) ?? 0;
    const billableAmount = billableByWork.get(work.id) ?? 0;
    const varianceAmount = money(billableAmount - payableAmount);
    let reconciliationStatus: ReconciliationStatus = "matched";
    if (payableAmount !== 0 && billableAmount === 0) {
      reconciliationStatus = "pay_only";
    } else if (payableAmount === 0 && billableAmount !== 0) {
      reconciliationStatus = "bill_only";
    } else if (varianceAmount !== 0) {
      reconciliationStatus = "variance";
    }

    return {
      ...work,
      payableAmount,
      billableAmount,
      varianceAmount,
      reconciliationStatus,
    };
  });
}
