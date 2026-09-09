import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";

export type Later201Person = {
  id: string;
  employee_code: string | null;
  daily_rate: number | string | null;
  position_id: string | null;
  billing_daily_rate?: number | string | null;
};

export type MasterRatePlan =
  | { action: "noop" }
  | { action: "skip"; reason: string }
  | {
      action: "lift";
      employeeId: string;
      daily_rate: number;
      position_id: string | null;
      keep_employee_code: string | null;
    };

function asRate(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Copy payroll daily_rate (and position card) from a later duplicate 201
 * onto the CSM original. Never copies billing_daily_rate. Never changes
 * employee_code.
 */
export function planMasterRateFromLater201(input: {
  master: Later201Person;
  later: Later201Person;
}): MasterRatePlan {
  const laterRate = roundDailyRate4(asRate(input.later.daily_rate));
  if (laterRate <= 0) {
    return { action: "skip", reason: "later_has_no_rate" };
  }

  const masterRate = roundDailyRate4(asRate(input.master.daily_rate));
  const sameRate = Math.abs(masterRate - laterRate) < 0.0001;
  const samePosition = (input.master.position_id ?? null) === (input.later.position_id ?? null);
  if (sameRate && samePosition) {
    return { action: "noop" };
  }

  return {
    action: "lift",
    employeeId: input.master.id,
    daily_rate: laterRate,
    position_id: input.later.position_id ?? null,
    keep_employee_code: input.master.employee_code,
  };
}
