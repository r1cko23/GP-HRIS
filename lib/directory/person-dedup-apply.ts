import type { SupabaseClient } from "@supabase/supabase-js";
import { aliasConflictAction, type CollapsePlan } from "@/lib/directory/person-dedup";
import { priorEngagementRemarks } from "@/lib/directory/movement-copy";
import {
  planFoldSupersededTenures,
  type SupersededEmployeeEpisode,
} from "@/lib/directory/fold-superseded-tenures";
import {
  currentTenurePatch,
  type LiveEmployment,
  type TenureRecord,
} from "@/lib/directory/tenure";
import { planTenureReattachAfterCollapse } from "@/lib/directory/tenure-reattach";

type Collapse = Extract<CollapsePlan, { action: "collapse" }>;

async function reattachTenuresAfterCollapse(
  directory: SupabaseClient,
  plan: Collapse,
  organizationId: string
): Promise<void> {
  const loserIds = plan.loserPatches.map((loser) => loser.id);
  const employeeIds = [plan.masterId, ...loserIds];
  const { data: tenureRows, error: loadError } = await directory
    .from("employment_tenures")
    .select("id, employee_id, sequence, is_current, status")
    .in("employee_id", employeeIds);
  if (loadError) throw new Error(`tenures load: ${loadError.message}`);

  const reattach = planTenureReattachAfterCollapse({
    masterId: plan.masterId,
    loserIds,
    liveStatus: plan.masterPatch.status,
    tenures: (tenureRows ?? []).map((row) => ({
      id: String(row.id),
      employee_id: String(row.employee_id),
      sequence: Number(row.sequence),
      is_current: Boolean(row.is_current),
      status: String(row.status ?? ""),
    })),
  });

  if (reattach.moveIds.length > 0) {
    const { error } = await directory
      .from("employment_tenures")
      .update({ employee_id: plan.masterId })
      .in("id", reattach.moveIds);
    if (error) throw new Error(`tenures move: ${error.message}`);
  }

  const live: LiveEmployment = {
    hire_date: plan.masterPatch.hire_date,
    resign_date: plan.masterPatch.resign_date,
    client_id: plan.masterPatch.client_id ?? null,
    branch_id: plan.masterPatch.branch_id ?? null,
    position_id: plan.masterPatch.position_id ?? null,
    daily_rate: plan.masterPatch.daily_rate ?? null,
    billing_daily_rate: null,
    status: plan.masterPatch.status,
    last_payroll_end: plan.masterPatch.last_payroll_end ?? null,
  };
  const patch = currentTenurePatch(live);
  const now = new Date().toISOString();

  if (reattach.clearCurrentIds.length > 0) {
    const { error } = await directory
      .from("employment_tenures")
      .update({ is_current: false, closed_at: now })
      .in("id", reattach.clearCurrentIds);
    if (error) throw new Error(`tenures clear current: ${error.message}`);
  }

  if (reattach.keepHistoricalIds.length > 0) {
    const { error } = await directory
      .from("employment_tenures")
      .update({ is_current: false, closed_at: now })
      .in("id", reattach.keepHistoricalIds);
    if (error) throw new Error(`tenures keep historical: ${error.message}`);
  }

  let currentTenureId = reattach.currentId;
  if (currentTenureId) {
    const { error } = await directory
      .from("employment_tenures")
      .update({
        ...patch,
        is_current: true,
        closed_at: null,
      })
      .eq("id", currentTenureId);
    if (error) throw new Error(`tenures promote: ${error.message}`);
  } else {
    const { data: maxSeqRow } = await directory
      .from("employment_tenures")
      .select("sequence")
      .eq("employee_id", plan.masterId)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSeq = Number(maxSeqRow?.sequence ?? 0) + 1;
    const { data: inserted, error } = await directory
      .from("employment_tenures")
      .insert({
        organization_id: organizationId,
        employee_id: plan.masterId,
        sequence: nextSeq,
        ...patch,
        is_current: true,
        closed_at: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`tenures seed: ${error.message}`);
    currentTenureId = inserted?.id ? String(inserted.id) : null;
  }

  if (currentTenureId) {
    const { error } = await directory
      .from("employees")
      .update({ current_tenure_id: currentTenureId })
      .eq("id", plan.masterId);
    if (error) throw new Error(`current_tenure_id: ${error.message}`);
  }
  if (loserIds.length > 0) {
    const { error } = await directory
      .from("employees")
      .update({ current_tenure_id: null })
      .in("id", loserIds);
    if (error) throw new Error(`loser current_tenure_id: ${error.message}`);
  }
}

export async function applyCollapsePlans(
  directory: SupabaseClient,
  plans: Collapse[]
): Promise<{
  masters: number;
  losers: number;
  aliases: number;
  aliases_skipped: number;
  aliases_retargeted: number;
  movements: number;
}> {
  let masters = 0;
  let losers = 0;
  let aliases = 0;
  let aliases_skipped = 0;
  let aliases_retargeted = 0;
  let movements = 0;

  for (const plan of plans) {
    const { error: masterError } = await directory
      .from("employees")
      .update({
        ...plan.masterPatch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.masterId);
    if (masterError) {
      throw new Error(`master ${plan.masterId}: ${masterError.message}`);
    }
    masters += 1;

    for (const loser of plan.loserPatches) {
      const { error } = await directory
        .from("employees")
        .update({
          is_current_engagement: false,
          superseded_by: loser.superseded_by,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loser.id);
      if (error) throw new Error(`loser ${loser.id}: ${error.message}`);
      losers += 1;
    }

    const { data: masterRow } = await directory
      .from("employees")
      .select("organization_id")
      .eq("id", plan.masterId)
      .maybeSingle();
    const organizationId = (masterRow?.organization_id as string | undefined) ?? null;

    for (const alias of plan.aliases) {
      if (!organizationId) break;
      const { error } = await directory.from("employee_code_aliases").insert({
        organization_id: organizationId,
        employee_id: plan.masterId,
        alias_code: alias.alias_code,
        legacy_id: alias.legacy_id,
        source_employee_id: alias.source_employee_id,
        note: "Linked earlier 201 to this person (split current engagement)",
      });
      if (error) {
        if (error.code === "23505" || /unique|duplicate/i.test(error.message)) {
          const { data: existing } = await directory
            .from("employee_code_aliases")
            .select("id, employee_id")
            .eq("organization_id", organizationId)
            .eq("alias_code", alias.alias_code)
            .maybeSingle();
          const extraIds = plan.loserPatches.map((loser) => loser.id);
          const action =
            existing?.employee_id && alias.alias_code
              ? aliasConflictAction(String(existing.employee_id), plan.masterId, extraIds)
              : "skip";
          if (action === "retarget" && existing?.id) {
            const { error: retargetError } = await directory
              .from("employee_code_aliases")
              .update({
                employee_id: plan.masterId,
                source_employee_id: alias.source_employee_id,
                note: "Linked earlier 201 to this person (split current engagement)",
              })
              .eq("id", existing.id);
            if (retargetError) {
              throw new Error(`alias ${alias.alias_code}: ${retargetError.message}`);
            }
            aliases_retargeted += 1;
            continue;
          }
          aliases_skipped += 1;
          continue;
        }
        throw new Error(`alias ${alias.alias_code}: ${error.message}`);
      }
      aliases += 1;
    }

    if (organizationId) {
      for (const alias of plan.aliases) {
        const { error } = await directory.from("employee_movements").insert({
          organization_id: organizationId,
          employee_id: plan.masterId,
          date_from: plan.masterPatch.hire_date,
          date_to: null,
          status: "PRIOR_ENGAGEMENT",
          remarks: priorEngagementRemarks({
            employeeCode: alias.alias_code,
            legacyId: alias.legacy_id,
          }),
        });
        if (error) continue;
        movements += 1;
      }
      await reattachTenuresAfterCollapse(directory, plan, organizationId);
      await foldParkedEpisodesOntoMaster(directory, plan, organizationId);
    }
  }

  return { masters, losers, aliases, aliases_skipped, aliases_retargeted, movements };
}

async function foldParkedEpisodesOntoMaster(
  directory: SupabaseClient,
  plan: Collapse,
  organizationId: string
): Promise<void> {
  const loserIds = plan.loserPatches.map((loser) => loser.id);
  if (loserIds.length === 0) return;

  const { data: losers, error: loserError } = await directory
    .from("employees")
    .select(
      "id, organization_id, superseded_by, hire_date, first_hire_date, resign_date, client_id, branch_id, position_id, daily_rate, billing_daily_rate, status, last_payroll_end"
    )
    .in("id", loserIds);
  if (loserError) throw new Error(`fold losers: ${loserError.message}`);

  const { data: existingRows, error: tenureError } = await directory
    .from("employment_tenures")
    .select(
      "sequence, hire_date, resign_date, client_id, branch_id, position_id, daily_rate, billing_daily_rate, status, final_pay_status, barred_reason, is_current, closed_at"
    )
    .eq("employee_id", plan.masterId);
  if (tenureError) throw new Error(`fold tenures: ${tenureError.message}`);

  const existingByMaster = new Map<string, TenureRecord[]>([
    [
      plan.masterId,
      (existingRows ?? []).map((row) => ({
        sequence: Number(row.sequence),
        hire_date: (row.hire_date as string | null) ?? null,
        resign_date: (row.resign_date as string | null) ?? null,
        client_id: (row.client_id as string | null) ?? null,
        branch_id: (row.branch_id as string | null) ?? null,
        position_id: (row.position_id as string | null) ?? null,
        daily_rate: row.daily_rate ?? null,
        billing_daily_rate: row.billing_daily_rate ?? null,
        status: String(row.status ?? ""),
        final_pay_status: (row.final_pay_status as TenureRecord["final_pay_status"]) ?? "none",
        barred_reason: (row.barred_reason as TenureRecord["barred_reason"]) ?? null,
        is_current: Boolean(row.is_current),
        closed_at: (row.closed_at as string | null) ?? null,
      })),
    ],
  ]);

  const episodes: SupersededEmployeeEpisode[] = (losers ?? []).map((row) => ({
    id: String(row.id),
    organization_id: String(row.organization_id ?? organizationId),
    superseded_by: String(row.superseded_by ?? plan.masterId),
    hire_date: (row.hire_date as string | null) ?? null,
    first_hire_date: (row.first_hire_date as string | null) ?? null,
    resign_date: (row.resign_date as string | null) ?? null,
    client_id: (row.client_id as string | null) ?? null,
    branch_id: (row.branch_id as string | null) ?? null,
    position_id: (row.position_id as string | null) ?? null,
    daily_rate: row.daily_rate ?? null,
    billing_daily_rate: row.billing_daily_rate ?? null,
    status: String(row.status ?? ""),
    last_payroll_end: (row.last_payroll_end as string | null) ?? null,
  }));

  const inserts = planFoldSupersededTenures(episodes, existingByMaster);
  if (inserts.length === 0) return;

  const { error: insertError } = await directory
    .from("employment_tenures")
    .insert(
      inserts.map(({ source_employee_id: _source, ...row }) => row)
    );
  if (insertError) throw new Error(`fold insert: ${insertError.message}`);
}
