import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";

export type PositionCardRates = {
  payroll_daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
  ecola?: number | string | null;
  sea?: number | string | null;
  ctpa?: number | string | null;
  allowance?: number | string | null;
};

export type AppliedPersonRates = {
  daily_rate: number;
  billing_daily_rate: number;
  ecola: number | null;
  sea: number | null;
  ctpa: number | null;
};

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
 * Copy approved position card rates onto the person engagement.
 * Requires both payroll and billing daily rates on the card.
 */
export function applyPositionCardRates(
  card: PositionCardRates
):
  | { ok: true; rates: AppliedPersonRates }
  | { ok: false; error: string } {
  const daily = asPositiveRate(card.payroll_daily_rate);
  const billing = asPositiveRate(card.billing_daily_rate);
  if (daily == null || billing == null) {
    return {
      ok: false,
      error: "Approved position must have payroll and billing daily rates",
    };
  }
  return {
    ok: true,
    rates: {
      daily_rate: daily,
      billing_daily_rate: billing,
      ecola: asOptionalRate(card.ecola),
      sea: asOptionalRate(card.sea),
      ctpa: asOptionalRate(card.ctpa),
    },
  };
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
  | { ok: true; position: AssignablePosition; rates: AppliedPersonRates }
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
