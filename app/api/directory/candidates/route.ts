import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  actorHasCapability,
} from "@/lib/access/load-actor-capabilities";
import { requirePeopleTalentPage } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
  type DirectoryAuth,
} from "@/lib/directory/auth";
import {
  assessCandidateConversionReadiness,
  candidateSearchFilter,
  normalizeCandidateCreateInput,
  parseCandidateListParams,
} from "@/lib/talent/candidates";

export const dynamic = "force-dynamic";

const CANDIDATE_SELECT =
  "id, candidate_number, employee_id, status, first_name, middle_name, last_name, email, mobile, source, consent_status, consent_recorded_at, available_from, created_at, updated_at, employee:employees(id, client_id)";

type CandidateRow = {
  id: string;
  candidate_number: string;
  employee_id: string | null;
  status: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  mobile: string | null;
  source: string | null;
  consent_status: string;
  consent_recorded_at: string | null;
  available_from: string | null;
  created_at: string;
  updated_at: string;
  employee?:
    | { id: string; client_id: string | null }
    | Array<{ id: string; client_id: string | null }>
    | null;
};

function withReadiness(row: CandidateRow) {
  return {
    ...row,
    conversion_readiness: assessCandidateConversionReadiness(row),
  };
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleTalentPage(auth);
  if ("error" in pageGate) return pageGate.error;

  let list;
  try {
    list = parseCandidateListParams(request.nextUrl.searchParams);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid candidate filters",
      400
    );
  }

  let query = auth.supabase
    .from("candidates")
    .select(CANDIDATE_SELECT, { count: "exact" })
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(list.offset, list.offset + list.limit - 1);

  if (list.stage) query = query.eq("status", list.stage);
  if (list.q) {
    const filter = candidateSearchFilter(list.q);
    if (filter) query = query.or(filter);
  }

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);

  return jsonOk({
    data: ((data ?? []) as CandidateRow[]).map(withReadiness),
    count: count ?? 0,
    limit: list.limit,
    offset: list.offset,
  });
}

async function findDedupHints(
  auth: DirectoryAuth,
  organizationId: string,
  candidate: ReturnType<typeof normalizeCandidateCreateInput>
) {
  const found = new Map<string, CandidateRow>();
  const base = () =>
    auth.supabase
      .from("candidates")
      .select(CANDIDATE_SELECT)
      .eq("organization_id", organizationId)
      .limit(10);

  const lookups = [];
  if (candidate.email) lookups.push(base().ilike("email", candidate.email));
  if (candidate.mobile) lookups.push(base().eq("mobile", candidate.mobile));
  lookups.push(
    base()
      .ilike("first_name", candidate.first_name)
      .ilike("last_name", candidate.last_name)
  );

  const results = await Promise.all(lookups);
  for (const result of results) {
    if (result.error) throw new Error(result.error.message);
    for (const row of (result.data ?? []) as CandidateRow[]) {
      found.set(row.id, row);
    }
  }
  return Array.from(found.values()).map(withReadiness);
}

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleTalentPage(auth);
  if ("error" in pageGate) return pageGate.error;
  if (
    !actorHasCapability(pageGate.capabilityKeys, "fn:candidates.create") &&
    !actorHasCapability(pageGate.capabilityKeys, "fn:employees.create")
  ) {
    return jsonError("Forbidden: missing grant fn:candidates.create", 403);
  }

  let body: Record<string, unknown>;
  let candidate;
  try {
    body = (await request.json()) as Record<string, unknown>;
    candidate = normalizeCandidateCreateInput(body);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid candidate",
      400
    );
  }

  let dedupHints;
  try {
    dedupHints = await findDedupHints(auth, orgId, candidate);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Duplicate check failed",
      500
    );
  }

  if (dedupHints.length > 0 && body.force_create !== true) {
    return jsonError("Possible duplicate candidate", 409, {
      dedup_hints: dedupHints,
    });
  }

  const candidateNumber = `CAN-${new Date()
    .toISOString()
    .slice(0, 4)}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data, error } = await auth.supabase
    .from("candidates")
    .insert({
      organization_id: orgId,
      candidate_number: candidateNumber,
      ...candidate,
    })
    .select(CANDIDATE_SELECT)
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(
    {
      data: withReadiness(data as CandidateRow),
      dedup_hints: dedupHints,
    },
    201
  );
}
