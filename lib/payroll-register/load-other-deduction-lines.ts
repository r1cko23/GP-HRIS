/**
 * Load cutoff-scoped itemized other deductions for register build.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildOtherDeductionLines,
  isOtherDeductionKey,
  type OtherDeductionLine,
} from "@/lib/payroll-register/other-deduction-lines";
import { requireCutoffPeriodId } from "@/lib/payroll-register/require-cutoff-period-id";

type StandingRow = {
  directory_employee_id: string | null;
  office_employee_id: string | null;
  deduction_key: string;
  amount: number | string;
  is_active: boolean | null;
};

export type OtherDeductionLinesByPerson = {
  byDirectoryId: Map<string, OtherDeductionLine[]>;
  byOfficeId: Map<string, OtherDeductionLine[]>;
};

function emptyAmounts(): Record<string, number> {
  return {};
}

export async function loadStandingOtherDeductionLines(
  publicDb: SupabaseClient,
  opts: {
    directoryEmployeeIds: string[];
    officeEmployeeIds: string[];
    cutoffPeriodId: string;
  }
): Promise<OtherDeductionLinesByPerson> {
  const cutoffPeriodId = requireCutoffPeriodId(opts.cutoffPeriodId);
  const byDirectoryId = new Map<string, OtherDeductionLine[]>();
  const byOfficeId = new Map<string, OtherDeductionLine[]>();
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
      if (!isOtherDeductionKey(row.deduction_key)) continue;
      const amount = Math.round((Number(row.amount) || 0) * 100) / 100;
      if (amount <= 0) continue;
      if (row.directory_employee_id) {
        const bag = amountsByDir.get(row.directory_employee_id) ?? emptyAmounts();
        bag[row.deduction_key] = amount;
        amountsByDir.set(row.directory_employee_id, bag);
      } else if (row.office_employee_id) {
        const bag = amountsByOffice.get(row.office_employee_id) ?? emptyAmounts();
        bag[row.deduction_key] = amount;
        amountsByOffice.set(row.office_employee_id, bag);
      }
    }
  }

  for (let i = 0; i < dirIds.length; i += page) {
    const slice = dirIds.slice(i, i + page);
    const { data, error } = await publicDb
      .from("employee_other_deductions")
      .select(
        "directory_employee_id, office_employee_id, deduction_key, amount, is_active"
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
      .from("employee_other_deductions")
      .select(
        "directory_employee_id, office_employee_id, deduction_key, amount, is_active"
      )
      .eq("cutoff_period_id", cutoffPeriodId)
      .in("office_employee_id", slice)
      .is("directory_employee_id", null)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    await ingest((data ?? []) as StandingRow[]);
  }

  for (const [id, amounts] of amountsByDir) {
    byDirectoryId.set(id, buildOtherDeductionLines(amounts));
  }
  for (const [id, amounts] of amountsByOffice) {
    byOfficeId.set(id, buildOtherDeductionLines(amounts));
  }

  return { byDirectoryId, byOfficeId };
}

export function otherDeductionLinesForPerson(
  maps: OtherDeductionLinesByPerson,
  directoryEmployeeId: string | null | undefined,
  officeEmployeeId: string | null | undefined
): OtherDeductionLine[] {
  if (directoryEmployeeId && maps.byDirectoryId.has(directoryEmployeeId)) {
    return maps.byDirectoryId.get(directoryEmployeeId) ?? [];
  }
  if (officeEmployeeId && maps.byOfficeId.has(officeEmployeeId)) {
    return maps.byOfficeId.get(officeEmployeeId) ?? [];
  }
  return [];
}
