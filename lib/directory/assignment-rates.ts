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

/**
 * Salary fields for employee PATCH / onboard Assignment.
 * Empty strings are omitted — never send null that wipes a stamped card rate.
 */
export function salaryFieldsForEmployeePatch(form: {
  daily_rate: string;
  billing_daily_rate: string;
  ecola?: string;
}): {
  daily_rate?: number;
  billing_daily_rate?: number;
  ecola?: number | null;
} {
  const out: {
    daily_rate?: number;
    billing_daily_rate?: number;
    ecola?: number | null;
  } = {};
  const daily = form.daily_rate.trim();
  if (daily !== "") {
    const n = Number(daily);
    if (Number.isFinite(n)) out.daily_rate = n;
  }
  const billing = form.billing_daily_rate.trim();
  if (billing !== "") {
    const n = Number(billing);
    if (Number.isFinite(n)) out.billing_daily_rate = n;
  }
  if (form.ecola !== undefined) {
    const ecola = form.ecola.trim();
    out.ecola = ecola === "" ? null : Number(ecola);
    if (out.ecola != null && !Number.isFinite(out.ecola)) {
      delete out.ecola;
    }
  }
  return out;
}
