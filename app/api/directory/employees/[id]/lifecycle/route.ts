import { NextRequest } from "next/server";
import {
  engagementDepsFromAuth,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { engagementLifecycle } from "@/lib/directory/engagement";
import {
  isLifecycleAction,
  LIFECYCLE_ACTIONS,
} from "@/lib/directory/engagement-transitions";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Explicit lifecycle transitions for the person master (ADR 0006 / 0008).
 * Inactive → active must use /rehire.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action || !isLifecycleAction(action)) {
    return jsonError(
      `action required. Allowed: ${LIFECYCLE_ACTIONS.join(", ")}`,
      400
    );
  }

  const remarks =
    typeof body.remarks === "string" && body.remarks.trim()
      ? body.remarks.trim()
      : null;
  const resignDate =
    typeof body.resign_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.resign_date.trim())
      ? body.resign_date.trim()
      : null;

  const result = await engagementLifecycle(
    engagementDepsFromAuth(auth, orgId),
    params.id,
    { action, remarks, resign_date: resignDate }
  );
  if (!result.ok) return jsonError(result.error, result.status);
  return jsonOk({ data: result.data, action });
}
