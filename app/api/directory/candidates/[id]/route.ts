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
import {
  CANDIDATE_STAGES,
  canTransitionCandidate,
  type CandidateStage,
} from "@/lib/talent/candidates";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function authorize(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return { error: auth } as const;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return { error: orgId } as const;
  const gate = await requirePeopleTalentPage(auth);
  if ("error" in gate) return { error: gate.error } as const;
  return { auth, orgId, capabilities: gate.capabilityKeys } as const;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const access = await authorize(request);
  if ("error" in access) return access.error;
  const { data, error } = await access.auth.supabase
    .from("candidates")
    .select("*")
    .eq("organization_id", access.orgId)
    .eq("id", params.id)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Candidate not found", 404);
  return jsonOk({ data });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const access = await authorize(request);
  if ("error" in access) return access.error;
  if (!actorHasCapability(access.capabilities, "fn:candidates.create")) {
    return jsonError("Forbidden: missing grant fn:candidates.create", 403);
  }
  const body = (await request.json().catch(() => null)) as {
    status?: string;
  } | null;
  const next = body?.status as CandidateStage;
  if (!CANDIDATE_STAGES.includes(next)) {
    return jsonError("Invalid candidate status", 400);
  }

  const { data: existing, error: readError } = await access.auth.supabase
    .from("candidates")
    .select("id,status")
    .eq("organization_id", access.orgId)
    .eq("id", params.id)
    .maybeSingle();
  if (readError) return jsonError(readError.message, 500);
  if (!existing) return jsonError("Candidate not found", 404);
  if (!canTransitionCandidate(existing.status as CandidateStage, next)) {
    return jsonError(
      `Cannot move candidate from ${existing.status} to ${next}`,
      409
    );
  }

  const { data, error } = await access.auth.supabase
    .from("candidates")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("status", existing.status)
    .select("*")
    .single();
  if (error) return jsonError(error.message, 409);
  return jsonOk({ data });
}
