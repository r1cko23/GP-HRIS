/**
 * Domain rules for Debit Memo Queue (manual enqueue + anti-double-pay).
 */

export type BdoDisbursementStatus =
  | "queued"
  | "awaiting_ref"
  | "confirmed"
  | "void";

export type BdoDisbursementSnap = {
  id: string;
  status: BdoDisbursementStatus;
  bdo_reference?: string | null;
  payroll_register_run_id: string;
};

/** Status shown in the Debit Memo Queue list (only after manual add). */
export type QueueRowStatus = "queued" | "awaiting_ref" | "confirmed";

/** Active (non-void) disbursement for a run, if any. */
export function activeDisbursement(
  rows: BdoDisbursementSnap[]
): BdoDisbursementSnap | null {
  return rows.find((r) => r.status !== "void") ?? null;
}

export function queueStatusForRun(
  active: BdoDisbursementSnap | null
): QueueRowStatus | null {
  if (!active) return null;
  if (active.status === "confirmed") return "confirmed";
  if (active.status === "awaiting_ref") return "awaiting_ref";
  if (active.status === "queued") return "queued";
  return null;
}

export function canEnqueueRun(active: BdoDisbursementSnap | null): {
  ok: boolean;
  error?: string;
} {
  if (!active) return { ok: true };
  if (active.status === "queued") {
    return { ok: false, error: "This cutoff is already on the Debit Memo Queue" };
  }
  if (active.status === "awaiting_ref") {
    return {
      ok: false,
      error: "A BDO file was already generated for this Debit Memo",
    };
  }
  if (active.status === "confirmed") {
    return {
      ok: false,
      error: "This Debit Memo is locked with a BDO reference",
    };
  }
  return { ok: true };
}

/** Generate .txt only after manual enqueue (status=queued). */
export function canGenerateForRun(active: BdoDisbursementSnap | null): {
  ok: boolean;
  error?: string;
} {
  if (!active) {
    return {
      ok: false,
      error: "Add this cutoff to the Debit Memo Queue before generating a BDO file",
    };
  }
  if (active.status === "queued") return { ok: true };
  if (active.status === "awaiting_ref") {
    return {
      ok: false,
      error:
        "A BDO file already exists for this Debit Memo — re-download it or void before generating again",
    };
  }
  if (active.status === "confirmed") {
    return {
      ok: false,
      error:
        "This Debit Memo is locked with a BDO reference — cannot generate another file",
    };
  }
  return { ok: false, error: "Cannot generate for this disbursement" };
}

export function canPasteBdoReference(
  active: BdoDisbursementSnap | null,
  reference: string,
  existingRefs: ReadonlySet<string>
): { ok: boolean; error?: string } {
  if (!active) {
    return { ok: false, error: "Generate a BDO file before pasting a reference" };
  }
  if (active.status === "void") {
    return { ok: false, error: "Cannot confirm a voided disbursement" };
  }
  if (active.status === "queued") {
    return {
      ok: false,
      error: "Generate the BDO .txt before pasting a reference",
    };
  }
  if (active.status === "confirmed") {
    return { ok: false, error: "BDO reference already saved for this Debit Memo" };
  }
  const ref = reference.trim();
  if (!ref) {
    return { ok: false, error: "BDO reference is required" };
  }
  if (existingRefs.has(ref)) {
    return {
      ok: false,
      error: "This BDO reference is already tied to another Debit Memo",
    };
  }
  return { ok: true };
}

export function canVoidDisbursement(active: BdoDisbursementSnap | null): {
  ok: boolean;
  error?: string;
} {
  if (!active) {
    return { ok: false, error: "No disbursement to void" };
  }
  if (active.status === "void") {
    return { ok: false, error: "Already voided" };
  }
  if (active.status === "confirmed") {
    return {
      ok: false,
      error: "Confirmed disbursements cannot be voided (anti-double-pay lock)",
    };
  }
  return { ok: true };
}
