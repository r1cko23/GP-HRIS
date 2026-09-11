/**
 * Sequential employment Tenures on one Directory person (ADR 0016).
 * Live 201 is the current Tenure projection; closed Tenures do not mutate.
 */

import { barredKind } from "@/lib/directory/lifecycle";

export type FinalPayStatus = "none" | "in_progress" | "claimed" | "barred";
export type BarredReason = "unclaimed_final_pay" | "deployment_block";

export type LiveEmployment = {
  hire_date: string | null;
  resign_date: string | null;
  client_id: string | null;
  branch_id: string | null;
  position_id: string | null;
  daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
  status: string;
  last_payroll_end?: string | null;
  is_current_engagement?: boolean | null;
};

export type RehireTenureInput = {
  hire_date: string;
  client_id: string;
  branch_id?: string | null;
  position_id?: string | null;
  daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
};

export type TenureRecord = {
  sequence: number;
  hire_date: string | null;
  resign_date: string | null;
  client_id: string | null;
  branch_id: string | null;
  position_id: string | null;
  daily_rate: number | string | null;
  billing_daily_rate: number | string | null;
  status: string;
  final_pay_status: FinalPayStatus;
  barred_reason: BarredReason | null;
  is_current: boolean;
  closed_at: string | null;
};

export function inferFinalPayStatus(
  live: LiveEmployment,
  asOf: Date = new Date()
): FinalPayStatus {
  if (barredKind(live.status, live.last_payroll_end, asOf) === "unclaimed_final_pay") {
    return "barred";
  }
  if (live.status === "for_release") return "in_progress";
  if (live.status === "inactive") return "claimed";
  return "none";
}

export function inferBarredReason(
  live: LiveEmployment,
  asOf: Date = new Date()
): BarredReason | null {
  return barredKind(live.status, live.last_payroll_end, asOf);
}

export function isRehireEligible(
  live: Pick<LiveEmployment, "status" | "last_payroll_end" | "is_current_engagement">,
  asOf: Date = new Date()
): boolean {
  if (live.is_current_engagement === false) return false;
  if (live.status === "inactive") return true;
  return barredKind(live.status, live.last_payroll_end, asOf) === "unclaimed_final_pay";
}

export function seedCurrentTenure(
  live: LiveEmployment,
  asOf: Date = new Date(),
  sequence = 1
): TenureRecord {
  return {
    sequence,
    hire_date: live.hire_date,
    resign_date: live.resign_date,
    client_id: live.client_id,
    branch_id: live.branch_id,
    position_id: live.position_id,
    daily_rate: live.daily_rate ?? null,
    billing_daily_rate: live.billing_daily_rate ?? null,
    status: live.status,
    final_pay_status: inferFinalPayStatus(live, asOf),
    barred_reason: inferBarredReason(live, asOf),
    is_current: true,
    closed_at: null,
  };
}

export function foldTenureRehire(
  tenures: TenureRecord[],
  live: LiveEmployment,
  next: RehireTenureInput,
  closedAt: string,
  asOf: Date = new Date()
): TenureRecord[] {
  const existing = tenures.length > 0 ? tenures : [seedCurrentTenure(live, asOf)];
  const closed = existing.map((row) =>
    row.is_current
      ? {
          ...seedCurrentTenure(live, asOf, row.sequence),
          is_current: false,
          closed_at: closedAt,
        }
      : row
  );
  const maxSeq = closed.reduce((max, row) => Math.max(max, row.sequence), 0);
  const opened: TenureRecord = {
    sequence: maxSeq + 1,
    hire_date: next.hire_date,
    resign_date: null,
    client_id: next.client_id,
    branch_id: next.branch_id ?? null,
    position_id: next.position_id ?? null,
    daily_rate: next.daily_rate ?? null,
    billing_daily_rate: next.billing_daily_rate ?? null,
    status: "active",
    final_pay_status: "none",
    barred_reason: null,
    is_current: true,
    closed_at: null,
  };
  return [...closed, opened];
}

export function currentTenurePatch(live: LiveEmployment, asOf: Date = new Date()) {
  const seeded = seedCurrentTenure(live, asOf);
  return {
    hire_date: seeded.hire_date,
    resign_date: seeded.resign_date,
    client_id: seeded.client_id,
    branch_id: seeded.branch_id,
    position_id: seeded.position_id,
    daily_rate: seeded.daily_rate,
    billing_daily_rate: seeded.billing_daily_rate,
    status: seeded.status,
    final_pay_status: seeded.final_pay_status,
    barred_reason: seeded.barred_reason,
  };
}
