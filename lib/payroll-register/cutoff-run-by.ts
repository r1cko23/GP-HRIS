import type { SupabaseClient } from "@supabase/supabase-js";
import { formatProseDisplay } from "@/lib/prose-text";

export type CutoffRunBySource = {
  cutoff_period_id: string;
  posted_by: string | null;
  posted_by_name: string | null;
};

export type UserNameRow = {
  id: string;
  full_name: string | null;
};

/** MAIN payroll_summary.pcreatedby values for one cutoff. */
export function catalogPostedByName(
  rows: Array<{ pcreatedby?: unknown }>
): string | null {
  const names = [
    ...new Set(
      rows
        .map((row) => String(row.pcreatedby ?? "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
  if (!names.length) return null;
  return names.join(", ");
}

export function formatCutoffRunBy(
  postedByName: string | null | undefined,
  userFullName?: string | null
): string | null {
  const raw =
    String(postedByName ?? "").trim() || String(userFullName ?? "").trim();
  if (!raw) return null;
  const display = formatProseDisplay(raw);
  return display === "—" ? null : display;
}

export function attachCutoffRunBy<T extends { id: string }>(
  periods: T[],
  runs: CutoffRunBySource[],
  users: UserNameRow[] = []
): Array<T & { run_by: string | null }> {
  const byCutoff = new Map(runs.map((run) => [run.cutoff_period_id, run]));
  const byUser = new Map(users.map((user) => [user.id, user.full_name]));
  return periods.map((period) => {
    const run = byCutoff.get(period.id);
    if (!run) return { ...period, run_by: null };
    const userName = run.posted_by ? byUser.get(run.posted_by) ?? null : null;
    return {
      ...period,
      run_by: formatCutoffRunBy(run.posted_by_name, userName),
    };
  });
}

export async function loadCutoffRunBySources(
  publicDb: SupabaseClient,
  cutoffIds: string[]
): Promise<{ runs: CutoffRunBySource[]; users: UserNameRow[] }> {
  if (!cutoffIds.length) return { runs: [], users: [] };

  const { data: runs, error } = await publicDb
    .from("payroll_register_runs")
    .select("cutoff_period_id, posted_by, posted_by_name")
    .in("cutoff_period_id", cutoffIds);
  if (error) throw new Error(error.message);

  const userIds = [
    ...new Set(
      (runs ?? [])
        .map((run) => run.posted_by as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (!userIds.length) {
    return { runs: (runs ?? []) as CutoffRunBySource[], users: [] };
  }

  const { data: users, error: userError } = await publicDb
    .from("users")
    .select("id, full_name")
    .in("id", userIds);
  if (userError) throw new Error(userError.message);

  return {
    runs: (runs ?? []) as CutoffRunBySource[],
    users: (users ?? []) as UserNameRow[],
  };
}
