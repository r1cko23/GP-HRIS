/**
 * Merge same-name Directory clients: keep the active row, retarget FKs from the inactive twin.
 * Never deletes client rows (cutoff / billing FKs CASCADE).
 */

export type MergeClientRow = {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  legacy_id?: number | null;
  created_at?: string | null;
};

export type ClientMergePlan = {
  keepId: string;
  mergeId: string;
  organization_id: string;
  name: string;
  keep_legacy_id: number | null;
  merge_legacy_id: number | null;
};

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * One active + one inactive sharing a normalized name within an org → merge inactive onto active.
 */
export function planClientNameMerges(rows: MergeClientRow[]): ClientMergePlan[] {
  const byKey = new Map<string, MergeClientRow[]>();
  for (const row of rows) {
    const key = `${row.organization_id}|${normName(row.name)}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const plans: ClientMergePlan[] = [];
  for (const members of byKey.values()) {
    if (members.length < 2) continue;
    const active = members.filter((row) => row.status === "active");
    const inactive = members.filter((row) => row.status === "inactive");
    if (active.length !== 1 || inactive.length !== 1) continue;
    const keep = active[0]!;
    const merge = inactive[0]!;
    plans.push({
      keepId: keep.id,
      mergeId: merge.id,
      organization_id: keep.organization_id,
      name: keep.name,
      keep_legacy_id: keep.legacy_id ?? null,
      merge_legacy_id: merge.legacy_id ?? null,
    });
  }
  return plans.sort((a, b) => a.name.localeCompare(b.name));
}
