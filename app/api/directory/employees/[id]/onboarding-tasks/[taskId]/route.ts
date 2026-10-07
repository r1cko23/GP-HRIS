import { NextRequest } from "next/server";
import { requireEmployeeSection } from "@/lib/access/require-employee-section";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  isEmployeeRef,
  requireDirectoryEmployee,
} from "@/lib/directory/employee-access";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; taskId: string } };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const sectionGate = await requireEmployeeSection(auth, "core");
  if ("error" in sectionGate) return sectionGate.error;

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id
  );
  if (!isEmployeeRef(employee)) return employee;

  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.completed !== "boolean") {
    return jsonError("completed must be a boolean", 400);
  }
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;
  const completedAt = body.completed ? new Date().toISOString() : null;

  const { data, error } = await auth.supabase
    .from("employee_onboarding_tasks")
    .update({
      status: body.completed ? "completed" : "pending",
      completed_at: completedAt,
      completed_by: body.completed ? auth.userId : null,
      completion_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .eq("id", params.taskId)
    .select(
      "id, packet_id, title, description, sort_order, is_required, status, completed_at, completed_by, completion_notes"
    )
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Onboarding task not found", 404);
  return jsonOk({ data });
}
