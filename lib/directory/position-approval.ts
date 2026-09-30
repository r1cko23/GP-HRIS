/**
 * Directory client industry + position approval workflow (pure helpers).
 */

export type ClientIndustry = "HOTEL" | "NON-HOTEL";

export type PositionApprovalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected";

export const CLIENT_INDUSTRIES: readonly ClientIndustry[] = [
  "HOTEL",
  "NON-HOTEL",
] as const;

export function parseClientIndustry(
  value: unknown
): ClientIndustry | null {
  if (value === "HOTEL" || value === "NON-HOTEL") return value;
  return null;
}

export function industryApproveCapability(
  industry: ClientIndustry
): `fn:positions.approve.hotel` | `fn:positions.approve.non_hotel` {
  return industry === "HOTEL"
    ? "fn:positions.approve.hotel"
    : "fn:positions.approve.non_hotel";
}

export function canApproveClientIndustry(input: {
  capabilityKeys: Iterable<string>;
  industry: ClientIndustry;
}): boolean {
  const keys = new Set(
    Array.from(input.capabilityKeys)
      .map((k) => k.trim())
      .filter(Boolean)
  );
  if (keys.has("fn:admin.system")) return true;
  return keys.has(industryApproveCapability(input.industry));
}

export function canViewClientRoster(capabilityKeys: Iterable<string>): boolean {
  const keys = new Set(
    Array.from(capabilityKeys)
      .map((k) => k.trim())
      .filter(Boolean)
  );
  if (keys.has("fn:admin.system")) return true;
  if (keys.has("fn:clients.roster.view")) return true;
  // Clients surface page (or legacy People page) opens roster shell.
  return (
    keys.has("page:people.clients") || keys.has("page:employees")
  );
}

export function canOpenEmployee201(input: {
  capabilityKeys?: Iterable<string> | null;
  hasAnyEmployeeSection: boolean;
}): boolean {
  const keys = new Set(
    Array.from(input.capabilityKeys ?? [])
      .map((k) => k.trim())
      .filter(Boolean)
  );
  if (keys.has("fn:admin.system")) return true;
  return input.hasAnyEmployeeSection;
}

export type PositionRateFields = {
  payroll_daily_rate: number | string | null | undefined;
  billing_daily_rate: number | string | null | undefined;
};

export function positionHasRequiredRates(card: PositionRateFields): boolean {
  const pay = Number(card.payroll_daily_rate);
  const bill = Number(card.billing_daily_rate);
  return Number.isFinite(pay) && pay > 0 && Number.isFinite(bill) && bill > 0;
}

export type PositionSubmitPlan =
  | { ok: true; next: "pending" }
  | { ok: false; error: string; status: number };

export function planSubmitPosition(input: {
  currentStatus: PositionApprovalStatus;
  rates: PositionRateFields;
}): PositionSubmitPlan {
  if (input.currentStatus === "pending") {
    return { ok: false, error: "Position is already pending approval", status: 400 };
  }
  if (input.currentStatus === "approved") {
    return {
      ok: false,
      error: "Approved position must be edited first (returns to draft/pending)",
      status: 400,
    };
  }
  if (!positionHasRequiredRates(input.rates)) {
    return {
      ok: false,
      error: "payroll_daily_rate and billing_daily_rate are required to submit",
      status: 400,
    };
  }
  return { ok: true, next: "pending" };
}

export type PositionReviewPlan =
  | {
      ok: true;
      next: "approved" | "rejected";
      rejection_reason: string | null;
    }
  | { ok: false; error: string; status: number };

export function planReviewPosition(input: {
  currentStatus: PositionApprovalStatus;
  decision: "approve" | "reject";
  rejection_reason?: string | null;
}): PositionReviewPlan {
  if (input.currentStatus !== "pending") {
    return {
      ok: false,
      error: "Only pending positions can be approved or rejected",
      status: 400,
    };
  }
  if (input.decision === "approve") {
    return { ok: true, next: "approved", rejection_reason: null };
  }
  const reason = input.rejection_reason?.trim() || null;
  if (!reason) {
    return { ok: false, error: "rejection_reason is required", status: 400 };
  }
  return { ok: true, next: "rejected", rejection_reason: reason };
}

/**
 * After Lea edits title or rates on an approved/rejected card, return to
 * pending (when rates are complete) so the segment AM must re-approve.
 * Incomplete rates fall back to draft. Pending/draft stay as-is.
 */
export function nextStatusAfterPositionEdit(input: {
  currentStatus: PositionApprovalStatus;
  titleOrRatesChanged: boolean;
  rates: PositionRateFields;
}): PositionApprovalStatus {
  if (!input.titleOrRatesChanged) return input.currentStatus;
  if (input.currentStatus === "approved" || input.currentStatus === "rejected") {
    return positionHasRequiredRates(input.rates) ? "pending" : "draft";
  }
  return input.currentStatus;
}
