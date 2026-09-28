/**
 * Load cutoff-scoped allowances for register build (TL / Load / Supervisory).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAllowanceLines,
  isAllowanceKey,
  type AllowanceLine,
} from "@/lib/payroll-register/allowance-lines";
import { requireCutoffPeriodId } from "@/lib/payroll-register/require-cutoff-period-id";

type StandingRow = {
  directory_employee_id: string | null;
  office_employee_id: string | null;
  allowance_key: string;
  amount: number | string;
  is_active: boolean | null;
};

export type AllowanceLinesByPerson = {
  byDirectoryId: Map<string, AllowanceLine[]>;
  byOfficeId: Map<string, AllowanceLine[]>;
};

function emptyAmounts(): Record<string, number> {
  return {};
}

export async function loadStandingAllowanceLines(
  publicDb: SupabaseClient,
  opts: {
    directoryEmployeeIds: string[];
    officeEmployeeIds: string[];
    cutoffPeriodId: string;
  }
): Promise<AllowanceLinesByPerson> {
  const cutoffPeriodId = requireCutoffPeriodId(opts.cutoffPeriodId);
  const byDirectoryId = new Map<string, AllowanceLine[]>();
  const byOfficeId = new Map<string, AllowanceLine[]>();
  const dirIds = [...new Set(opts.directoryEmployeeIds.filter(Boolean))];
  const officeIds = [...new Set(opts.officeEmployeeIds.filter(Boolean))];
  if (!dirIds.length && !officeIds.length) {
    return { byDirectoryId, byOfficeId };
  }

  const amountsByDir = new Map<string, Record<string, number>>();
  const amountsByOffice = new Map<string, Record<string, number>>();

  const page = 500;
  async function ingest(rows: StandingRow[]) {
    for (const row of rows) {
      if (row.is_active === false) continue;
      if (!isAllowanceKey(row.allowance_key)) continue;
      const amount = Math.round((Number(row.amount) || 0) * 100) / 100;
      if (amount <= 0) continue;
      if (row.directory_employee_id) {
        const bag = amountsByDir.get(row.directory_employee_id) ?? emptyAmounts();
        bag[row.allowance_key] = amount;
        amountsByDir.set(row.directory_employee_id, bag);
      } else if (row.office_employee_id) {
        const bag =
          amountsByOffice.get(row.office_employee_id) ?? emptyAmounts();
        bag[row.allowance_key] = amount;
        amountsByOffice.set(row.office_employee_id, bag);
      }
    }
  }

  for (let i = 0; i < dirIds.length; i += page) {
    const slice = dirIds.slice(i, i + page);
    const { data, error } = await publicDb
      .from("employee_allowances")
      .select(
        "directory_employee_id, office_employee_id, allowance_key, amount, is_active"
      )
      .eq("cutoff_period_id", cutoffPeriodId)
      .in("directory_employee_id", slice)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    await ingest((data ?? []) as StandingRow[]);
  }

  for (let i = 0; i < officeIds.length; i += page) {
    const slice = officeIds.slice(i, i + page);
    const { data, error } = await publicDb
      .from("employee_allowances")
      .select(
        "directory_employee_id, office_employee_id, allowance_key, amount, is_active"
      )
      .eq("cutoff_period_id", cutoffPeriodId)
      .in("office_employee_id", slice)
      .is("directory_employee_id", null)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    await ingest((data ?? []) as StandingRow[]);
  }

  for (const [id, amounts] of amountsByDir) {
    byDirectoryId.set(id, buildAllowanceLines(amounts));
  }
  for (const [id, amounts] of amountsByOffice) {
    byOfficeId.set(id, buildAllowanceLines(amounts));
  }

  return { byDirectoryId, byOfficeId };
}

export function allowanceLinesForPerson(
  maps: AllowanceLinesByPerson,
  directoryEmployeeId: string | null | undefined,
  officeEmployeeId: string | null | undefined
): AllowanceLine[] {
  if (directoryEmployeeId && maps.byDirectoryId.has(directoryEmployeeId)) {
    return maps.byDirectoryId.get(directoryEmployeeId) ?? [];
  }
  if (officeEmployeeId && maps.byOfficeId.has(officeEmployeeId)) {
    return maps.byOfficeId.get(officeEmployeeId) ?? [];
  }
  return [];
}
