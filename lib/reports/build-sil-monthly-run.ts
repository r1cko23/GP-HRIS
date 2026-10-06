/**
 * Load Directory anniversary roster + posted-register days for a SIL monthly run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anniversaryDateInYear,
  buildSilMonthlyRow,
  daysWorkedFromRegisterLine,
  isEligibleForSilMonthlyRun,
  matchesSilStatusFilter,
  priorAnniversaryDate,
  silMonthlyRunWindow,
  sumDaysWorkedInWindow,
  type SilMonthlyRow,
} from "@/lib/reports/sil-monthly-run";
import type { SilPayMethod } from "@/lib/reports/sil-pay-method";

export type SilBuildEmployee = {
  id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  hire_date: string | null;
  status: string | null;
  daily_rate: number | null;
};

export type SilBuildResult = {
  rows: SilMonthlyRow[];
  totals: { amount: number; days_worked: number };
};

function matchesSearch(row: SilMonthlyRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.last_name.toLowerCase().includes(needle) ||
    row.first_name.toLowerCase().includes(needle) ||
    row.employee_code.toLowerCase().includes(needle)
  );
}

export async function loadSilEligibleEmployees(input: {
  directory: SupabaseClient;
  orgId: string;
  clientId: string;
}): Promise<
  { ok: true; employees: SilBuildEmployee[] } | { ok: false; error: string }
> {
  const employees: SilBuildEmployee[] = [];
  const pageSize = 500;
  for (let off = 0; ; off += pageSize) {
    const { data: chunk, error } = await input.directory
      .from("employees")
      .select(
        "id, employee_code, last_name, first_name, hire_date, status, daily_rate"
      )
      .eq("organization_id", input.orgId)
      .eq("client_id", input.clientId)
      .eq("is_current_engagement", true)
      .order("last_name")
      .range(off, off + pageSize - 1);
    if (error) return { ok: false, error: error.message };
    const rows = chunk ?? [];
    employees.push(...(rows as SilBuildEmployee[]));
    if (rows.length < pageSize) break;
  }
  return { ok: true, employees };
}

export async function computeSilMonthlyRows(input: {
  publicDb: SupabaseClient;
  orgId: string;
  clientId: string;
  year: number;
  month: number;
  employees: SilBuildEmployee[];
  statusFilter?: string;
  q?: string;
  payMethod?: SilPayMethod;
}): Promise<
  { ok: true; value: SilBuildResult } | { ok: false; error: string }
> {
  const {
    publicDb,
    orgId,
    clientId,
    year,
    month,
    employees,
    statusFilter = "all",
    q = "",
    payMethod = "casual_prorated",
  } = input;

  const eligible = employees.filter((e) =>
    isEligibleForSilMonthlyRun(e.hire_date, year, month)
  );

  let windowFrom = `${year - 1}-${String(month).padStart(2, "0")}-01`;
  let windowTo = `${year}-${String(month).padStart(2, "0")}-31`;
  for (const e of eligible) {
    const from = priorAnniversaryDate(e.hire_date, year);
    const to = anniversaryDateInYear(e.hire_date, year);
    if (from && from < windowFrom) windowFrom = from;
    if (to && to > windowTo) windowTo = to;
  }

  const daysByDirId = new Map<string, number>();
  if (eligible.length) {
    const { data: runs, error: runError } = await publicDb
      .from("payroll_register_runs")
      .select("id, payroll_date, period_end")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .eq("status", "posted")
      .gte("payroll_date", windowFrom)
      .lte("payroll_date", windowTo);
    if (runError) return { ok: false, error: runError.message };

    const runMeta = new Map(
      (runs ?? []).map((r) => [
        r.id as string,
        String(r.payroll_date ?? r.period_end ?? "").slice(0, 10),
      ])
    );

    const linesByDir = new Map<
      string,
      Array<{ payroll_date: string; days_worked: number }>
    >();
    const linePage = 500;
    for (const run of runs ?? []) {
      const runId = run.id as string;
      const payrollDate = runMeta.get(runId) ?? "";
      for (let off = 0; ; off += linePage) {
        const { data: chunk, error: lineError } = await publicDb
          .from("payroll_register_lines")
          .select("directory_employee_id, earnings, hours")
          .eq("run_id", runId)
          .order("last_name")
          .range(off, off + linePage - 1);
        if (lineError) return { ok: false, error: lineError.message };
        const rows = chunk ?? [];
        for (const row of rows) {
          const dirId = row.directory_employee_id as string | null;
          if (!dirId) continue;
          const list = linesByDir.get(dirId) ?? [];
          list.push({
            payroll_date: payrollDate,
            days_worked: daysWorkedFromRegisterLine({
              earnings: (row.earnings ?? {}) as Record<string, unknown>,
              hours: (row.hours ?? {}) as Record<string, unknown>,
            }),
          });
          linesByDir.set(dirId, list);
        }
        if (rows.length < linePage) break;
      }
    }

    for (const e of eligible) {
      const window = silMonthlyRunWindow(e.hire_date, year);
      if (!window) {
        daysByDirId.set(e.id, 0);
        continue;
      }
      daysByDirId.set(
        e.id,
        sumDaysWorkedInWindow(linesByDir.get(e.id) ?? [], window)
      );
    }
  }

  const rows = eligible
    .filter((e) => matchesSilStatusFilter(e.status, statusFilter))
    .map((e) =>
      buildSilMonthlyRow({
        directory_employee_id: e.id,
        employee_code: e.employee_code,
        last_name: e.last_name,
        first_name: e.first_name,
        hire_date: e.hire_date,
        status: e.status,
        daily_rate: e.daily_rate != null ? Number(e.daily_rate) : 0,
        days_worked: daysByDirId.get(e.id) ?? 0,
        pay_method: payMethod,
      })
    )
    .filter((r) => matchesSearch(r, q))
    .sort((a, b) => {
      const ln = a.last_name.localeCompare(b.last_name);
      if (ln !== 0) return ln;
      return a.first_name.localeCompare(b.first_name);
    });

  const totals = {
    amount: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
    days_worked:
      Math.round(rows.reduce((s, r) => s + r.days_worked, 0) * 100) / 100,
  };

  return { ok: true, value: { rows, totals } };
}

export function silRowToLineInsert(
  row: SilMonthlyRow,
  meta: {
    run_id: string;
    organization_id: string;
    client_id: string;
    year: number;
  }
) {
  const window = silMonthlyRunWindow(row.hire_date, meta.year);
  return {
    run_id: meta.run_id,
    organization_id: meta.organization_id,
    client_id: meta.client_id,
    directory_employee_id: row.directory_employee_id,
    employee_code: row.employee_code || null,
    last_name: row.last_name || null,
    first_name: row.first_name || null,
    hire_date: row.hire_date || null,
    employment_status: row.employment_status || null,
    daily_rate: row.daily_rate,
    days_worked: row.days_worked,
    months: row.months,
    computation: row.computation,
    days_entitlement: row.days_entitlement,
    amount: row.amount,
    remarks: row.remarks || null,
    window_from: window?.from ?? null,
    window_to: window?.to ?? null,
  };
}

export function lineRecordToSilRow(line: Record<string, unknown>): SilMonthlyRow {
  return {
    directory_employee_id: (line.directory_employee_id as string | null) ?? null,
    employee_code: String(line.employee_code ?? ""),
    last_name: String(line.last_name ?? ""),
    first_name: String(line.first_name ?? ""),
    hire_date: String(line.hire_date ?? "").slice(0, 10),
    employment_status: String(line.employment_status ?? ""),
    status: String(line.employment_status ?? "").toLowerCase(),
    daily_rate: Number(line.daily_rate ?? 0),
    days_worked: Number(line.days_worked ?? 0),
    months: Number(line.months ?? 0),
    computation: Number(line.computation ?? 0),
    days_entitlement: Number(line.days_entitlement ?? 0),
    amount: Number(line.amount ?? 0),
    remarks: String(line.remarks ?? ""),
  };
}
