import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { reconcileApprovedWorkLines } from "@/lib/approved-work/reconcile";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import { requireCapability } from "@/lib/access/require-capability";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };
type ChargeStatus = "draft" | "approved" | "posted" | "adjusted";
type Billability = "all" | "payable" | "billable" | "nonbillable";

const CHARGE_STATUSES = new Set<ChargeStatus>([
  "draft",
  "approved",
  "posted",
  "adjusted",
]);
const BILLABILITY_FILTERS = new Set<Billability>([
  "all",
  "payable",
  "billable",
  "nonbillable",
]);

function boundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function safeSearch(value: string | null): string | null {
  const cleaned = value?.trim().replace(/[%_,().]/g, " ").replace(/\s+/g, " ");
  return cleaned || null;
}

function asChargeStatus(value: string | null): ChargeStatus | null {
  return value && CHARGE_STATUSES.has(value as ChargeStatus)
    ? (value as ChargeStatus)
    : null;
}

function asBillability(value: string | null): Billability {
  return value && BILLABILITY_FILTERS.has(value as Billability)
    ? (value as Billability)
    : "all";
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const organizationId = await requireAuthorizedOrganization(auth);
  if (typeof organizationId !== "string") return organizationId;

  const limit = boundedInteger(
    request.nextUrl.searchParams.get("limit"),
    50,
    1,
    200
  );
  const offset = boundedInteger(
    request.nextUrl.searchParams.get("offset"),
    0,
    0,
    Number.MAX_SAFE_INTEGER
  );
  const q = safeSearch(request.nextUrl.searchParams.get("q"));
  const billability = asBillability(
    request.nextUrl.searchParams.get("billability")
  );
  const requestedStatus = request.nextUrl.searchParams.get("charge_status");
  const chargeStatus = asChargeStatus(requestedStatus);
  if (requestedStatus && !chargeStatus) {
    return jsonError("Invalid charge_status", 400);
  }

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id")
    .eq("id", params.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  let snapshotQuery = publicDb
    .from("approved_work_snapshots")
    .select("*")
    .eq("cutoff_period_id", params.id)
    .eq("organization_id", organizationId)
    .order("approved_at", { ascending: false })
    .limit(1);
  const source = request.nextUrl.searchParams.get("source")?.trim();
  if (source) snapshotQuery = snapshotQuery.eq("source_system", source);

  const { data: snapshots, error: snapshotError } = await snapshotQuery;
  if (snapshotError) return jsonError(snapshotError.message, 500);
  const snapshot = snapshots?.[0] ?? null;
  if (!snapshot) {
    return jsonOk({
      data: [],
      count: 0,
      limit,
      offset,
      snapshot: null,
      filters: {
        q,
        billability,
        charge_status: chargeStatus,
        source: source ?? null,
      },
      page_summary: {
        payable_amount: 0,
        billable_amount: 0,
        variance_amount: 0,
      },
    });
  }

  let workQuery = publicDb
    .from("approved_work_lines")
    .select("*", { count: "exact" })
    .eq("approved_work_snapshot_id", snapshot.id)
    .order("last_name")
    .order("first_name")
    .order("employee_code")
    .range(offset, offset + limit - 1);
  if (q) {
    workQuery = workQuery.or(
      `last_name.ilike.%${q}%,first_name.ilike.%${q}%,employee_code.ilike.%${q}%,source_line_key.ilike.%${q}%`
    );
  }
  if (billability === "payable") workQuery = workQuery.eq("payable", true);
  if (billability === "billable") workQuery = workQuery.eq("billable", true);
  if (billability === "nonbillable") {
    workQuery = workQuery.eq("billable", false);
  }

  const { data: workLines, error: workError, count } = await workQuery;
  if (workError) return jsonError(workError.message, 500);
  const approvedLines = workLines ?? [];
  const approvedLineIds = approvedLines.map((row) => String(row.id));

  async function loadChargeLines(
    batchTable: "payable_charge_batches" | "billable_charge_batches",
    lineTable: "payable_charge_lines" | "billable_charge_lines"
  ): Promise<
    Array<{
      approvedWorkLineId: string;
      totalAmount: number | string | null;
    }>
  > {
    if (approvedLineIds.length === 0) return [];
    let batchQuery = publicDb
      .from(batchTable)
      .select("id")
      .eq("approved_work_snapshot_id", snapshot.id)
      .eq("organization_id", organizationId);
    if (chargeStatus) batchQuery = batchQuery.eq("status", chargeStatus);
    const { data: batches, error: batchError } = await batchQuery;
    if (batchError) throw new Error(batchError.message);
    const batchIds = (batches ?? []).map((row) => String(row.id));
    if (batchIds.length === 0) return [];

    const { data: lines, error: lineError } = await publicDb
      .from(lineTable)
      .select("approved_work_line_id, total_amount")
      .in("batch_id", batchIds)
      .in("approved_work_line_id", approvedLineIds);
    if (lineError) throw new Error(lineError.message);
    return (lines ?? []).map((line) => ({
      approvedWorkLineId: String(line.approved_work_line_id),
      totalAmount: line.total_amount as number | string | null,
    }));
  }

  let payableLines: Awaited<ReturnType<typeof loadChargeLines>>;
  let billableLines: Awaited<ReturnType<typeof loadChargeLines>>;
  try {
    [payableLines, billableLines] = await Promise.all([
      loadChargeLines("payable_charge_batches", "payable_charge_lines"),
      loadChargeLines("billable_charge_batches", "billable_charge_lines"),
    ]);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load charge lines",
      500
    );
  }

  const reconciled = reconcileApprovedWorkLines({
    approvedWorkLines: approvedLines.map((line) => ({
      ...line,
      id: String(line.id),
      payable: Boolean(line.payable),
      billable: Boolean(line.billable),
    })),
    payableLines,
    billableLines,
  });
  const data = reconciled.map(
    ({
      payableAmount,
      billableAmount,
      varianceAmount,
      reconciliationStatus,
      ...line
    }) => ({
      ...line,
      payable_amount: payableAmount,
      billable_amount: billableAmount,
      variance_amount: varianceAmount,
      reconciliation_status: reconciliationStatus,
    })
  );

  return jsonOk({
    data,
    count: count ?? 0,
    limit,
    offset,
    snapshot,
    filters: {
      q,
      billability,
      charge_status: chargeStatus,
      source: source ?? null,
    },
    page_summary: {
      payable_amount: data.reduce((sum, row) => sum + row.payable_amount, 0),
      billable_amount: data.reduce((sum, row) => sum + row.billable_amount, 0),
      variance_amount: data.reduce((sum, row) => sum + row.variance_amount, 0),
    },
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const organizationId = await requireAuthorizedOrganization(auth);
  if (typeof organizationId !== "string") return organizationId;
  const gate = await requireCapability(auth, "fn:payslips.create");
  if ("error" in gate) return gate.error;

  const body = (await request.json().catch(() => null)) as {
    source_version?: string;
    billable?: boolean;
  } | null;
  const sourceVersion = body?.source_version?.trim();
  if (!sourceVersion) return jsonError("source_version is required", 400);

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id")
    .eq("id", params.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  const { data, error } = await publicDb.rpc("build_cutoff_charge_ledgers", {
    p_cutoff_period_id: params.id,
    p_source_version: sourceVersion,
    p_billable: body?.billable !== false,
  });
  if (error) return jsonError(error.message, 409);
  return jsonOk({ data }, 201);
}
