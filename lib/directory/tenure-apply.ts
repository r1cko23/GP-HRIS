import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngagementRow } from "@/lib/directory/engagement-transitions";
import {
  currentTenurePatch,
  foldTenureRehire,
  seedCurrentTenure,
  type LiveEmployment,
  type RehireTenureInput,
  type TenureRecord,
} from "@/lib/directory/tenure";

type TenureApplyDeps = {
  directory: SupabaseClient;
  organizationId: string;
};

export function liveFromRow(row: {
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
}): LiveEmployment {
  return {
    hire_date: row.hire_date,
    resign_date: row.resign_date,
    client_id: row.client_id,
    branch_id: row.branch_id,
    position_id: row.position_id,
    daily_rate: row.daily_rate ?? null,
    billing_daily_rate: row.billing_daily_rate ?? null,
    status: row.status,
    last_payroll_end: row.last_payroll_end ?? null,
    is_current_engagement: row.is_current_engagement,
  };
}

export function liveFromEmployeeAndPatch(
  row: EngagementRow,
  patch: Record<string, unknown>
): LiveEmployment {
  const str = (value: unknown, fallback: string | null) =>
    value === undefined ? fallback : (value as string | null);
  return liveFromRow({
    hire_date: str(patch.hire_date, row.hire_date),
    resign_date: str(patch.resign_date, row.resign_date),
    client_id: str(patch.client_id, row.client_id),
    branch_id: str(patch.branch_id, row.branch_id),
    position_id: str(patch.position_id, row.position_id),
    daily_rate:
      patch.daily_rate === undefined
        ? row.daily_rate ?? null
        : (patch.daily_rate as number | string | null),
    billing_daily_rate:
      patch.billing_daily_rate === undefined
        ? row.billing_daily_rate ?? null
        : (patch.billing_daily_rate as number | string | null),
    status: String(patch.status ?? row.status),
    last_payroll_end: row.last_payroll_end ?? null,
    is_current_engagement: row.is_current_engagement,
  });
}

function writePayload(
  organizationId: string,
  employeeId: string,
  record: TenureRecord
) {
  return {
    organization_id: organizationId,
    employee_id: employeeId,
    sequence: record.sequence,
    hire_date: record.hire_date,
    resign_date: record.resign_date,
    client_id: record.client_id,
    branch_id: record.branch_id,
    position_id: record.position_id,
    daily_rate: record.daily_rate,
    billing_daily_rate: record.billing_daily_rate,
    status: record.status,
    final_pay_status: record.final_pay_status,
    barred_reason: record.barred_reason,
    is_current: record.is_current,
    closed_at: record.closed_at,
  };
}

async function loadTenureHeads(
  deps: TenureApplyDeps,
  employeeId: string
): Promise<{ id: string; sequence: number; is_current: boolean }[]> {
  const { data, error } = await deps.directory
    .from("employment_tenures")
    .select("id, sequence, is_current")
    .eq("organization_id", deps.organizationId)
    .eq("employee_id", employeeId)
    .order("sequence", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; sequence: number; is_current: boolean }[];
}

/**
 * Freeze the live Tenure. Returns the planned open Tenure — insert it after
 * the person row is patched so a failed 201 update can retry.
 */
export async function freezeCurrentTenure(input: {
  deps: TenureApplyDeps;
  employeeId: string;
  live: EngagementRow;
  next: RehireTenureInput;
}): Promise<TenureRecord> {
  const closedAt = new Date().toISOString();
  const existing = await loadTenureHeads(input.deps, input.employeeId);
  const live = liveFromRow(input.live);
  const stubs: TenureRecord[] = existing.map((row) => ({
    ...seedCurrentTenure(live, undefined, row.sequence),
    is_current: row.is_current,
    closed_at: row.is_current ? null : closedAt,
  }));
  const folded = foldTenureRehire(stubs, live, input.next, closedAt);
  const opened = folded.find((row) => row.is_current);
  if (!opened) throw new Error("Rehire did not open a current tenure");

  const currentHead = existing.find((row) => row.is_current);
  const closedPlan = currentHead
    ? folded.find((row) => row.sequence === currentHead.sequence && !row.is_current)
    : folded.find((row) => !row.is_current);

  if (currentHead && closedPlan) {
    const { error } = await input.deps.directory
      .from("employment_tenures")
      .update({
        hire_date: closedPlan.hire_date,
        resign_date: closedPlan.resign_date,
        client_id: closedPlan.client_id,
        branch_id: closedPlan.branch_id,
        position_id: closedPlan.position_id,
        daily_rate: closedPlan.daily_rate,
        billing_daily_rate: closedPlan.billing_daily_rate,
        status: closedPlan.status,
        final_pay_status: closedPlan.final_pay_status,
        barred_reason: closedPlan.barred_reason,
        is_current: false,
        closed_at: closedPlan.closed_at,
      })
      .eq("id", currentHead.id)
      .eq("organization_id", input.deps.organizationId);
    if (error) throw new Error(error.message);
  } else if (!currentHead && closedPlan && existing.length === 0) {
    const { error } = await input.deps.directory
      .from("employment_tenures")
      .insert(writePayload(input.deps.organizationId, input.employeeId, closedPlan));
    if (error) throw new Error(error.message);
  }

  return opened;
}

export async function insertOpenedTenure(input: {
  deps: TenureApplyDeps;
  employeeId: string;
  opened: TenureRecord;
}): Promise<string> {
  const { data, error } = await input.deps.directory
    .from("employment_tenures")
    .insert(writePayload(input.deps.organizationId, input.employeeId, input.opened))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string } | null)?.id;
  if (!id) throw new Error("Failed to open current tenure");
  return id;
}

export async function ensureHireTenure(input: {
  deps: TenureApplyDeps;
  employeeId: string;
  live: LiveEmployment;
}): Promise<string> {
  const seeded = seedCurrentTenure(input.live);
  const { data, error } = await input.deps.directory
    .from("employment_tenures")
    .insert(writePayload(input.deps.organizationId, input.employeeId, seeded))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string } | null)?.id;
  if (!id) throw new Error("Failed to seed current tenure");
  const { error: patchError } = await input.deps.directory
    .from("employees")
    .update({ current_tenure_id: id })
    .eq("id", input.employeeId)
    .eq("organization_id", input.deps.organizationId);
  if (patchError) throw new Error(patchError.message);
  return id;
}

export async function syncLiveTenure(input: {
  deps: TenureApplyDeps;
  employeeId: string;
  live: LiveEmployment;
}): Promise<void> {
  const existing = await loadTenureHeads(input.deps, input.employeeId);
  const current = existing.find((row) => row.is_current);
  const patch = currentTenurePatch(input.live);
  if (!current) {
    await ensureHireTenure({
      deps: input.deps,
      employeeId: input.employeeId,
      live: input.live,
    });
    return;
  }
  const { error } = await input.deps.directory
    .from("employment_tenures")
    .update({
      hire_date: patch.hire_date,
      resign_date: patch.resign_date,
      client_id: patch.client_id,
      branch_id: patch.branch_id,
      position_id: patch.position_id,
      daily_rate: patch.daily_rate,
      billing_daily_rate: patch.billing_daily_rate,
      status: patch.status,
      final_pay_status: patch.final_pay_status,
      barred_reason: patch.barred_reason,
    })
    .eq("id", current.id)
    .eq("organization_id", input.deps.organizationId)
    .eq("is_current", true);
  if (error) throw new Error(error.message);
}
