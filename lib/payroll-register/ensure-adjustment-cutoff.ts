/**
 * Open or reuse an Adjustment cutoff for a posted regular source (ADR 0017).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCutoffPeriodKind } from "@/lib/timekeeping/cutoff-period-kind";

export type SourceCutoffRow = {
  id: string;
  organization_id: string;
  client_id: string;
  branch_id?: string | null;
  period_start: string;
  period_end: string;
  payroll_date?: string | null;
  pay_frequency?: string | null;
  source_app?: string | null;
  status: string;
  period_kind?: string | null;
};

export type EnsureAdjustmentCutoffResult =
  | { ok: true; created: boolean; cutoff: Record<string, unknown> }
  | { ok: false; error: string; status: number };

export function planEnsureAdjustmentCutoff(source: SourceCutoffRow): {
  ok: true;
} | { ok: false; error: string; status: number } {
  if (parseCutoffPeriodKind(source.period_kind) === "adjustment") {
    return {
      ok: false,
      error: "Cannot open an adjustment from another adjustment cutoff",
      status: 400,
    };
  }
  if (source.status !== "posted") {
    return {
      ok: false,
      error: "Adjustment runs start from a posted regular cutoff",
      status: 409,
    };
  }
  return { ok: true };
}

async function syncAdjustmentPayrollDate(
  publicDb: SupabaseClient,
  cutoff: Record<string, unknown>,
  payrollDate?: string | null
): Promise<Record<string, unknown>> {
  const next = payrollDate?.trim().slice(0, 10) || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return cutoff;
  if (cutoff.status === "posted") return cutoff;
  if (String(cutoff.payroll_date ?? "").slice(0, 10) === next) return cutoff;
  const { data, error } = await publicDb
    .from("cutoff_periods")
    .update({
      payroll_date: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cutoff.id as string)
    .select("*")
    .single();
  if (error || !data) return cutoff;
  return data as Record<string, unknown>;
}

export async function ensureAdjustmentCutoff(input: {
  publicDb: SupabaseClient;
  source: SourceCutoffRow;
  userId?: string | null;
  payrollDate?: string | null;
  notes?: string | null;
}): Promise<EnsureAdjustmentCutoffResult> {
  const planned = planEnsureAdjustmentCutoff(input.source);
  if (!planned.ok) return planned;

  const { data: bySource, error: bySourceError } = await input.publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("organization_id", input.source.organization_id)
    .eq("source_cutoff_period_id", input.source.id)
    .eq("period_kind", "adjustment")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bySourceError) {
    return { ok: false, error: bySourceError.message, status: 500 };
  }
  if (bySource) {
    const synced = await syncAdjustmentPayrollDate(
      input.publicDb,
      bySource as Record<string, unknown>,
      input.payrollDate
    );
    return {
      ok: true,
      created: false,
      cutoff: synced,
    };
  }

  const { data: existing, error: existingError } = await input.publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("organization_id", input.source.organization_id)
    .eq("client_id", input.source.client_id)
    .eq("period_start", input.source.period_start)
    .eq("period_end", input.source.period_end)
    .eq("period_kind", "adjustment")
    .neq("status", "cancelled")
    .maybeSingle();
  if (existingError) {
    return { ok: false, error: existingError.message, status: 500 };
  }
  if (existing) {
    const synced = await syncAdjustmentPayrollDate(
      input.publicDb,
      existing as Record<string, unknown>,
      input.payrollDate
    );
    return { ok: true, created: false, cutoff: synced };
  }

  const payrollDate =
    input.payrollDate?.slice(0, 10) ||
    input.source.payroll_date ||
    null;
  const notes =
    input.notes?.trim() ||
    `Adjustment for posted cutoff ${input.source.period_start}–${input.source.period_end}`;

  const { data: created, error: createError } = await input.publicDb
    .from("cutoff_periods")
    .insert({
      organization_id: input.source.organization_id,
      client_id: input.source.client_id,
      branch_id: input.source.branch_id ?? null,
      period_start: input.source.period_start,
      period_end: input.source.period_end,
      payroll_date: payrollDate,
      pay_frequency: input.source.pay_frequency ?? null,
      source_app: input.source.source_app ?? "gp-payroll-timekeeping-attendance",
      status: "draft",
      period_kind: "adjustment",
      source_cutoff_period_id: input.source.id,
      notes,
      created_by: input.userId ?? null,
    })
    .select("*")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      const { data: raced } = await input.publicDb
        .from("cutoff_periods")
        .select("*")
        .eq("organization_id", input.source.organization_id)
        .eq("client_id", input.source.client_id)
        .eq("period_start", input.source.period_start)
        .eq("period_end", input.source.period_end)
        .eq("period_kind", "adjustment")
        .neq("status", "cancelled")
        .maybeSingle();
      if (raced) {
        return { ok: true, created: false, cutoff: raced as Record<string, unknown> };
      }
      return {
        ok: false,
        error: "Adjustment cutoff already exists for this period",
        status: 409,
      };
    }
    return { ok: false, error: createError.message, status: 400 };
  }

  return { ok: true, created: true, cutoff: created as Record<string, unknown> };
}
