import { NextRequest } from "next/server";
import {
  engagementDepsFromAuth,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { engagementCollapseDuplicate } from "@/lib/directory/engagement";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Park extra 201 files under this person (HR confirmed). Does not delete.
 * POST { extra_id } or { extra_ids: string[] }
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const extraIds = [
    ...(typeof body.extra_id === "string" ? [body.extra_id] : []),
    ...(Array.isArray(body.extra_ids)
      ? body.extra_ids.filter((id): id is string => typeof id === "string")
      : []),
  ];

  const result = await engagementCollapseDuplicate(
    engagementDepsFromAuth(auth, orgId),
    params.id,
    extraIds
  );
  if (!result.ok) {
    return jsonError(result.error, result.status, {
      ...(result.keep_id ? { keep_id: result.keep_id } : {}),
      ...(result.keep_employee_code
        ? { keep_employee_code: result.keep_employee_code }
        : {}),
    });
  }
  return jsonOk({ data: result.data });
}
