/**
 * SIL monthly run status transitions (draft → approved → posted | void).
 */

export const SIL_RUN_STATUSES = [
  "draft",
  "approved",
  "posted",
  "void",
] as const;

export type SilRunStatus = (typeof SIL_RUN_STATUSES)[number];

export function isSilRunStatus(value: string): value is SilRunStatus {
  return (SIL_RUN_STATUSES as readonly string[]).includes(value);
}

export type SilRunTransition =
  | { ok: true; next: SilRunStatus }
  | { ok: false; error: string };

export function canRebuildSilRun(status: SilRunStatus): boolean {
  return status === "draft";
}

export function canApproveSilRun(status: SilRunStatus): SilRunTransition {
  if (status === "draft") return { ok: true, next: "approved" };
  if (status === "approved") {
    return { ok: false, error: "Run is already approved" };
  }
  if (status === "posted") {
    return { ok: false, error: "Posted run cannot be approved again" };
  }
  return { ok: false, error: "Voided run cannot be approved" };
}

export function canPostSilRun(status: SilRunStatus): SilRunTransition {
  if (status === "approved") return { ok: true, next: "posted" };
  if (status === "draft") {
    return { ok: false, error: "Approve the run before posting" };
  }
  if (status === "posted") {
    return { ok: false, error: "Run is already posted" };
  }
  return { ok: false, error: "Voided run cannot be posted" };
}

export function canVoidSilRun(status: SilRunStatus): SilRunTransition {
  if (status === "draft" || status === "approved") {
    return { ok: true, next: "void" };
  }
  if (status === "posted") {
    return { ok: false, error: "Posted run cannot be voided" };
  }
  return { ok: false, error: "Run is already voided" };
}

/** Whether a new draft may be created for the period given an existing active status. */
export function canCreateSilDraftForPeriod(
  existingStatus: SilRunStatus | null
): { ok: true } | { ok: false; error: string } {
  if (!existingStatus) return { ok: true };
  if (existingStatus === "draft") return { ok: true }; // refresh
  if (existingStatus === "void") return { ok: true };
  if (existingStatus === "approved") {
    return {
      ok: false,
      error: "SIL run is approved — void it before rebuilding",
    };
  }
  return {
    ok: false,
    error: "SIL run already posted for this client and month",
  };
}
