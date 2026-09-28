/**
 * Cutoff-scoped allowances for payroll register.
 * GET  ?directory_employee_id=|office_employee_id=&cutoff_period_id=&scope=
 * PUT  { directory_employee_id?, office_employee_id?, cutoff_period_id, scope?, amounts }
 *
 * Deployed: TL allowance (Epicurean, PLK)
 * Organic: Load + Supervisory
 */

import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  ALLOWANCE_KEYS,
  ALLOWANCE_LABELS,
  allowanceKeysForScope,
  isAllowanceKey,
  type AllowanceKey,
  type AllowanceScope,
} from "@/lib/payroll-register/allowance-lines";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;

function parseScope(raw: string | null | undefined): AllowanceScope {
  return raw === "organic" ? "organic" : "deployed";
}

function emptyAmounts(keys: readonly AllowanceKey[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) out[key] = 0;
  return out;
}

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

  const scope = parseScope(request.nextUrl.searchParams.get("scope"));
  const keys = allowanceKeysForScope(scope);

  const publicDb = publicDbClient();
  let query = publicDb
    .from("employee_allowances")
    .select("allowance_key, amount, is_active")
    .eq("cutoff_period_id", cutoffPeriodId)
    .eq("is_active", true);
  if (dirId) query = query.eq("directory_employee_id", dirId);
  else
    query = query
      .eq("office_employee_id", officeId!)
      .is("directory_employee_id", null);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  const amounts = emptyAmounts(keys);
  for (const row of data ?? []) {
    const key = String(row.allowance_key);
    if (!isAllowanceKey(key)) continue;
    if (!keys.includes(key)) continue;
    amounts[key] = round2(Number(row.amount) || 0);
  }

  return jsonOk({
    data: {
      amounts,
      labels: ALLOWANCE_LABELS,
      keys,
      scope,
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
    scope?: string;
    amounts?: Record<string, number | string>;
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

  const scope = parseScope(body?.scope);
  const keys = allowanceKeysForScope(scope);

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
    return jsonError("Cannot edit allowances on a posted cutoff", 409);
  }

  const now = new Date().toISOString();
  const rows: Array<Record<string, unknown>> = [];

  for (const key of keys) {
    const amount = round2(Number(body?.amounts?.[key] ?? 0));
    if (amount < 0) {
      return jsonError(`${key} amount cannot be negative`, 400);
    }
    rows.push({
      directory_employee_id: dirId,
      office_employee_id: officeId,
      cutoff_period_id: cutoffPeriodId,
      allowance_key: key,
      amount,
      is_active: amount > 0,
      updated_by: auth.userId,
      updated_at: now,
      created_by: auth.userId,
    });
  }

  let del = publicDb
    .from("employee_allowances")
    .delete()
    .eq("cutoff_period_id", cutoffPeriodId);
  if (dirId) del = del.eq("directory_employee_id", dirId);
  else
    del = del
      .eq("office_employee_id", officeId!)
      .is("directory_employee_id", null);
  const { error: delError } = await del;
  if (delError) return jsonError(delError.message, 500);

  const insertRows = rows.filter((row) => Number(row.amount) > 0);
  if (insertRows.length) {
    const { error: insError } = await publicDb
      .from("employee_allowances")
      .insert(insertRows);
    if (insError) return jsonError(insError.message, 500);
  }

  return jsonOk({
    data: {
      amounts: Object.fromEntries(
        keys.map((key) => [key, round2(Number(body?.amounts?.[key] ?? 0))])
      ),
      keys,
      scope,
      cutoff_period_id: cutoffPeriodId,
      saved: insertRows.length,
      catalog: ALLOWANCE_KEYS,
    },
  });
}
