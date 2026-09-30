import { NextRequest } from "next/server";
import { loadActorCapabilityKeys } from "@/lib/access/load-actor-capabilities";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  canApproveClientIndustry,
  parseClientIndustry,
  planReviewPosition,
  type PositionApprovalStatus,
} from "@/lib/directory/position-approval";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Approve or reject a pending position rate card.
 * Michelle: Hotel; Michael: Non-Hotel (capability-scoped).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const decision =
    body.decision === "approve" || body.decision === "reject"
      ? body.decision
      : null;
  if (!decision) {
    return jsonError('decision must be "approve" or "reject"', 400);
  }

  const { data: current, error: currentError } = await auth.supabase
    .from("positions")
    .select("*, client:clients(id, name, industry)")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();
  if (currentError) return jsonError(currentError.message, 500);
  if (!current) return jsonError("Position not found", 404);

  const client = current.client as
    | { id: string; name: string; industry?: string | null }
    | null
    | Array<{ id: string; name: string; industry?: string | null }>;
  const clientRow = Array.isArray(client) ? client[0] : client;
  const industry = parseClientIndustry(clientRow?.industry ?? "NON-HOTEL");
  if (!industry) {
    return jsonError("Client industry is invalid", 400);
  }

  const capabilityKeys = await loadActorCapabilityKeys(auth);
  if (!canApproveClientIndustry({ capabilityKeys, industry })) {
    return jsonError(
      `Forbidden: cannot approve ${industry} positions`,
      403
    );
  }

  const planned = planReviewPosition({
    currentStatus: (current.approval_status ??
      "draft") as PositionApprovalStatus,
    decision,
    rejection_reason:
      typeof body.rejection_reason === "string"
        ? body.rejection_reason
        : null,
  });
  if (!planned.ok) return jsonError(planned.error, planned.status);

  const { data, error } = await auth.supabase
    .from("positions")
    .update({
      approval_status: planned.next,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
      rejection_reason: planned.rejection_reason,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .select("*, client:clients(id, name, industry)")
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Position not found", 404);
  return jsonOk({ data });
}
