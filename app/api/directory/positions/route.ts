import { NextRequest } from "next/server";
import {
  requireCapability,
  requirePeopleClientsOrEmployeesPage,
} from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  parseClientIndustry,
  planSubmitPosition,
  type PositionApprovalStatus,
} from "@/lib/directory/position-approval";
import { normalizeProseTextOrNull } from "@/lib/prose-text";

export const dynamic = "force-dynamic";

function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleClientsOrEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;

  const clientId = request.nextUrl.searchParams.get("client_id");
  const branchId = request.nextUrl.searchParams.get("branch_id");
  const status = request.nextUrl.searchParams.get("status");
  const approval = request.nextUrl.searchParams.get("approval");
  const industry = parseClientIndustry(
    request.nextUrl.searchParams.get("industry")
  );
  const approvedOnly =
    request.nextUrl.searchParams.get("approved_only") === "1" ||
    request.nextUrl.searchParams.get("approved_only") === "true";

  const useClientJoin = Boolean(industry) || !clientId;

  let query = useClientJoin
    ? auth.supabase
        .from("positions")
        .select("*, client:clients!inner(id, name, industry)", {
          count: "exact",
        })
        .eq("organization_id", orgId)
        .order("job_title")
    : auth.supabase
        .from("positions")
        .select("*", { count: "exact" })
        .eq("organization_id", orgId)
        .order("job_title");

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 50),
    200
  );
  const offset = Math.max(
    Number(request.nextUrl.searchParams.get("offset") ?? 0),
    0
  );

  if (clientId) query = query.eq("client_id", clientId);
  if (branchId) query = query.eq("branch_id", branchId);
  if (status === "active") query = query.eq("is_active", true);
  else if (status === "inactive") query = query.eq("is_active", false);
  if (approval) query = query.eq("approval_status", approval);
  if (approvedOnly) {
    query = query.eq("approval_status", "approved").eq("is_active", true);
  }
  if (industry) query = query.eq("client.industry", industry);
  if (q) {
    query = query.or(
      `job_title.ilike.%${q}%,department.ilike.%${q}%,group_name.ilike.%${q}%`
    );
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk({ data, count, limit, offset });
}

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const gate = await requireCapability(auth, "fn:positions.create");
  if ("error" in gate) return gate.error;

  const body = (await request.json()) as Record<string, unknown>;
  if (!body.client_id || !body.job_title) {
    return jsonError("client_id and job_title are required", 400);
  }

  const jobTitle =
    normalizeProseTextOrNull(String(body.job_title)) ??
    String(body.job_title).trim();
  if (!jobTitle) return jsonError("job_title is required", 400);

  const submitNow = body.submit === true || body.submit === "1";
  const rates = {
    payroll_daily_rate: asOptionalNumber(body.payroll_daily_rate),
    billing_daily_rate: asOptionalNumber(body.billing_daily_rate),
  };
  let approvalStatus: PositionApprovalStatus = "draft";
  let submittedAt: string | null = null;
  let submittedBy: string | null = null;
  if (submitNow) {
    const planned = planSubmitPosition({
      currentStatus: "draft",
      rates,
    });
    if (!planned.ok) return jsonError(planned.error, planned.status);
    approvalStatus = "pending";
    submittedAt = new Date().toISOString();
    submittedBy = auth.userId;
  }

  const { data, error } = await auth.supabase
    .from("positions")
    .insert({
      organization_id: orgId,
      client_id: body.client_id,
      branch_id: body.branch_id ?? null,
      job_title: jobTitle,
      department:
        typeof body.department === "string"
          ? normalizeProseTextOrNull(body.department)
          : null,
      group_name:
        typeof body.group_name === "string"
          ? normalizeProseTextOrNull(body.group_name)
          : null,
      payroll_daily_rate: rates.payroll_daily_rate,
      billing_daily_rate: rates.billing_daily_rate,
      payroll_ot_rate: asOptionalNumber(body.payroll_ot_rate),
      payroll_nd_rate: asOptionalNumber(body.payroll_nd_rate),
      payroll_legal_holiday_rate: asOptionalNumber(
        body.payroll_legal_holiday_rate
      ),
      payroll_special_holiday_rate: asOptionalNumber(
        body.payroll_special_holiday_rate
      ),
      payroll_rest_day_rate: asOptionalNumber(body.payroll_rest_day_rate),
      billing_ot_rate: asOptionalNumber(body.billing_ot_rate),
      ecola: asOptionalNumber(body.ecola),
      sea: asOptionalNumber(body.sea),
      ctpa: asOptionalNumber(body.ctpa),
      allowance: asOptionalNumber(body.allowance),
      is_active: body.is_active === false ? false : true,
      approval_status: approvalStatus,
      submitted_at: submittedAt,
      submitted_by: submittedBy,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return jsonOk({ data }, 201);
}
