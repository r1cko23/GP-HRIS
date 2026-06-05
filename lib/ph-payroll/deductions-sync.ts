/**
 * Sync wide cutoff deduction form → row-based employee_deductions.
 * Frappe HR Salary Component pattern: one row per component per cutoff.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CutoffDeductions } from "./types";
import {
  CUTOFF_FIELD_TO_TYPE,
  LEGACY_DEDUCTION_TYPES,
  MANAGED_DEDUCTION_TYPES,
} from "./deductions-loader";

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface SyncCutoffDeductionsInput {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  deductions: CutoffDeductions;
}

/**
 * Replace managed deduction rows for an employee within a cutoff period.
 * Deletes legacy alias rows too so saves don't leave duplicate amounts.
 */
export async function syncCutoffDeductions(
  supabase: SupabaseClient,
  input: SyncCutoffDeductionsInput
): Promise<{ error: Error | null }> {
  const { employeeId, periodStart, periodEnd, deductions } = input;

  const { error: deleteError } = await supabase
    .from("employee_deductions")
    .delete()
    .eq("employee_id", employeeId)
    .gte("deduction_date", periodStart)
    .lte("deduction_date", periodEnd)
    .in("deduction_type", [...MANAGED_DEDUCTION_TYPES]);

  if (deleteError) {
    return { error: deleteError };
  }

  const rows = (
    Object.entries(CUTOFF_FIELD_TO_TYPE) as [keyof CutoffDeductions, string][]
  )
    .map(([field, deductionType]) => {
      const amount = roundTo2(deductions[field] || 0);
      if (amount <= 0) return null;
      return {
        employee_id: employeeId,
        deduction_type: deductionType,
        amount,
        deduction_date: periodStart,
        description: `Cutoff ${periodStart} – ${periodEnd}`,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    return { error: null };
  }

  const { error: insertError } = await supabase
    .from("employee_deductions")
    .insert(rows);

  return { error: insertError };
}
