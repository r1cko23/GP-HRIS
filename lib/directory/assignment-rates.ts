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

/**
 * Read-only rate line for Add employee Identity.
 * Placement is completed there, so Onboard skips Assignment — HR still needs
 * to see what the approved card will stamp.
 */
export function hirePlacementRatePreview(
  card: AssignmentRateCard | null | undefined
): AssignmentFormRates | null {
  if (!card) return null;
  const daily = formatDailyRateInput(card.payroll_daily_rate);
  if (!daily) return null;
  return {
    daily_rate: daily,
    billing_daily_rate: formatDailyRateInput(card.billing_daily_rate),
  };
}

/**
 * Position dropdown label on Add employee.
 * When salary access is on, append payroll / billing so HR does not guess.
 */
export function hirePositionOptionLabel(input: {
  jobTitle: string;
  card: AssignmentRateCard | null | undefined;
  showRates: boolean;
}): string {
  const title = input.jobTitle.trim() || "Position";
  if (!input.showRates) return title;
  const rates = hirePlacementRatePreview(input.card);
  if (!rates) return title;
  const billing = rates.billing_daily_rate || "—";
  return `${title} · ${rates.daily_rate} / bill ${billing}`;
}
