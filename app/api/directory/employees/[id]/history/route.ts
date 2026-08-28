import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const { data: employee, error: empError } = await auth.supabase
    .from("employees")
    .select("id")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (empError) return jsonError(empError.message, 500);
  if (!employee) return jsonError("Employee not found", 404);

  const { data, error } = await auth.supabase
    .from("employee_movements")
    .select("*")
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return jsonOk({ data });
}
