import { NextRequest } from "next/server";
import { requirePeopleEmployeesPage } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;

  const { id } = params;
  const { data: existing, error: readError } = await auth.supabase
    .from("hire_alerts")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (readError) return jsonError(readError.message, 500);
  if (!existing) return jsonError("Alert not found.", 404);
  if (existing.status !== "open") {
    return jsonError("This alert is already closed.", 409);
  }

  const { data, error } = await auth.supabase
    .from("hire_alerts")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, status")
    .single();
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data });
}
