/**
 * Load cutoff-scoped refund amounts for register build (earnings.adjustment).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRefundAmount } from "@/lib/benefits/cutoff-refund";
import { requireCutoffPeriodId } from "@/lib/payroll-register/require-cutoff-period-id";

type RefundRow = {
  directory_employee_id: string | null;
  office_employee_id: string | null;
  amount: number | string;
  is_active: boolean | null;
};

export type RefundAmountsByPerson = {
  byDirectoryId: Map<string, number>;
  byOfficeId: Map<string, number>;
};

export async function loadCutoffRefundAmounts(
  publicDb: SupabaseClient,
  opts: {
    directoryEmployeeIds: string[];
    officeEmployeeIds: string[];
    cutoffPeriodId: string;
  }
): Promise<RefundAmountsByPerson> {
  const cutoffPeriodId = requireCutoffPeriodId(opts.cutoffPeriodId);
  const byDirectoryId = new Map<string, number>();
  const byOfficeId = new Map<string, number>();
  const dirIds = [...new Set(opts.directoryEmployeeIds.filter(Boolean))];
  const officeIds = [...new Set(opts.officeEmployeeIds.filter(Boolean))];
  if (!dirIds.length && !officeIds.length) {
    return { byDirectoryId, byOfficeId };
  }

  const page = 500;
  async function ingest(rows: RefundRow[]) {
    for (const row of rows) {
      if (row.is_active === false) continue;
      const amount = normalizeRefundAmount(row.amount);
      if (!(amount > 0)) continue;
      if (row.directory_employee_id) {
        byDirectoryId.set(row.directory_employee_id, amount);
      } else if (row.office_employee_id) {
        byOfficeId.set(row.office_employee_id, amount);
      }
    }
  }

  for (let i = 0; i < dirIds.length; i += page) {
    const slice = dirIds.slice(i, i + page);
    const { data, error } = await publicDb
      .from("employee_refunds")
      .select(
        "directory_employee_id, office_employee_id, amount, is_active"
      )
      .eq("cutoff_period_id", cutoffPeriodId)
      .in("directory_employee_id", slice)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    await ingest((data ?? []) as RefundRow[]);
  }

  for (let i = 0; i < officeIds.length; i += page) {
    const slice = officeIds.slice(i, i + page);
    const { data, error } = await publicDb
      .from("employee_refunds")
      .select(
        "directory_employee_id, office_employee_id, amount, is_active"
      )
      .eq("cutoff_period_id", cutoffPeriodId)
      .in("office_employee_id", slice)
      .is("directory_employee_id", null)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    await ingest((data ?? []) as RefundRow[]);
  }

  return { byDirectoryId, byOfficeId };
}

export function refundAmountForPerson(
  maps: RefundAmountsByPerson,
  directoryEmployeeId: string | null | undefined,
  officeEmployeeId: string | null | undefined
): number {
  if (directoryEmployeeId && maps.byDirectoryId.has(directoryEmployeeId)) {
    return maps.byDirectoryId.get(directoryEmployeeId) ?? 0;
  }
  if (officeEmployeeId && maps.byOfficeId.has(officeEmployeeId)) {
    return maps.byOfficeId.get(officeEmployeeId) ?? 0;
  }
  return 0;
}
