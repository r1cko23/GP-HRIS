import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";

export type PositionCardRates = {
  payroll_daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
  ecola?: number | string | null;
  sea?: number | string | null;
  ctpa?: number | string | null;
  allowance?: number | string | null;
};

/** Full card rates. SEA/CTPA stay on the position; do not write them to the 201. */
export type AppliedCardRates = {
  daily_rate: number;
  /**
   * Null when the card's billing daily rate is 0. Callers must leave the
   * person's existing billing rate unchanged.
   */
  billing_daily_rate: number | null;
  ecola: number | null;
  sea: number | null;
  ctpa: number | null;
};

/**
 * MAIN-shaped person standing rates only.
 * ECOLA lives on the employee; SEA/CTPA live on the position card.
 */
export type AppliedPersonRates = {
  daily_rate: number;
  billing_daily_rate: number | null;
  ecola: number | null;
};

/** Pick the rates that may be stamped onto directory.employees. */
export function personStandingRatesFromCard(
  card: AppliedCardRates
): AppliedPersonRates {
  return {
    daily_rate: card.daily_rate,
    billing_daily_rate: card.billing_daily_rate,
    ecola: card.ecola,
  };
}

function asPositiveRate(value: number | string | null | undefined): number | null {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return roundDailyRate4(n);
}

function asOptionalRate(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return roundDailyRate4(n);
}

/**
 * Read approved position card rates (payroll, billing, ECOLA, SEA, CTPA).
 * Stamp only personStandingRatesFromCard(...) onto directory.employees —
 * SEA/CTPA stay on the card (MAIN parity).
 * Payroll must be a positive daily rate. A billing daily rate of 0 is a
 * grandfathered approved card: assign it, and do not replace the person's
 * billing rate (returned as null). A blank billing rate still blocks assign.
 */
export function applyPositionCardRates(
  card: PositionCardRates
):
  | { ok: true; rates: AppliedCardRates }
  | { ok: false; error: string } {
  const daily = asPositiveRate(card.payroll_daily_rate);
  const billing = asBillingRate(card.billing_daily_rate);
  if (daily == null || !billing.ok) {
    return {
      ok: false,
      error: "Approved position must have payroll and billing daily rates",
    };
  }
  return {
    ok: true,
    rates: {
      daily_rate: daily,
      billing_daily_rate: billing.rate,
      ecola: asOptionalRate(card.ecola),
      sea: asOptionalRate(card.sea),
      ctpa: asOptionalRate(card.ctpa),
    },
  };
}

/** 0 is an explicit billing rate that must not overwrite the person. Blank is missing. */
function asBillingRate(
  value: number | string | null | undefined
): { ok: true; rate: number | null } | { ok: false } {
  if (value == null || value === "") return { ok: false };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  if (n === 0) return { ok: true, rate: null };
  return { ok: true, rate: roundDailyRate4(n) };
}

export type AssignablePosition = {
  id: string;
  client_id: string;
  is_active: boolean;
  approval_status: string;
  job_title?: string | null;
  payroll_daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
  ecola?: number | string | null;
  sea?: number | string | null;
  ctpa?: number | string | null;
};

/**
 * Hire / transfer / rehire may only assign an approved + active card on the
 * destination client.
 */
export function assertAssignableApprovedPosition(input: {
  position: AssignablePosition | null;
  destinationClientId: string;
}):
  | { ok: true; position: AssignablePosition; rates: AppliedCardRates }
  | { ok: false; error: string; status: number } {
  if (!input.position) {
    return {
      ok: false,
      error: "position_id is required and must be an approved position",
      status: 400,
    };
  }
  if (input.position.client_id !== input.destinationClientId) {
    return {
      ok: false,
      error: "position_id not in this client",
      status: 400,
    };
  }
  if (!input.position.is_active) {
    return {
      ok: false,
      error: "Position is inactive",
      status: 400,
    };
  }
  if (input.position.approval_status !== "approved") {
    return {
      ok: false,
      error: "Position must be approved before assignment",
      status: 400,
    };
  }
  const applied = applyPositionCardRates(input.position);
  if (!applied.ok) {
    return { ok: false, error: applied.error, status: 400 };
  }
  return { ok: true, position: input.position, rates: applied.rates };
}
