import { NextRequest } from "next/server";
import {
  engagementDepsFromAuth,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { engagementTransfer } from "@/lib/directory/engagement";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Transfer current engagement to another client — same person, same employee_code.
 * Does not create a second 201 (ADR 0006).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const clientId =
    typeof body.client_id === "string" && body.client_id.trim()
      ? body.client_id.trim()
      : null;
  if (!clientId) return jsonError("client_id is required", 400);

  const branchId =
    typeof body.branch_id === "string" && body.branch_id.trim()
      ? body.branch_id.trim()
      : null;
  const positionId =
    typeof body.position_id === "string" && body.position_id.trim()
      ? body.position_id.trim()
      : null;
  const effectiveDate =
    typeof body.effective_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.effective_date.trim())
      ? body.effective_date.trim()
      : undefined;
  const remarks =
    typeof body.remarks === "string" && body.remarks.trim()
      ? body.remarks.trim()
      : null;

  const result = await engagementTransfer(
    engagementDepsFromAuth(auth, orgId),
    params.id,
    {
      client_id: clientId,
      branch_id: branchId,
      position_id: positionId,
      effective_date: effectiveDate,
      remarks,
    }
  );
  if (!result.ok) return jsonError(result.error, result.status);
  return jsonOk({ data: result.data });
}
