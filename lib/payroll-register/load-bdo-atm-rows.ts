/**
 * Load Debit Memo ATM rows for a posted Organic register run
 * (Directory pay_through + bank preferred over line snapshot).
 * Preview shape matches Debit Memo ATM PAYROLL sheet columns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDirectoryEmployeesByIds } from "@/lib/directory/fetch-employees-by-ids";
import {
  atmReportRows,
  disbursementPersonFromRegisterLine,
  type AtmReportRow,
  type DisbursementPerson,
} from "@/lib/payroll-register/disbursement-debit-memo";
import { BDO_DEFAULT_FUNDING_ACCOUNT } from "@/lib/payroll-register/bdo-atm-credit-file";

export type BdoAtmSheetPreviewRow = {
  no: number;
  accountNo: string;
  amount: number;
  name: string;
  dailyRate: number;
  rhWorked: number;
  deptStore: string;
};

export type BdoAtmLoadResult = {
  people: DisbursementPerson[];
  atmRows: AtmReportRow[];
  /** Debit Memo ATM PAYROLL sheet rows (#, Account No., Amount, Name, Daily Rate, RH, Dept). */
  preview: BdoAtmSheetPreviewRow[];
  totalAmount: number;
  fundingAccount: string;
};

export async function loadBdoAtmRowsForRun(input: {
  publicDb: SupabaseClient;
  directory: SupabaseClient;
  runId: string;
  organizationId: string;
  branchName?: string | null;
}): Promise<{ data: BdoAtmLoadResult | null; error: string | null }> {
  const { data: lines, error } = await input.publicDb
    .from("payroll_register_lines")
    .select(
      "directory_employee_id, employee_code, last_name, first_name, bank_account_no, net_pay, gross_pay, daily_rate, hours, earnings, deductions"
    )
    .eq("run_id", input.runId)
    .eq("organization_id", input.organizationId)
    .order("last_name");

  if (error) return { data: null, error: error.message };

  const rows = lines ?? [];
  const dirIds = [
    ...new Set(
      rows
        .map((row) => row.directory_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const byDir = new Map<
    string,
    {
      bank_account_no: string | null;
      gcash: string | null;
      pay_through: string | null;
      hire_date: string | null;
      middle_name: string | null;
      branch_name: string | null;
      department_name: string | null;
    }
  >();

  if (dirIds.length) {
    const { data: dirEmps, error: dirErr } = await fetchDirectoryEmployeesByIds(
      input.directory,
      dirIds,
      "id, bank_account_no, gcash, pay_through, hire_date, middle_name, branch:client_branches(name), department:client_departments(name)"
    );
    if (dirErr) return { data: null, error: dirErr.message };
    for (const row of dirEmps ?? []) {
      const branch = row.branch as { name?: string } | null;
      const department = row.department as { name?: string } | null;
      byDir.set(row.id as string, {
        bank_account_no: (row.bank_account_no as string | null) ?? null,
        gcash: (row.gcash as string | null) ?? null,
        pay_through: (row.pay_through as string | null) ?? null,
        hire_date: (row.hire_date as string | null) ?? null,
        middle_name: (row.middle_name as string | null) ?? null,
        branch_name: branch?.name ?? null,
        department_name: department?.name ?? null,
      });
    }
  }

  const fallbackBranch = String(input.branchName ?? "").trim() || null;

  const people = rows.map((row) => {
    const ids = row.directory_employee_id
      ? byDir.get(row.directory_employee_id as string)
      : undefined;
    const hours = (row.hours as Record<string, number> | null) ?? {};
    const rh =
      Number(hours.actual_regular_hours ?? hours.hours_work ?? 0) || 0;
    const dept =
      ids?.department_name || ids?.branch_name || fallbackBranch || null;
    return disbursementPersonFromRegisterLine({
      employee_code: (row.employee_code as string | null) ?? null,
      last_name: (row.last_name as string | null) ?? null,
      first_name: (row.first_name as string | null) ?? null,
      middle_name: ids?.middle_name ?? null,
      hire_date: ids?.hire_date ?? null,
      bank_account_no:
        ids?.bank_account_no ??
        ((row.bank_account_no as string | null) ?? null),
      gcash: ids?.gcash ?? null,
      pay_through: ids?.pay_through ?? null,
      net_pay: Number(row.net_pay ?? 0),
      gross_pay: Number(row.gross_pay ?? 0),
      daily_rate: Number(row.daily_rate ?? 0) || null,
      rh_worked: rh || null,
      department: dept,
      earnings: (row.earnings as Record<string, unknown> | null) ?? null,
      deductions: (row.deductions as Record<string, unknown> | null) ?? null,
    });
  });

  const atmRows = atmReportRows(people);
  const preview: BdoAtmSheetPreviewRow[] = atmRows.map((r, i) => ({
    no: i + 1,
    accountNo: r.accountNo,
    amount: r.amount,
    name: r.name,
    dailyRate: r.dailyRate,
    rhWorked: r.rhWorked,
    deptStore: r.deptStore,
  }));
  const totalAmount =
    Math.round(atmRows.reduce((a, r) => a + r.amount, 0) * 100) / 100;

  return {
    data: {
      people,
      atmRows,
      preview,
      totalAmount,
      fundingAccount: BDO_DEFAULT_FUNDING_ACCOUNT,
    },
    error: null,
  };
}
