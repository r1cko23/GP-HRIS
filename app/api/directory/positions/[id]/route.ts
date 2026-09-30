import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  nextStatusAfterPositionEdit,
  planSubmitPosition,
  type PositionApprovalStatus,
} from "@/lib/directory/position-approval";
import { normalizeProseTextOrNull } from "@/lib/prose-text";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const { data, error } = await auth.supabase
    .from("positions")
    .select("*, client:clients(id, name, industry)")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Position not found", 404);
  return jsonOk({ data });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const gate = await requireCapability(auth, "fn:positions.update");
  if ("error" in gate) return gate.error;

  const { data: current, error: currentError } = await auth.supabase
    .from("positions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();
  if (currentError) return jsonError(currentError.message, 500);
  if (!current) return jsonError("Position not found", 404);

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("job_title" in body) {
    const title =
      normalizeProseTextOrNull(String(body.job_title ?? "")) ??
      String(body.job_title ?? "").trim();
    if (!title) return jsonError("job_title cannot be empty", 400);
    patch.job_title = title;
  }
  if ("department" in body) {
    patch.department =
      typeof body.department === "string"
        ? normalizeProseTextOrNull(body.department)
        : null;
  }
  if ("group_name" in body) {
    patch.group_name =
      typeof body.group_name === "string"
        ? normalizeProseTextOrNull(body.group_name)
        : null;
  }
  if ("branch_id" in body) patch.branch_id = body.branch_id ?? null;
  if ("is_active" in body) patch.is_active = Boolean(body.is_active);

  for (const key of [
    "payroll_daily_rate",
    "billing_daily_rate",
    "payroll_ot_rate",
    "payroll_nd_rate",
    "payroll_legal_holiday_rate",
    "payroll_special_holiday_rate",
    "payroll_rest_day_rate",
    "billing_ot_rate",
    "ecola",
    "sea",
    "ctpa",
    "allowance",
  ] as const) {
    if (key in body) patch[key] = asOptionalNumber(body[key]);
  }

  const titleOrRatesChanged =
    "job_title" in patch ||
    "payroll_daily_rate" in patch ||
    "billing_daily_rate" in patch ||
    "payroll_ot_rate" in patch ||
    "billing_ot_rate" in patch ||
    "ecola" in patch ||
    "sea" in patch ||
    "ctpa" in patch;

  const nextRates = {
    payroll_daily_rate:
      "payroll_daily_rate" in patch
        ? (patch.payroll_daily_rate as number | null)
        : current.payroll_daily_rate,
    billing_daily_rate:
      "billing_daily_rate" in patch
        ? (patch.billing_daily_rate as number | null)
        : current.billing_daily_rate,
  };

  const currentStatus = (current.approval_status ??
    "draft") as PositionApprovalStatus;
  let nextStatus = nextStatusAfterPositionEdit({
    currentStatus,
    titleOrRatesChanged,
    rates: nextRates,
  });

  if (body.submit === true || body.submit === "1") {
    const planned = planSubmitPosition({
      currentStatus: nextStatus === "pending" ? "draft" : nextStatus,
      rates: nextRates,
    });
    // If edit already forced pending, keep pending; otherwise run submit from draft/rejected.
    if (nextStatus === "pending" && titleOrRatesChanged) {
      // already pending from edit
    } else {
      if (!planned.ok) return jsonError(planned.error, planned.status);
      nextStatus = "pending";
    }
    patch.submitted_at = new Date().toISOString();
    patch.submitted_by = auth.userId;
    patch.rejection_reason = null;
  }

  if (nextStatus !== currentStatus) {
    patch.approval_status = nextStatus;
    if (nextStatus === "pending") {
      patch.submitted_at = patch.submitted_at ?? new Date().toISOString();
      patch.submitted_by = patch.submitted_by ?? auth.userId;
      patch.reviewed_at = null;
      patch.reviewed_by = null;
      patch.rejection_reason = null;
    }
  }

  const { data, error } = await auth.supabase
    .from("positions")
    .update(patch)
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .select("*, client:clients(id, name, industry)")
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Position not found", 404);
  return jsonOk({ data });
}
