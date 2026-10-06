import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { hireAlertsClearedByPick } from "@/lib/directory/hire-alert";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  if (!auth.viaServiceKey) return jsonError("Forbidden", 403);
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json().catch(() => null)) as {
    branch_id?: string;
    picked_name?: string;
    employee_id?: string;
  } | null;
  const branchId = body?.branch_id?.trim() ?? "";
  const pickedName = body?.picked_name?.trim() ?? "";
  const employeeId = body?.employee_id?.trim() ?? "";
  if (!branchId || !pickedName || !employeeId) {
    return jsonError("Site, name, and 201 are required.", 400);
  }

  const { data: alerts, error } = await auth.supabase
    .from("hire_alerts")
    .select("id, person_name, status")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .eq("status", "open");
  if (error) return jsonError(error.message, 500);

  const ids = hireAlertsClearedByPick({
    alerts: (alerts ?? []).map((row) => ({
      id: row.id,
      personName: row.person_name,
      status: "open",
    })),
    pickedName,
  });
  if (ids.length === 0) return jsonOk({ data: { cleared: [] } });

  const now = new Date().toISOString();
  const { error: updateError } = await auth.supabase
    .from("hire_alerts")
    .update({
      status: "cleared",
      cleared_at: now,
      updated_at: now,
      cleared_employee_id: employeeId,
    })
    .in("id", ids);
  if (updateError) return jsonError(updateError.message, 400);
  return jsonOk({ data: { cleared: ids } });
}
