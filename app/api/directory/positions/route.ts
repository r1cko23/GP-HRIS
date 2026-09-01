import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const clientId = request.nextUrl.searchParams.get("client_id");
  const branchId = request.nextUrl.searchParams.get("branch_id");

  let query = auth.supabase
    .from("positions")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .order("job_title");

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0);

  if (clientId) query = query.eq("client_id", clientId);
  if (branchId) query = query.eq("branch_id", branchId);
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

  const body = (await request.json()) as Record<string, unknown>;
  if (!body.client_id || !body.job_title) {
    return jsonError("client_id and job_title are required", 400);
  }

  const { data, error } = await auth.supabase
    .from("positions")
    .insert({
      organization_id: orgId,
      client_id: body.client_id,
      branch_id: body.branch_id ?? null,
      job_title: body.job_title,
      department: body.department ?? null,
      group_name: body.group_name ?? null,
      payroll_daily_rate: body.payroll_daily_rate ?? null,
      billing_daily_rate: body.billing_daily_rate ?? null,
      payroll_ot_rate: body.payroll_ot_rate ?? null,
      payroll_nd_rate: body.payroll_nd_rate ?? null,
      payroll_legal_holiday_rate: body.payroll_legal_holiday_rate ?? null,
      payroll_special_holiday_rate: body.payroll_special_holiday_rate ?? null,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return jsonOk({ data }, 201);
}
