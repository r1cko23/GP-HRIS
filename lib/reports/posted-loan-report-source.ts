/**
 * Load posted register lines + Directory person IDs for remittance-style loan reports.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoansReportSourceLine } from "@/lib/reports/loans-report";

type DirPerson = {
  id: string;
  middle_name: string | null;
  birth_date: string | null;
  sss_number: string | null;
  pagibig_number: string | null;
};

export type PostedLoanReportLoad = {
  source: LoansReportSourceLine[];
  clientNameFilter: string | null;
};

export async function loadPostedLoanReportSource(input: {
  publicDb: SupabaseClient;
  directory: SupabaseClient;
  orgId: string;
  clientId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<{ ok: true; value: PostedLoanReportLoad } | { ok: false; error: string }> {
  const { publicDb, directory, orgId } = input;
  const clientId = input.clientId ?? null;
  const dateFrom = input.dateFrom ?? null;
  const dateTo = input.dateTo ?? null;

  let clientNameFilter: string | null = null;
  const clientNameById = new Map<string, string>();

  if (clientId) {
    const { data: client, error: clientError } = await directory
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (clientError) return { ok: false, error: clientError.message };
    if (!client) return { ok: false, error: "Client not found" };
    clientNameById.set(client.id as string, String(client.name ?? "").trim());
    clientNameFilter = String(client.name ?? "").trim();
  }

  let runsQuery = publicDb
    .from("payroll_register_runs")
    .select("id, client_id, period_start, period_end, payroll_date, status")
    .eq("organization_id", orgId)
    .eq("status", "posted")
    .order("period_end", { ascending: false });

  if (clientId) runsQuery = runsQuery.eq("client_id", clientId);
  // MAIN remittance filters on payout date (payroll_date), not cutoff end.
  if (dateFrom) runsQuery = runsQuery.gte("payroll_date", dateFrom);
  if (dateTo) runsQuery = runsQuery.lte("payroll_date", dateTo);

  const { data: runs, error: runError } = await runsQuery;
  if (runError) return { ok: false, error: runError.message };

  const runRows = runs ?? [];
  if (!runRows.length) {
    return { ok: true, value: { source: [], clientNameFilter } };
  }

  const missingClientIds = [
    ...new Set(
      runRows
        .map((r) => r.client_id as string)
        .filter((id) => id && !clientNameById.has(id))
    ),
  ];
  if (missingClientIds.length) {
    for (let i = 0; i < missingClientIds.length; i += 200) {
      const slice = missingClientIds.slice(i, i + 200);
      const { data: clients } = await directory
        .from("clients")
        .select("id, name")
        .eq("organization_id", orgId)
        .in("id", slice);
      for (const c of clients ?? []) {
        clientNameById.set(c.id as string, String(c.name ?? "").trim());
      }
    }
  }

  const runMeta = new Map(
    runRows.map((r) => [
      r.id as string,
      {
        client_name: clientNameById.get(r.client_id as string) ?? "",
        period_start: String(r.period_start ?? ""),
        period_end: String(r.period_end ?? ""),
        payout_date: r.payroll_date ? String(r.payroll_date) : "",
      },
    ])
  );

  const lineRows: Array<Record<string, unknown>> = [];
  const page = 500;
  for (const run of runRows) {
    const runId = run.id as string;
    for (let off = 0; ; off += page) {
      const { data: chunk, error: lineError } = await publicDb
        .from("payroll_register_lines")
        .select(
          "directory_employee_id, employee_code, last_name, first_name, loan_lines, client_id"
        )
        .eq("run_id", runId)
        .order("last_name")
        .range(off, off + page - 1);
      if (lineError) return { ok: false, error: lineError.message };
      const rows = chunk ?? [];
      for (const row of rows) {
        lineRows.push({ ...row, _run_id: runId });
      }
      if (rows.length < page) break;
    }
  }

  const dirIds = [
    ...new Set(
      lineRows
        .map((l) => l.directory_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const personById = new Map<string, DirPerson>();
  if (dirIds.length) {
    for (let i = 0; i < dirIds.length; i += 200) {
      const slice = dirIds.slice(i, i + 200);
      const { data: people } = await directory
        .from("employees")
        .select("id, middle_name, birth_date, sss_number, pagibig_number")
        .in("id", slice);
      for (const p of people ?? []) {
        personById.set(p.id as string, {
          id: p.id as string,
          middle_name: (p.middle_name as string | null) ?? null,
          birth_date: (p.birth_date as string | null) ?? null,
          sss_number: (p.sss_number as string | null) ?? null,
          pagibig_number: (p.pagibig_number as string | null) ?? null,
        });
      }
    }
  }

  const source: LoansReportSourceLine[] = lineRows.map((line) => {
    const meta = runMeta.get(line._run_id as string);
    const dirId = (line.directory_employee_id as string | null) ?? null;
    const person = dirId ? personById.get(dirId) : undefined;
    return {
      client_name: meta?.client_name ?? "",
      department: null,
      employee_code: (line.employee_code as string | null) ?? null,
      last_name: (line.last_name as string | null) ?? null,
      first_name: (line.first_name as string | null) ?? null,
      middle_name: person?.middle_name ?? null,
      date_of_birth: person?.birth_date ?? null,
      pagibig_no: person?.pagibig_number ?? null,
      sss_no: person?.sss_number ?? null,
      period_start: meta?.period_start ?? null,
      period_end: meta?.period_end ?? null,
      payout_date: meta?.payout_date || null,
      loan_lines: (line.loan_lines as LoansReportSourceLine["loan_lines"]) ?? [],
    };
  });

  return { ok: true, value: { source, clientNameFilter } };
}
