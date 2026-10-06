import { formatDailyRateInput } from "@/lib/ph-payroll/rate-precision";

export type AssignmentRateCard = {
  payroll_daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
};

export type AssignmentFormRates = {
  daily_rate: string;
  billing_daily_rate: string;
};

/**
 * Hire assignment rates.
 * Payroll fills from the approved position when the position changes or the
 * field is still blank. Billing always follows the position card and is not
 * typed on the person.
 */
export function nextAssignmentFormRates(input: {
  positionChanged: boolean;
  currentDailyRate: string;
  card: AssignmentRateCard | null;
}): AssignmentFormRates {
  if (!input.card) {
    if (!input.positionChanged) {
      return {
        daily_rate: input.currentDailyRate,
        billing_daily_rate: "",
      };
    }
    return { daily_rate: "", billing_daily_rate: "" };
  }

  const fromCard = {
    daily_rate: formatDailyRateInput(input.card.payroll_daily_rate),
    billing_daily_rate: formatDailyRateInput(input.card.billing_daily_rate),
  };

  return {
    daily_rate:
      input.positionChanged || input.currentDailyRate.trim() === ""
        ? fromCard.daily_rate
        : input.currentDailyRate,
    billing_daily_rate: fromCard.billing_daily_rate,
  };
}
