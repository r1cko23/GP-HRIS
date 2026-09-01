import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import {
  isCatchupOpenStatus,
  pickNextOpenCutoff,
  validateCatchupAmount,
  validateCatchupReason,
  type CatchupPeriodRef,
} from "@/lib/payroll-register/catchup-corrections";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * List / queue next-cutoff catch-up corrections for a cutoff (ADR 0012).
 * GET: sourced + applying lists with pagination on the active view.
 * POST: queue a correction from a posted source cutoff onto an open apply cutoff.
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const status = request.nextUrl.searchParams.get("status")?.trim();
  const viewParam = request.nextUrl.searchParams.get("view")?.trim();
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0);

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id, status, period_start, period_end, client_id, organization_id")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  const view =
    viewParam === "sourced" || viewParam === "applying"
      ? viewParam
      : period.status === "posted"
        ? "sourced"
        : "applying";

  const { data: siblings } = await publicDb
    .from("cutoff_periods")
    .select("id, status, period_start, period_end, client_id")
    .eq("organization_id", orgId)
    .eq("client_id", period.client_id)
    .neq("status", "cancelled");

  const nextOpen =
    period.status === "posted"
      ? pickNextOpenCutoff(
          period as CatchupPeriodRef,
          (siblings ?? []) as CatchupPeriodRef[]
        )
      : null;

  let query = publicDb
    .from("payroll_catchup_corrections")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (view === "sourced") {
    query = query.eq("source_cutoff_period_id", params.id);
  } else {
    query = query.eq("apply_cutoff_period_id", params.id);
  }
  if (status) query = query.eq("status", status);
  if (q) {
    query = query.or(
      `last_name.ilike.%${q}%,first_name.ilike.%${q}%,employee_code.ilike.%${q}%,reason.ilike.%${q}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);

  return jsonOk({
    data: data ?? [],
    count: count ?? 0,
    limit,
    offset,
    view,
    next_open: nextOpen,
    period: {
      id: period.id,
      status: period.status,
      period_start: period.period_start,
      period_end: period.period_end,
      client_id: period.client_id,
    },
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = ((await request.json().catch(() => ({}))) ?? {}) as {
    directory_employee_id?: string;
    amount?: number;
    reason?: string;
    apply_cutoff_period_id?: string;
  };

  const amount = validateCatchupAmount(body.amount);
  const reason = validateCatchupReason(body.reason);
  const directoryEmployeeId = body.directory_employee_id?.trim();
  if (!directoryEmployeeId) {
    return jsonError("directory_employee_id is required", 400);
  }
  if (amount == null) {
    return jsonError("amount must be a non-zero number", 400);
  }
  if (!reason) {
    return jsonError("reason must be at least 3 characters", 400);
  }

  const publicDb = publicDbClient();
  const { data: source, error: sourceError } = await publicDb
    .from("cutoff_periods")
    .select("id, status, period_start, period_end, client_id, organization_id")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (sourceError) return jsonError(sourceError.message, 500);
  if (!source) return jsonError("Cutoff period not found", 404);
  if (source.status !== "posted") {
    return jsonError(
      "Catch-up corrections can only be queued from a posted cutoff",
      409
    );
  }

  const { data: siblings } = await publicDb
    .from("cutoff_periods")
    .select("id, status, period_start, period_end, client_id")
    .eq("organization_id", orgId)
    .eq("client_id", source.client_id)
    .neq("status", "cancelled");

  let applyId = body.apply_cutoff_period_id?.trim() || null;
  if (!applyId) {
    const next = pickNextOpenCutoff(
      source as CatchupPeriodRef,
      (siblings ?? []) as CatchupPeriodRef[]
    );
    applyId = next?.id ?? null;
  }
  if (!applyId) {
    return jsonError(
      "Open the next cutoff for this client before queueing catch-up",
      409
    );
  }

  const { data: applyPeriod, error: applyError } = await publicDb
    .from("cutoff_periods")
    .select("id, status, period_start, period_end, client_id, organization_id")
    .eq("id", applyId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (applyError) return jsonError(applyError.message, 500);
  if (!applyPeriod) return jsonError("Apply cutoff not found", 404);
  if (applyPeriod.client_id !== source.client_id) {
    return jsonError("Apply cutoff must be the same client", 400);
  }
  if (!isCatchupOpenStatus(applyPeriod.status)) {
    return jsonError(
      "Apply cutoff must be draft, pending audit, or approved (not posted)",
      409
    );
  }
  if (applyPeriod.period_start <= source.period_end) {
    return jsonError(
      "Apply cutoff must start after the source cutoff ends",
      400
    );
  }

  const { data: applyRun } = await publicDb
    .from("payroll_register_runs")
    .select("id, status")
    .eq("cutoff_period_id", applyId)
    .maybeSingle();
  if (applyRun?.status === "posted") {
    return jsonError("Apply cutoff register is already posted", 409);
  }

  const directory = directoryClient();
  const { data: employee, error: empError } = await directory
    .from("employees")
    .select("id, employee_code, last_name, first_name")
    .eq("id", directoryEmployeeId)
    .eq("organization_id", orgId)
    .eq("client_id", source.client_id)
    .maybeSingle();
  if (empError) return jsonError(empError.message, 500);
  if (!employee) {
    return jsonError("Directory employee not found on this client", 404);
  }

  const { data: officeLink } = await publicDb
    .from("employees")
    .select("id")
    .eq("directory_employee_id", directoryEmployeeId)
    .limit(1)
    .maybeSingle();

  const { data: created, error: insertError } = await publicDb
    .from("payroll_catchup_corrections")
    .insert({
      organization_id: orgId,
      client_id: source.client_id,
      source_cutoff_period_id: source.id,
      apply_cutoff_period_id: applyId,
      directory_employee_id: directoryEmployeeId,
      office_employee_id: (officeLink?.id as string | undefined) ?? null,
      employee_code: employee.employee_code,
      last_name: employee.last_name,
      first_name: employee.first_name,
      amount,
      reason,
      status: "pending",
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (insertError) return jsonError(insertError.message, 400);

  return jsonOk({ data: created }, 201);
}
