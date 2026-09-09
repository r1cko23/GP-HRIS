import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";

export type BillingFromPayrollCostPlan =
  | { action: "noop" }
  | { action: "skip"; reason: string }
  | {
      action: "lift";
      employeeId: string;
      billing_daily_rate: number;
    };

function asRate(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * When GREENHRISMAIN has no billing card, Deployed clients bill at payroll
 * cost plus admin fee. Copy daily_rate onto billing_daily_rate.
 * Does not change status or employee_code.
 */
export function planBillingRateFromPayrollCost(input: {
  employeeId: string;
  billing_daily_rate: number | string | null;
  daily_rate: number | string | null;
}): BillingFromPayrollCostPlan {
  const payroll = roundDailyRate4(asRate(input.daily_rate));
  if (payroll <= 0) return { action: "skip", reason: "no_payroll_rate" };
  const billing = roundDailyRate4(asRate(input.billing_daily_rate));
  if (billing > 0) return { action: "noop" };
  return {
    action: "lift",
    employeeId: input.employeeId,
    billing_daily_rate: payroll,
  };
}
