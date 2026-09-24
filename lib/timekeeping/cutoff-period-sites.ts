/**
 * Deployed cutoff pay scope: one Site (pay separately) or many Sites (pay together).
 * Regular cutoffs: a Site may appear in at most one cutoff for the same client+dates.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ExistingCutoffSiteRow = {
  cutoff_period_id: string;
  branch_id: string;
  period_kind?: string | null;
  status?: string | null;
};

export type SiteClaimConflict = {
  branch_id: string;
  cutoff_period_id: string;
};

export function normalizeCutoffBranchIds(opts: {
  branch_id?: string | null;
  branch_ids?: string[] | null;
}): string[] {
  const fromList = (opts.branch_ids ?? [])
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter(Boolean);
  if (fromList.length) {
    return [...new Set(fromList)];
  }
  const single =
    typeof opts.branch_id === "string" ? opts.branch_id.trim() : "";
  return single ? [single] : [];
}

/** Single-Site keeps branch_id on the period; multi-Site leaves it null. */
export function periodBranchIdForInsert(branchIds: string[]): string | null {
  return branchIds.length === 1 ? branchIds[0]! : null;
}

export function collectClaimedBranchIds(opts: {
  periodBranchId?: string | null;
  junctionBranchIds?: string[] | null;
}): string[] {
  const out = new Set<string>();
  if (opts.periodBranchId) out.add(opts.periodBranchId);
  for (const id of opts.junctionBranchIds ?? []) {
    if (id) out.add(id);
  }
  return [...out];
}

/**
 * Regular (non-cancelled) cutoffs already claiming any of the selected Sites
 * for the same client+dates block create/reuse.
 */
export function findConflictingSiteClaims(
  selectedBranchIds: string[],
  existing: ExistingCutoffSiteRow[],
  opts?: { excludeCutoffPeriodId?: string }
): SiteClaimConflict[] {
  const selected = new Set(selectedBranchIds.filter(Boolean));
  if (!selected.size) return [];

  const conflicts: SiteClaimConflict[] = [];
  const seen = new Set<string>();

  for (const row of existing) {
    if (!row.branch_id || !selected.has(row.branch_id)) continue;
    if (opts?.excludeCutoffPeriodId && row.cutoff_period_id === opts.excludeCutoffPeriodId) {
      continue;
    }
    if ((row.period_kind ?? "regular") === "adjustment") continue;
    if (row.status === "cancelled") continue;

    const key = `${row.branch_id}:${row.cutoff_period_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    conflicts.push({
      branch_id: row.branch_id,
      cutoff_period_id: row.cutoff_period_id,
    });
  }

  return conflicts;
}

export function resolveCutoffSiteIds(opts: {
  branch_id?: string | null;
  site_branch_ids?: string[] | null;
}): string[] {
  const fromJunction = [...new Set((opts.site_branch_ids ?? []).filter(Boolean))];
  if (fromJunction.length) return fromJunction;
  return opts.branch_id ? [opts.branch_id] : [];
}

export function formatCutoffSitesLabel(
  branchIds: string[],
  nameById: Record<string, string> | Map<string, string>
): string {
  const ids = branchIds.filter(Boolean);
  if (!ids.length) return "—";
  const nameOf = (id: string) =>
    nameById instanceof Map ? nameById.get(id) : nameById[id];
  if (ids.length === 1) {
    return nameOf(ids[0]!) || ids[0]!;
  }
  return `${ids.length} sites`;
}

export function formatCutoffSitesDetail(
  branchIds: string[],
  nameById: Record<string, string> | Map<string, string>
): string {
  const ids = branchIds.filter(Boolean);
  const nameOf = (id: string) =>
    (nameById instanceof Map ? nameById.get(id) : nameById[id]) || id;
  return ids.map(nameOf).join(", ");
}

export type GpClientIngestSiteResult = {
  cutoff_period_id: string;
  hours_upserted: number;
  skipped: Array<{ full_name: string; missing: string[] }>;
};

export function aggregateGpClientIngestResults(
  results: GpClientIngestSiteResult[]
): GpClientIngestSiteResult & { sites_ingested: number } {
  const cutoff_period_id = results[0]?.cutoff_period_id ?? "";
  let hours_upserted = 0;
  const skipped: Array<{ full_name: string; missing: string[] }> = [];
  for (const row of results) {
    hours_upserted += row.hours_upserted;
    skipped.push(...row.skipped);
  }
  return {
    cutoff_period_id,
    hours_upserted,
    skipped,
    sites_ingested: results.length,
  };
}

export function siteCoverageConflictMessage(
  conflicts: SiteClaimConflict[]
): string {
  if (!conflicts.length) return "";
  const first = conflicts[0]!;
  const extra =
    conflicts.length > 1 ? ` (+${conflicts.length - 1} more)` : "";
  return `Site already on another cutoff for these dates (${first.cutoff_period_id.slice(0, 8)}…)${extra}`;
}

/** Load Regular site claims for a client+dates window (junction + legacy branch_id). */
export async function loadExistingSiteClaimsForDates(
  publicDb: SupabaseClient,
  opts: {
    organizationId: string;
    clientId: string;
    periodStart: string;
    periodEnd: string;
  }
): Promise<{ claims: ExistingCutoffSiteRow[]; error: string | null }> {
  const { data: periods, error } = await publicDb
    .from("cutoff_periods")
    .select("id, branch_id, period_kind, status")
    .eq("organization_id", opts.organizationId)
    .eq("client_id", opts.clientId)
    .eq("period_start", opts.periodStart)
    .eq("period_end", opts.periodEnd)
    .neq("status", "cancelled");

  if (error) return { claims: [], error: error.message };
  if (!periods?.length) return { claims: [], error: null };

  const periodIds = periods.map((row) => row.id as string);
  const { data: junction, error: junctionError } = await publicDb
    .from("cutoff_period_sites")
    .select("cutoff_period_id, branch_id")
    .in("cutoff_period_id", periodIds);

  if (junctionError) return { claims: [], error: junctionError.message };

  const byPeriod = new Map(
    periods.map((row) => [
      row.id as string,
      {
        period_kind: row.period_kind as string | null,
        status: row.status as string | null,
        branch_id: row.branch_id as string | null,
      },
    ])
  );

  const claims: ExistingCutoffSiteRow[] = [];
  const seen = new Set<string>();

  for (const row of junction ?? []) {
    const periodId = row.cutoff_period_id as string;
    const branchId = row.branch_id as string;
    const meta = byPeriod.get(periodId);
    if (!meta || !branchId) continue;
    const key = `${periodId}:${branchId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      cutoff_period_id: periodId,
      branch_id: branchId,
      period_kind: meta.period_kind,
      status: meta.status,
    });
  }

  for (const [periodId, meta] of byPeriod) {
    if (!meta.branch_id) continue;
    const key = `${periodId}:${meta.branch_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      cutoff_period_id: periodId,
      branch_id: meta.branch_id,
      period_kind: meta.period_kind,
      status: meta.status,
    });
  }

  return { claims, error: null };
}

export async function insertCutoffPeriodSites(
  publicDb: SupabaseClient,
  cutoffPeriodId: string,
  branchIds: string[]
): Promise<{ error: string | null }> {
  const unique = [...new Set(branchIds.filter(Boolean))];
  if (!unique.length) return { error: null };
  const { error } = await publicDb.from("cutoff_period_sites").insert(
    unique.map((branch_id) => ({
      cutoff_period_id: cutoffPeriodId,
      branch_id,
    }))
  );
  return { error: error?.message ?? null };
}

export async function loadCutoffPeriodSiteIds(
  publicDb: SupabaseClient,
  cutoffPeriodId: string,
  fallbackBranchId?: string | null
): Promise<{ branchIds: string[]; error: string | null }> {
  const { data, error } = await publicDb
    .from("cutoff_period_sites")
    .select("branch_id")
    .eq("cutoff_period_id", cutoffPeriodId);
  if (error) return { branchIds: [], error: error.message };
  const fromJunction = (data ?? [])
    .map((row) => row.branch_id as string)
    .filter(Boolean);
  return {
    branchIds: resolveCutoffSiteIds({
      branch_id: fallbackBranchId,
      site_branch_ids: fromJunction,
    }),
    error: null,
  };
}

/** Period ids that include this Site (junction or legacy branch_id). */
export async function cutoffPeriodIdsCoveringBranch(
  publicDb: SupabaseClient,
  organizationId: string,
  branchId: string
): Promise<{ ids: string[]; error: string | null }> {
  const { data: junction, error: junctionError } = await publicDb
    .from("cutoff_period_sites")
    .select("cutoff_period_id")
    .eq("branch_id", branchId);
  if (junctionError) return { ids: [], error: junctionError.message };

  const { data: legacy, error: legacyError } = await publicDb
    .from("cutoff_periods")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId);
  if (legacyError) return { ids: [], error: legacyError.message };

  return {
    ids: [
      ...new Set([
        ...(junction ?? []).map((row) => row.cutoff_period_id as string),
        ...(legacy ?? []).map((row) => row.id as string),
      ]),
    ],
    error: null,
  };
}

export async function attachCutoffPeriodBranchIds<
  T extends { id: string; branch_id?: string | null },
>(
  publicDb: SupabaseClient,
  rows: T[]
): Promise<{ rows: Array<T & { branch_ids: string[] }>; error: string | null }> {
  if (!rows.length) return { rows: [], error: null };
  const ids = rows.map((row) => row.id);
  const { data, error } = await publicDb
    .from("cutoff_period_sites")
    .select("cutoff_period_id, branch_id")
    .in("cutoff_period_id", ids);
  if (error) return { rows: [], error: error.message };

  const byPeriod = new Map<string, string[]>();
  for (const row of data ?? []) {
    const periodId = row.cutoff_period_id as string;
    const branchId = row.branch_id as string;
    if (!branchId) continue;
    const list = byPeriod.get(periodId) ?? [];
    list.push(branchId);
    byPeriod.set(periodId, list);
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      branch_ids: resolveCutoffSiteIds({
        branch_id: row.branch_id,
        site_branch_ids: byPeriod.get(row.id) ?? [],
      }),
    })),
    error: null,
  };
}
