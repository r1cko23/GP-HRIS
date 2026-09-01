import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  compareRegisterToLegacy,
  fetchLegacyPayrollSummary,
  parityRowsToCsv,
  type PayrollParityRow,
} from "@/lib/legacy-greenhrismain/payroll-summary-parity";
import { legacySqlConfigured } from "@/lib/legacy-greenhrismain/sql";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

/**
 * Diagnostic: GP payroll register vs GREENHRISMAIN payroll_summary (ADR 0009).
 * GET ?cutoff_period_id=… [&format=csv]
 */
export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const cutoffId = request.nextUrl.searchParams.get("cutoff_period_id")?.trim();
  if (!cutoffId) {
    return jsonError("cutoff_period_id is required", 400);
  }

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select(
      "id, organization_id, client_id, period_start, period_end, payroll_date, status"
    )
    .eq("id", cutoffId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  const directory = directoryClient();
  const { data: client } = await directory
    .from("clients")
    .select("id, name, legacy_id")
    .eq("id", period.client_id)
    .maybeSingle();

  const { data: run } = await publicDb
    .from("payroll_register_runs")
    .select("id, status, line_count, totals")
    .eq("cutoff_period_id", cutoffId)
    .eq("organization_id", orgId)
    .maybeSingle();

  let gpLines: Array<{
    directory_employee_id: string | null;
    employee_code: string | null;
    last_name: string | null;
    first_name: string | null;
    gross_pay: number;
    net_pay: number;
    deductions: Record<string, number>;
  }> = [];

  if (run?.id) {
    const { data: lines, error: linesError } = await publicDb
      .from("payroll_register_lines")
      .select(
        "directory_employee_id, employee_code, last_name, first_name, gross_pay, net_pay, deductions"
      )
      .eq("run_id", run.id)
      .order("last_name");
    if (linesError) return jsonError(linesError.message, 500);
    gpLines = (lines ?? []).map((row) => ({
      directory_employee_id: row.directory_employee_id as string | null,
      employee_code: row.employee_code as string | null,
      last_name: row.last_name as string | null,
      first_name: row.first_name as string | null,
      gross_pay: Number(row.gross_pay) || 0,
      net_pay: Number(row.net_pay) || 0,
      deductions: (row.deductions as Record<string, number>) ?? {},
    }));
  }

  const dirIds = [
    ...new Set(
      gpLines
        .map((l) => l.directory_employee_id)
        .filter(Boolean) as string[]
    ),
  ];
  const legacyIdByDirectoryId = new Map<string, number>();
  if (dirIds.length) {
    const { data: dirEmps } = await directory
      .from("employees")
      .select("id, legacy_id")
      .in("id", dirIds);
    for (const row of dirEmps ?? []) {
      if (row.legacy_id != null) {
        legacyIdByDirectoryId.set(row.id as string, Number(row.legacy_id));
      }
    }
  }

  let legacyRows: Awaited<ReturnType<typeof fetchLegacyPayrollSummary>> = [];
  let legacy_error: string | null = null;
  const legacy_client_id =
    client?.legacy_id != null ? Number(client.legacy_id) : null;

  if (!legacySqlConfigured()) {
    legacy_error = "GREENHRISMAIN SQL not configured on this server";
  } else if (legacy_client_id == null) {
    legacy_error = "Directory Client has no legacy_id — cannot query payroll_summary";
  } else {
    try {
      legacyRows = await fetchLegacyPayrollSummary(
        legacy_client_id,
        String(period.period_start),
        String(period.period_end)
      );
    } catch (err) {
      legacy_error =
        err instanceof Error ? err.message : "GREENHRISMAIN query failed";
    }
  }

  const { rows, summary } = compareRegisterToLegacy({
    gpLines,
    legacyRows,
    legacyIdByDirectoryId,
  });

  const payload = {
    period: {
      id: period.id,
      period_start: period.period_start,
      period_end: period.period_end,
      payroll_date: period.payroll_date,
      status: period.status,
    },
    client: {
      id: client?.id ?? period.client_id,
      name: client?.name ?? null,
      legacy_id: legacy_client_id,
    },
    register: run
      ? { id: run.id, status: run.status, line_count: run.line_count }
      : null,
    legacy_available: legacy_error == null,
    legacy_error,
    legacy_row_count: legacyRows.length,
    summary,
    rows,
  };

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const csv = parityRowsToCsv(rows as PayrollParityRow[]);
    const filename = `cutoff-parity-${period.period_start}-${period.period_end}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return jsonOk({ data: payload });
}
