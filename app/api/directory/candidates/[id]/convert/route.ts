import { NextRequest } from "next/server";
import { actorHasCapability } from "@/lib/access/load-actor-capabilities";
import { requirePeopleTalentPage } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const gate = await requirePeopleTalentPage(auth);
  if ("error" in gate) return gate.error;
  if (!actorHasCapability(gate.capabilityKeys, "fn:employees.create")) {
    return jsonError("Forbidden: missing grant fn:employees.create", 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    hire_date?: string | null;
  };
  const hireDate = body.hire_date?.trim() || null;
  if (hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
    return jsonError("hire_date must be YYYY-MM-DD or null", 400);
  }
  const { data: candidate, error: candidateError } = await auth.supabase
    .from("candidates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();
  if (candidateError) return jsonError(candidateError.message, 500);
  if (!candidate) return jsonError("Candidate not found", 404);

  const { data, error } = await auth.supabase.rpc(
    "convert_candidate_to_person",
    { p_candidate_id: params.id, p_hire_date: hireDate }
  );
  if (error) return jsonError(error.message, 409);
  return jsonOk({ data: { employee_id: data } }, 201);
}
