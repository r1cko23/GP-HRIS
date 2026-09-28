/**
 * Cutoff-scoped refund amount for payroll register.
 * GET  ?directory_employee_id=|office_employee_id=&cutoff_period_id=
 * PUT  { directory_employee_id?, office_employee_id?, cutoff_period_id, amount }
 */

import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { normalizeRefundAmount } from "@/lib/benefits/cutoff-refund";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const officeId = request.nextUrl.searchParams.get("office_employee_id")?.trim();
  const dirId = request.nextUrl.searchParams.get("directory_employee_id")?.trim();
  const cutoffPeriodId = request.nextUrl.searchParams
    .get("cutoff_period_id")
    ?.trim();
  if (!officeId && !dirId) {
    return jsonError("office_employee_id or directory_employee_id is required", 400);
  }
  if (!cutoffPeriodId) {
    return jsonError("cutoff_period_id is required", 400);
  }

  const publicDb = publicDbClient();
  let query = publicDb
    .from("employee_refunds")
    .select("amount, is_active")
    .eq("cutoff_period_id", cutoffPeriodId)
    .eq("is_active", true);
  if (dirId) query = query.eq("directory_employee_id", dirId);
  else
    query = query
      .eq("office_employee_id", officeId!)
      .is("directory_employee_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) return jsonError(error.message, 500);

  return jsonOk({
    data: {
      amount: normalizeRefundAmount(data?.amount),
      cutoff_period_id: cutoffPeriodId,
    },
  });
}

export async function PUT(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json().catch(() => null)) as {
    office_employee_id?: string;
    directory_employee_id?: string;
    cutoff_period_id?: string;
    amount?: number | string;
  } | null;

  const officeId = body?.office_employee_id?.trim() || null;
  const dirId = body?.directory_employee_id?.trim() || null;
  const cutoffPeriodId = body?.cutoff_period_id?.trim() || null;
  if (!officeId && !dirId) {
    return jsonError("office_employee_id or directory_employee_id is required", 400);
  }
  if (!cutoffPeriodId) {
    return jsonError("cutoff_period_id is required", 400);
  }

  const amount = normalizeRefundAmount(body?.amount);
  if (amount < 0) {
    return jsonError("amount cannot be negative", 400);
  }

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id, organization_id, status")
    .eq("id", cutoffPeriodId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff not found", 404);
  if (String(period.status) === "posted") {
    return jsonError("Cannot edit refunds on a posted cutoff", 409);
  }

  let del = publicDb
    .from("employee_refunds")
    .delete()
    .eq("cutoff_period_id", cutoffPeriodId);
  if (dirId) del = del.eq("directory_employee_id", dirId);
  else
    del = del
      .eq("office_employee_id", officeId!)
      .is("directory_employee_id", null);
  const { error: delError } = await del;
  if (delError) return jsonError(delError.message, 500);

  if (amount > 0) {
    const now = new Date().toISOString();
    const { error: insError } = await publicDb.from("employee_refunds").insert({
      directory_employee_id: dirId,
      office_employee_id: officeId,
      cutoff_period_id: cutoffPeriodId,
      amount,
      is_active: true,
      updated_by: auth.userId,
      updated_at: now,
      created_by: auth.userId,
    });
    if (insError) return jsonError(insError.message, 500);
  }

  return jsonOk({
    data: {
      amount,
      cutoff_period_id: cutoffPeriodId,
      saved: amount > 0 ? 1 : 0,
    },
  });
}
