import { NextRequest } from "next/server";
import { requirePeopleEmployeesPage } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { mapEmployeeWorkCounts } from "@/lib/directory/work-queues";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;

  const { data, error } = await auth.supabase.rpc("employee_work_counts", {
    p_org: orgId,
  });
  if (error) return jsonError(error.message, 500);

  const row = Array.isArray(data) ? data[0] : data;
  return jsonOk({
    data: mapEmployeeWorkCounts(
      (row ?? null) as Record<string, unknown> | null
    ),
  });
}
