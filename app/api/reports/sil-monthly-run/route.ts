/**
 * SIL monthly run — GET preview / saved run; POST build or refresh draft.
 */

import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { binaryFileResponse } from "@/lib/http/binary-file-response";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import {
  buildSilMonthlyWorkbook,
  silMonthlyFilename,
} from "@/lib/reports/sil-monthly-export";
import {
  computeSilMonthlyRows,
  lineRecordToSilRow,
  loadSilEligibleEmployees,
  silRowToLineInsert,
} from "@/lib/reports/build-sil-monthly-run";
import {
  canCreateSilDraftForPeriod,
  canRebuildSilRun,
  isSilRunStatus,
  type SilRunStatus,
} from "@/lib/reports/sil-run-lifecycle";
import { matchesSilStatusFilter, type SilMonthlyRow } from "@/lib/reports/sil-monthly-run";

export const dynamic = "force-dynamic";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sanitizeIlike(value: string): string {
  return value.replace(/[%_,]/g, " ").trim();
}

function matchesSearch(row: SilMonthlyRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.last_name.toLowerCase().includes(needle) ||
    row.first_name.toLowerCase().includes(needle) ||
    row.employee_code.toLowerCase().includes(needle)
  );
}

async function loadActiveRun(
  publicDb: ReturnType<typeof publicDbClient>,
  orgId: string,
  clientId: string,
  year: number,
  month: number
) {
  const { data, error } = await publicDb
    .from("sil_monthly_runs")
    .select("*")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .eq("year", year)
    .eq("month", month)
    .in("status", ["draft", "approved", "posted"])
    .maybeSingle();
  if (error) return { error: error.message as string, run: null };
  return { error: null, run: data };
}

async function loadRunLines(
  publicDb: ReturnType<typeof publicDbClient>,
  runId: string
): Promise<
  { ok: true; rows: SilMonthlyRow[] } | { ok: false; error: string }
> {
  const rows: SilMonthlyRow[] = [];
  const page = 500;
  for (let off = 0; ; off += page) {
    const { data: chunk, error } = await publicDb
      .from("sil_monthly_run_lines")
      .select("*")
      .eq("run_id", runId)
      .order("last_name")
      .range(off, off + page - 1);
    if (error) return { ok: false, error: error.message };
    const batch = chunk ?? [];
    for (const line of batch) {
      rows.push(lineRecordToSilRow(line as Record<string, unknown>));
    }
    if (batch.length < page) break;
  }
  return { ok: true, rows };
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const clientId = params.get("client_id")?.trim() || null;
  const year = Number(params.get("year") ?? new Date().getFullYear());
  const month = Number(params.get("month") ?? new Date().getMonth() + 1);
  const statusFilter = (params.get("status")?.trim() || "active").toLowerCase();
  const q = sanitizeIlike(params.get("q")?.trim() || "");
  const limit = Math.min(
    Math.max(Number(params.get("limit") ?? 50) || 50, 1),
    200
  );
  const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
  const format = (params.get("format") ?? "json").trim().toLowerCase();

  if (!clientId) return jsonError("client_id is required", 400);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return jsonError("Invalid year", 400);
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return jsonError("Invalid month", 400);
  }
  if (!["active", "inactive", "all"].includes(statusFilter)) {
    return jsonError("Invalid status. Use active, inactive, or all", 400);
  }

  const directory = directoryClient();
  const publicDb = publicDbClient();

  const { data: client, error: clientError } = await directory
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found", 404);
  const clientName = String(client.name ?? "").trim();

  const { error: runLoadError, run } = await loadActiveRun(
    publicDb,
    orgId,
    clientId,
    year,
    month
  );
  if (runLoadError) return jsonError(runLoadError, 500);

  let rows: SilMonthlyRow[] = [];
  let totals = { amount: 0, days_worked: 0 };
  let source: "run" | "preview" = "preview";

  if (run) {
    const loaded = await loadRunLines(publicDb, run.id as string);
    if (!loaded.ok) return jsonError(loaded.error, 500);
    rows = loaded.rows
      .filter((r) => matchesSilStatusFilter(r.status, statusFilter))
      .filter((r) => matchesSearch(r, q));
    // Prefer totals from run header when unfiltered
    if (!q && statusFilter === "all") {
      const t = (run.totals ?? {}) as { amount?: number; days_worked?: number };
      totals = {
        amount: Number(t.amount ?? 0),
        days_worked: Number(t.days_worked ?? 0),
      };
    } else {
      totals = {
        amount: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
        days_worked:
          Math.round(rows.reduce((s, r) => s + r.days_worked, 0) * 100) / 100,
      };
    }
    source = "run";
  } else {
    const loaded = await loadSilEligibleEmployees({
      directory,
      orgId,
      clientId,
    });
    if (!loaded.ok) return jsonError(loaded.error, 500);
    const computed = await computeSilMonthlyRows({
      publicDb,
      orgId,
      clientId,
      year,
      month,
      employees: loaded.employees,
      statusFilter,
      q,
    });
    if (!computed.ok) return jsonError(computed.error, 500);
    rows = computed.value.rows;
    totals = computed.value.totals;
  }

  const filename = silMonthlyFilename(year, month, clientName);
  if (format === "xlsx") {
    const buf = buildSilMonthlyWorkbook(rows, {
      year,
      month,
      client_name: clientName,
    });
    return binaryFileResponse(buf, { contentType: XLSX_MIME, filename });
  }

  const page = rows.slice(offset, offset + limit);
  return jsonOk({
    data: page,
    count: rows.length,
    limit,
    offset,
    totals,
    client_name: clientName,
    year,
    month,
    filename,
    source,
    run: run
      ? {
          id: run.id,
          status: run.status,
          line_count: run.line_count,
          totals: run.totals,
          built_at: run.built_at,
          approved_at: run.approved_at,
          posted_at: run.posted_at,
        }
      : null,
    xlsx_base64:
      format === "json" && params.get("export") === "1"
        ? buildSilMonthlyWorkbook(rows, {
            year,
            month,
            client_name: clientName,
          }).toString("base64")
        : undefined,
  });
}

/** Build or refresh a draft SIL run for client + year + month. */
export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  let body: { client_id?: string; year?: number; month?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const clientId = String(body.client_id ?? "").trim();
  const year = Number(body.year);
  const month = Number(body.month);
  if (!clientId) return jsonError("client_id is required", 400);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return jsonError("Invalid year", 400);
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return jsonError("Invalid month", 400);
  }

  const directory = directoryClient();
  const publicDb = publicDbClient();

  const { data: client, error: clientError } = await directory
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found", 404);

  const { error: runLoadError, run: existing } = await loadActiveRun(
    publicDb,
    orgId,
    clientId,
    year,
    month
  );
  if (runLoadError) return jsonError(runLoadError, 500);

  const existingStatus =
    existing && isSilRunStatus(String(existing.status))
      ? (existing.status as SilRunStatus)
      : null;
  const allowed = canCreateSilDraftForPeriod(existingStatus);
  if (!allowed.ok) return jsonError(allowed.error, 409);
  if (existingStatus && !canRebuildSilRun(existingStatus)) {
    return jsonError("Only draft runs can be refreshed", 409);
  }

  const loaded = await loadSilEligibleEmployees({
    directory,
    orgId,
    clientId,
  });
  if (!loaded.ok) return jsonError(loaded.error, 500);

  // Build stores all eligible statuses (filter is UI-only on GET).
  const computed = await computeSilMonthlyRows({
    publicDb,
    orgId,
    clientId,
    year,
    month,
    employees: loaded.employees,
    statusFilter: "all",
    q: "",
  });
  if (!computed.ok) return jsonError(computed.error, 500);
  const { rows, totals } = computed.value;
  const now = new Date().toISOString();

  let runId: string;
  if (existing && existingStatus === "draft") {
    runId = existing.id as string;
    const { error: clearError } = await publicDb
      .from("sil_monthly_run_lines")
      .delete()
      .eq("run_id", runId);
    if (clearError) return jsonError(clearError.message, 500);

    const { error: updError } = await publicDb
      .from("sil_monthly_runs")
      .update({
        line_count: rows.length,
        totals,
        built_at: now,
        built_by: auth.userId,
        updated_at: now,
      })
      .eq("id", runId);
    if (updError) return jsonError(updError.message, 500);
  } else {
    const { data: inserted, error: insError } = await publicDb
      .from("sil_monthly_runs")
      .insert({
        organization_id: orgId,
        client_id: clientId,
        year,
        month,
        status: "draft",
        line_count: rows.length,
        totals,
        built_at: now,
        built_by: auth.userId,
      })
      .select("*")
      .single();
    if (insError) return jsonError(insError.message, 500);
    runId = inserted.id as string;
  }

  if (rows.length) {
    const lineRows = rows.map((r) =>
      silRowToLineInsert(r, {
        run_id: runId,
        organization_id: orgId,
        client_id: clientId,
        year,
      })
    );
    const chunk = 200;
    for (let i = 0; i < lineRows.length; i += chunk) {
      const { error: lineError } = await publicDb
        .from("sil_monthly_run_lines")
        .insert(lineRows.slice(i, i + chunk));
      if (lineError) return jsonError(lineError.message, 500);
    }
  }

  const { data: run, error: fetchError } = await publicDb
    .from("sil_monthly_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (fetchError) return jsonError(fetchError.message, 500);

  return jsonOk({
    run: {
      id: run.id,
      status: run.status,
      line_count: run.line_count,
      totals: run.totals,
      built_at: run.built_at,
      approved_at: run.approved_at,
      posted_at: run.posted_at,
    },
    count: rows.length,
    client_name: String(client.name ?? "").trim(),
    year,
    month,
  });
}
