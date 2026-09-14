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

  const { data, error } = await auth.supabase.rpc("employee_work_counts", {
    p_org: orgId,
  });
  if (error) return jsonError(error.message, 500);

  const row = Array.isArray(data) ? data[0] : data;
  return jsonOk({
    data: {
      needs_review: Number(row?.needs_review ?? 0),
      missing_statutory: Number(row?.missing_statutory ?? 0),
      missing_documents: Number(row?.missing_documents ?? 0),
      incomplete_201: Number(row?.incomplete_201 ?? 0),
    },
  });
}
