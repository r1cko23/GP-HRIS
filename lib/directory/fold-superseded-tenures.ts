/**
 * Fold parked (superseded) 201 rows into closed employment_tenures on the master.
 * Never deletes employee rows. Skips episodes that already exist on the master.
 */
import {
  inferBarredReason,
  inferFinalPayStatus,
  type TenureRecord,
} from "@/lib/directory/tenure";

export type SupersededEmployeeEpisode = {
  id: string;
  organization_id: string;
  superseded_by: string;
  hire_date: string | null;
  resign_date: string | null;
  client_id: string | null;
  branch_id: string | null;
  position_id: string | null;
  daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
  status: string;
  last_payroll_end?: string | null;
};

export type ExistingTenureKey = {
  hire_date: string | null;
  client_id: string | null;
};

export type FoldTenureInsert = {
  organization_id: string;
  employee_id: string;
  sequence: number;
  hire_date: string | null;
  resign_date: string | null;
  client_id: string | null;
  branch_id: string | null;
  position_id: string | null;
  daily_rate: number | string | null;
  billing_daily_rate: number | string | null;
  status: string;
  final_pay_status: string;
  barred_reason: string | null;
  is_current: false;
  closed_at: string;
  source_employee_id: string;
};

function dateKey(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

export function tenureEpisodeKey(row: ExistingTenureKey): string {
  return `${dateKey(row.hire_date)}|${row.client_id ?? ""}`;
}

export function planFoldSupersededTenures(
  losers: SupersededEmployeeEpisode[],
  existingByMaster: Map<string, TenureRecord[]>,
  options?: { asOf?: Date; closedAt?: string }
): FoldTenureInsert[] {
  const asOf = options?.asOf ?? new Date();
  const closedAt = options?.closedAt ?? asOf.toISOString();
  const inserts: FoldTenureInsert[] = [];
  const nextSeqByMaster = new Map<string, number>();
  const seenKeysByMaster = new Map<string, Set<string>>();

  for (const [masterId, tenures] of existingByMaster) {
    const maxSeq = tenures.reduce((max, row) => Math.max(max, row.sequence), 0);
    nextSeqByMaster.set(masterId, maxSeq + 1);
    seenKeysByMaster.set(
      masterId,
      new Set(tenures.map((row) => tenureEpisodeKey(row)))
    );
  }

  const ordered = [...losers].sort((a, b) => {
    const ah = dateKey(a.hire_date);
    const bh = dateKey(b.hire_date);
    if (ah && bh && ah !== bh) return ah.localeCompare(bh);
    if (ah && !bh) return -1;
    if (!ah && bh) return 1;
    return a.id.localeCompare(b.id);
  });

  for (const loser of ordered) {
    const masterId = loser.superseded_by;
    if (!masterId) continue;

    const keys = seenKeysByMaster.get(masterId) ?? new Set<string>();
    const key = tenureEpisodeKey(loser);
    if (keys.has(key)) continue;

    const seq = nextSeqByMaster.get(masterId) ?? 1;
    nextSeqByMaster.set(masterId, seq + 1);
    keys.add(key);
    seenKeysByMaster.set(masterId, keys);

    const live = {
      hire_date: loser.hire_date,
      resign_date: loser.resign_date,
      client_id: loser.client_id,
      branch_id: loser.branch_id,
      position_id: loser.position_id,
      daily_rate: loser.daily_rate ?? null,
      billing_daily_rate: loser.billing_daily_rate ?? null,
      status: loser.status,
      last_payroll_end: loser.last_payroll_end ?? null,
    };

    inserts.push({
      organization_id: loser.organization_id,
      employee_id: masterId,
      sequence: seq,
      hire_date: loser.hire_date,
      resign_date: loser.resign_date,
      client_id: loser.client_id,
      branch_id: loser.branch_id,
      position_id: loser.position_id,
      daily_rate: loser.daily_rate ?? null,
      billing_daily_rate: loser.billing_daily_rate ?? null,
      status: loser.status,
      final_pay_status: inferFinalPayStatus(live, asOf),
      barred_reason: inferBarredReason(live, asOf),
      is_current: false,
      closed_at: closedAt,
      source_employee_id: loser.id,
    });
  }

  return inserts;
}
