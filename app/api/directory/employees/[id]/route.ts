import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { emitDirectoryEvent } from "@/lib/directory/events";
import { pickDirectoryEmployeePatch } from "@/lib/directory/employee-patch";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const { data, error } = await auth.supabase
    .from("employees")
    .select(
      `
      *,
      client:clients(id, name),
      branch:client_branches(id, name, location),
      position:positions(id, job_title, department, payroll_daily_rate, billing_daily_rate)
    `
    )
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Employee not found", 404);
  return jsonOk({ data });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const { data: current, error: currentError } = await auth.supabase
    .from("employees")
    .select("status, client_id")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (currentError) return jsonError(currentError.message, 500);
  if (!current) return jsonError("Employee not found", 404);

  const body = (await request.json()) as Record<string, unknown>;
  const picked = pickDirectoryEmployeePatch(body);
  if (!picked.ok) return jsonError(picked.error, 400);

  if (picked.patch.branch_id) {
    const { data: branch } = await auth.supabase
      .from("client_branches")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", current.client_id)
      .eq("id", picked.patch.branch_id as string)
      .maybeSingle();
    if (!branch) return jsonError("branch_id not in this client", 400);
  }

  if (picked.patch.position_id) {
    const { data: position } = await auth.supabase
      .from("positions")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", current.client_id)
      .eq("id", picked.patch.position_id as string)
      .maybeSingle();
    if (!position) return jsonError("position_id not in this client", 400);
  }

  const { data, error } = await auth.supabase
    .from("employees")
    .update(picked.patch)
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .select(
      `
      *,
      client:clients(id, name),
      branch:client_branches(id, name, location),
      position:positions(id, job_title, department, payroll_daily_rate, billing_daily_rate)
    `
    )
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Employee not found", 404);

  await emitDirectoryEvent("employee.upserted", {
    organization_id: orgId,
    employee: data,
  });
  if (picked.patch.status && picked.patch.status !== current.status) {
    await emitDirectoryEvent("employee.status_changed", {
      organization_id: orgId,
      employee_id: params.id,
      from: current.status,
      to: picked.patch.status,
    });
  }
  return jsonOk({ data });
}
