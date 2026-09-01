/**
 * Next-cutoff catch-up corrections (ADR 0012).
 * Posted cutoffs stay immutable; signed peso lines land on a later open cutoff.
 */

export const CATCHUP_OPEN_STATUSES = [
  "draft",
  "pending_audit",
  "approved",
] as const;

export type CatchupOpenStatus = (typeof CATCHUP_OPEN_STATUSES)[number];

export type CatchupCorrectionStatus = "pending" | "applied" | "cancelled";

export type CatchupCorrectionRow = {
  id: string;
  organization_id: string;
  client_id: string;
  source_cutoff_period_id: string;
  apply_cutoff_period_id: string;
  directory_employee_id: string;
  office_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  amount: number;
  reason: string;
  status: CatchupCorrectionStatus;
};

export type CatchupPeriodRef = {
  id: string;
  status: string;
  period_start: string;
  period_end: string;
  client_id: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function isCatchupOpenStatus(status: string): status is CatchupOpenStatus {
  return (CATCHUP_OPEN_STATUSES as readonly string[]).includes(status);
}

/** Prefer the earliest open cutoff that starts after the source period end. */
export function pickNextOpenCutoff(
  source: Pick<CatchupPeriodRef, "period_end" | "client_id">,
  candidates: CatchupPeriodRef[]
): CatchupPeriodRef | null {
  const open = candidates
    .filter(
      (p) =>
        p.client_id === source.client_id &&
        isCatchupOpenStatus(p.status) &&
        p.period_start > source.period_end
    )
    .sort((a, b) => a.period_start.localeCompare(b.period_start));
  return open[0] ?? null;
}

export function sumCatchupByDirectoryEmployee(
  rows: Array<Pick<CatchupCorrectionRow, "directory_employee_id" | "amount" | "status">>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "pending") continue;
    const key = row.directory_employee_id;
    map.set(key, round2((map.get(key) ?? 0) + Number(row.amount || 0)));
  }
  return map;
}

export function validateCatchupAmount(amount: unknown): number | null {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return null;
  return round2(n);
}

export function validateCatchupReason(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim();
  if (trimmed.length < 3) return null;
  return trimmed;
}
