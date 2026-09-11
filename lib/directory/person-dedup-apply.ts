import type { SupabaseClient } from "@supabase/supabase-js";
import { aliasConflictAction, type CollapsePlan } from "@/lib/directory/person-dedup";

type Collapse = Extract<CollapsePlan, { action: "collapse" }>;

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
        note: "Extra 201 parked under person master (split current engagement)",
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
                note: "Extra 201 parked under person master (split current engagement)",
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
          remarks: [
            "Extra 201 parked under person master.",
            alias.alias_code ? `code=${alias.alias_code}` : null,
            alias.legacy_id != null ? `legacy_id=${alias.legacy_id}` : null,
            `source_row=${alias.source_employee_id}`,
          ]
            .filter(Boolean)
            .join(" · "),
        });
        if (error) continue;
        movements += 1;
      }
    }
  }

  return { masters, losers, aliases, aliases_skipped, aliases_retargeted, movements };
}
