import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { emitDirectoryEvent } from "@/lib/directory/events";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Transfer current engagement to another client — same person, same employee_code.
 * Does not create a second 201 (ADR 0006).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const clientId =
    typeof body.client_id === "string" && body.client_id.trim()
      ? body.client_id.trim()
      : null;
  if (!clientId) return jsonError("client_id is required", 400);

  const branchId =
    typeof body.branch_id === "string" && body.branch_id.trim()
      ? body.branch_id.trim()
      : null;
  const positionId =
    typeof body.position_id === "string" && body.position_id.trim()
      ? body.position_id.trim()
      : null;
  const effectiveDate =
    typeof body.effective_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.effective_date.trim())
      ? body.effective_date.trim()
      : new Date().toISOString().slice(0, 10);
  const remarks =
    typeof body.remarks === "string" && body.remarks.trim()
      ? body.remarks.trim()
      : null;

  const { data: current, error: currentError } = await auth.supabase
    .from("employees")
    .select(
      "id, status, client_id, branch_id, position_id, employee_code, is_current_engagement, superseded_by, hire_date"
    )
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (currentError) return jsonError(currentError.message, 500);
  if (!current) return jsonError("Employee not found", 404);

  if (current.is_current_engagement === false) {
    return jsonError(
      "Transfer only on the current engagement master.",
      400
    );
  }

  if (current.status === "inactive") {
    return jsonError(
      "Inactive people must use Rehire (not Transfer) to return.",
      400
    );
  }

  if (current.client_id === clientId) {
    return jsonError("Person is already on this client. Change branch/position via Edit.", 400);
  }

  const { data: client, error: clientError } = await auth.supabase
    .from("clients")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found in this organization", 400);

  if (branchId) {
    const { data: branch } = await auth.supabase
      .from("client_branches")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .eq("id", branchId)
      .maybeSingle();
    if (!branch) return jsonError("branch_id not in this client", 400);
  }

  if (positionId) {
    const { data: position } = await auth.supabase
      .from("positions")
      .select("id, job_title")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .eq("id", positionId)
      .maybeSingle();
    if (!position) return jsonError("position_id not in this client", 400);
  }

  const { data: fromClient } = await auth.supabase
    .from("clients")
    .select("name")
    .eq("id", current.client_id)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    client_id: clientId,
    branch_id: branchId,
    position_id: positionId,
    updated_at: new Date().toISOString(),
  };
  // Float → active when placed on a client
  if (current.status === "float" || current.status === "for_verification") {
    patch.status = "active";
  }

  const { data, error } = await auth.supabase
    .from("employees")
    .update(patch)
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .select(
      `
      id, status, employee_code, client_id, branch_id, position_id, hire_date,
      client:clients(id, name),
      branch:client_branches(id, name),
      position:positions(id, job_title)
    `
    )
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Employee not found", 404);

  const fromName = (fromClient as { name?: string } | null)?.name ?? "previous client";
  const toName = client.name;

  await auth.supabase.from("employee_movements").insert({
    organization_id: orgId,
    employee_id: params.id,
    date_from: effectiveDate,
    date_to: null,
    status: "TRANSFERRED",
    department: null,
    position:
      (data.position as { job_title?: string } | null)?.job_title ?? null,
    remarks:
      remarks ??
      `Transferred ${fromName} → ${toName}. Employee ID unchanged (${current.employee_code}).`,
  });

  await emitDirectoryEvent("employee.transferred", {
    organization_id: orgId,
    employee_id: params.id,
    from_client_id: current.client_id,
    to_client_id: clientId,
    employee_code: current.employee_code,
    employee: data,
  });

  return jsonOk({ data }, 200);
}
