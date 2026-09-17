import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { ensureAdjustmentCutoff } from "@/lib/payroll-register/ensure-adjustment-cutoff";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * GET: list adjustment cutoffs for this source (or self if already adjustment).
 * POST: open or reuse an Adjustment cutoff for a posted regular source (ADR 0017).
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const publicDb = publicDbClient();
  const { data: period, error } = await publicDb
    .from("cutoff_periods")
    .select(
      "id, organization_id, client_id, branch_id, period_start, period_end, payroll_date, status, period_kind, source_cutoff_period_id"
    )
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  const sourceId =
    period.period_kind === "adjustment"
      ? (period.source_cutoff_period_id as string | null) ?? period.id
      : period.id;

  const { data: adjustments, error: listError } = await publicDb
    .from("cutoff_periods")
    .select(
      "id, period_start, period_end, payroll_date, status, period_kind, source_cutoff_period_id, notes, created_at"
    )
    .eq("organization_id", orgId)
    .eq("source_cutoff_period_id", sourceId)
    .eq("period_kind", "adjustment")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (listError) return jsonError(listError.message, 500);

  return jsonOk({
    data: {
      source_cutoff_period_id: sourceId,
      adjustments: adjustments ?? [],
    },
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = ((await request.json().catch(() => ({}))) ?? {}) as {
    payroll_date?: string | null;
    notes?: string | null;
  };

  const publicDb = publicDbClient();
  const { data: source, error } = await publicDb
    .from("cutoff_periods")
    .select(
      "id, organization_id, client_id, branch_id, period_start, period_end, payroll_date, pay_frequency, source_app, status, period_kind"
    )
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!source) return jsonError("Cutoff period not found", 404);

  const result = await ensureAdjustmentCutoff({
    publicDb,
    source,
    userId: auth.userId,
    payrollDate: body.payroll_date ?? null,
    notes: body.notes ?? null,
  });
  if (!result.ok) return jsonError(result.error, result.status);

  return jsonOk(
    {
      data: {
        created: result.created,
        cutoff: result.cutoff,
      },
    },
    result.created ? 201 : 200
  );
}
