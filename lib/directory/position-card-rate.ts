import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";

export type PositionCardRatePlan =
  | { action: "noop" }
  | { action: "skip"; reason: string }
  | {
      action: "lift";
      employeeId: string;
      daily_rate: number;
      keep_employee_code: string | null;
    };

function asRate(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Copy Directory position.payroll_daily_rate onto the person daily_rate.
 * Does not invent a rate from a payroll scrape. Does not copy billing.
 */
export function planRateFromPositionCard(input: {
  employeeId: string;
  employee_code: string | null;
  daily_rate: number | string | null;
  position_payroll_daily_rate: number | string | null;
}): PositionCardRatePlan {
  const card = roundDailyRate4(asRate(input.position_payroll_daily_rate));
  if (card <= 0) {
    return { action: "skip", reason: "no_position_rate" };
  }
  const person = roundDailyRate4(asRate(input.daily_rate));
  if (Math.abs(person - card) < 0.0001) {
    return { action: "noop" };
  }
  return {
    action: "lift",
    employeeId: input.employeeId,
    daily_rate: card,
    keep_employee_code: input.employee_code,
  };
}
