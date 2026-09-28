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
  activeDisbursement,
  queueStatusForRun,
  type BdoDisbursementSnap,
  type QueueRowStatus,
} from "@/lib/payroll-register/bdo-disbursement";
import { loadBdoAtmRowsForRun } from "@/lib/payroll-register/load-bdo-atm-rows";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type DisbursementRow = {
  id: string;
  payroll_register_run_id: string;
  cutoff_period_id: string;
  upload_date: string | null;
  batch_no: number | null;
  record_count: number;
  total_amount: number;
  status: "queued" | "awaiting_ref" | "confirmed" | "void";
  bdo_reference: string | null;
  generated_at: string | null;
  created_at: string;
  file_sha256: string | null;
};

type RunRow = {
  id: string;
  cutoff_period_id: string;
  client_id: string | null;
  status: string;
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  line_count: number | null;
  posted_at: string | null;
};

function asSnap(row: DisbursementRow): BdoDisbursementSnap {
  return {
    id: row.id,
    status: row.status,
    bdo_reference: row.bdo_reference,
    payroll_register_run_id: row.payroll_register_run_id,
  };
}

/**
 * GET /api/payroll/bdo-queue
 * Only manually enqueued Debit Memos (status queued | awaiting_ref | confirmed).
 * Posted payrolls do not appear until Finance clicks Add to Debit Memo Queue.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const q = params.get("q")?.trim() ?? "";
  const statusFilter = (params.get("status")?.trim() ?? "") as
    | QueueRowStatus
    | "";
  const cutoffFilter = params.get("cutoff_period_id")?.trim() ?? "";

  const publicDb = publicDbClient();

  let dQuery = publicDb
    .from("payroll_bdo_disbursements")
    .select(
      "id, payroll_register_run_id, cutoff_period_id, upload_date, batch_no, record_count, total_amount, status, bdo_reference, generated_at, created_at, file_sha256",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .in("status", ["queued", "awaiting_ref", "confirmed"])
    .order("created_at", { ascending: false });

  if (statusFilter === "queued" || statusFilter === "awaiting_ref" || statusFilter === "confirmed") {
    dQuery = dQuery.eq("status", statusFilter);
  }
  if (cutoffFilter) {
    dQuery = dQuery.eq("cutoff_period_id", cutoffFilter);
  }

  const { data: disbursements, error: dErr, count: dbCount } = await dQuery.range(
    offset,
    offset + limit - 1
  );
  if (dErr) return jsonError(dErr.message, 500);

  const list = (disbursements ?? []) as DisbursementRow[];
  const runIds = list.map((d) => d.payroll_register_run_id);

  const runsById = new Map<string, RunRow>();
  if (runIds.length) {
    const { data: runs, error: rErr } = await publicDb
      .from("payroll_register_runs")
      .select(
        "id, cutoff_period_id, client_id, status, period_start, period_end, payroll_date, line_count, posted_at"
      )
      .eq("organization_id", orgId)
      .in("id", runIds);
    if (rErr) return jsonError(rErr.message, 500);
    for (const run of (runs ?? []) as RunRow[]) {
      runsById.set(run.id, run);
    }
  }

  const directory = directoryClient();
  const clientIds = [
    ...new Set(
      [...runsById.values()]
        .map((r) => r.client_id)
        .filter(Boolean) as string[]
    ),
  ];
  const clientNames = new Map<string, string>();
  if (clientIds.length) {
    const { data: clients } = await directory
      .from("clients")
      .select("id, name")
      .in("id", clientIds);
    for (const c of clients ?? []) {
      clientNames.set(c.id as string, String(c.name ?? "").trim());
    }
  }

  const qLower = q.toLowerCase();
  type QueueItem = {
    run_id: string;
    cutoff_period_id: string;
    client_id: string | null;
    client_name: string;
    period_start: string;
    period_end: string;
    payroll_date: string | null;
    line_count: number;
    queue_status: QueueRowStatus;
    disbursement: {
      id: string;
      upload_date: string | null;
      batch_no: number | null;
      record_count: number;
      total_amount: number;
      bdo_reference: string | null;
      generated_at: string | null;
    };
    atm_pax: number | null;
    atm_total: number | null;
  };

  const page: QueueItem[] = [];
  for (const d of list) {
    const run = runsById.get(d.payroll_register_run_id);
    if (!run) continue;
    const queue_status = queueStatusForRun(asSnap(d));
    if (!queue_status) continue;
    const clientName = clientNames.get(String(run.client_id ?? "")) ?? "";
    const ref = d.bdo_reference ?? "";
    const periodLabel = `${String(run.period_start).slice(0, 10)}–${String(run.period_end).slice(0, 10)}`;

    if (qLower) {
      const hay =
        `${periodLabel} ${clientName} ${ref} ${run.payroll_date ?? ""}`.toLowerCase();
      if (!hay.includes(qLower)) continue;
    }

    page.push({
      run_id: run.id,
      cutoff_period_id: run.cutoff_period_id,
      client_id: run.client_id,
      client_name: clientName,
      period_start: String(run.period_start).slice(0, 10),
      period_end: String(run.period_end).slice(0, 10),
      payroll_date: run.payroll_date
        ? String(run.payroll_date).slice(0, 10)
        : null,
      line_count: Number(run.line_count ?? 0),
      queue_status,
      disbursement: {
        id: d.id,
        upload_date: d.upload_date ? String(d.upload_date).slice(0, 10) : null,
        batch_no: d.batch_no != null ? Number(d.batch_no) : null,
        record_count: Number(d.record_count),
        total_amount: Number(d.total_amount),
        bdo_reference: d.bdo_reference,
        generated_at: d.generated_at,
      },
      atm_pax:
        d.status === "queued" ? null : Number(d.record_count),
      atm_total:
        d.status === "queued" ? null : Number(d.total_amount),
    });
  }

  // Bank-account totals for queued rows (no file yet).
  const needsTotals = page.filter((item) => item.atm_pax == null);
  if (needsTotals.length > 0) {
    const needRunIds = needsTotals.map((item) => item.run_id);
    const { data: lineRows, error: lineErr } = await publicDb
      .from("payroll_register_lines")
      .select("run_id, bank_account_no, net_pay")
      .in("run_id", needRunIds);
    if (lineErr) return jsonError(lineErr.message, 500);

    const totals = new Map<string, { pax: number; total: number }>();
    for (const line of lineRows ?? []) {
      const runId = String(line.run_id ?? "");
      const acct = String(line.bank_account_no ?? "").trim();
      if (!runId || !acct) continue;
      const amount = Number(line.net_pay ?? 0);
      const cur = totals.get(runId) ?? { pax: 0, total: 0 };
      cur.pax += 1;
      cur.total += Number.isFinite(amount) ? amount : 0;
      totals.set(runId, cur);
    }
    for (const item of needsTotals) {
      const t = totals.get(item.run_id);
      item.atm_pax = t?.pax ?? 0;
      item.atm_total = Math.round((t?.total ?? 0) * 100) / 100;
    }
  }

  return jsonOk({ data: page, count: dbCount ?? page.length, limit, offset });
}

/** Preview Debit Memo ATM PAYROLL sheet for an enqueued (or posted) run. */
export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  let body: { run_id?: string; cutoff_period_id?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const publicDb = publicDbClient();
  let runId = String(body.run_id ?? "").trim();
  const cutoffId = String(body.cutoff_period_id ?? "").trim();

  if (!runId && cutoffId) {
    const { data: runByCutoff, error: findErr } = await publicDb
      .from("payroll_register_runs")
      .select("id, status, period_end, payroll_date, cutoff_period_id")
      .eq("cutoff_period_id", cutoffId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (findErr) return jsonError(findErr.message, 500);
    if (!runByCutoff) {
      return jsonError("Payroll register not found for cutoff", 404);
    }
    runId = runByCutoff.id as string;
  }

  if (!runId) return jsonError("run_id or cutoff_period_id is required", 400);

  const { data: run, error } = await publicDb
    .from("payroll_register_runs")
    .select("id, status, period_end, payroll_date, cutoff_period_id")
    .eq("id", runId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!run) return jsonError("Run not found", 404);
  if (run.status !== "posted") {
    return jsonError("Run must be posted", 409);
  }

  const { data: period } = await publicDb
    .from("cutoff_periods")
    .select("payroll_date, period_start, period_end, branch_id")
    .eq("id", run.cutoff_period_id)
    .maybeSingle();

  const directory = directoryClient();
  let branchName: string | null = null;
  if (period?.branch_id) {
    const { data: branchRow } = await directory
      .from("client_branches")
      .select("name")
      .eq("id", period.branch_id)
      .maybeSingle();
    branchName = (branchRow?.name as string | null) ?? null;
  }

  const { data: existing } = await publicDb
    .from("payroll_bdo_disbursements")
    .select("id, status, bdo_reference, payroll_register_run_id")
    .eq("payroll_register_run_id", runId)
    .eq("organization_id", orgId);

  const active = activeDisbursement((existing ?? []) as BdoDisbursementSnap[]);
  const loaded = await loadBdoAtmRowsForRun({
    publicDb,
    directory,
    runId,
    organizationId: orgId,
    branchName,
  });
  if (loaded.error) return jsonError(loaded.error, 500);

  const payOut = String(
    period?.payroll_date ?? run.payroll_date ?? run.period_end
  ).slice(0, 10);

  return jsonOk({
    data: {
      run_id: runId,
      cutoff_period_id: run.cutoff_period_id,
      queue_status: queueStatusForRun(active),
      disbursement: active,
      pay_out_date: payOut,
      funding_account: loaded.data?.fundingAccount ?? null,
      preview: loaded.data?.preview ?? [],
      atm_pax: loaded.data?.atmRows.length ?? 0,
      atm_total: loaded.data?.totalAmount ?? 0,
    },
  });
}
