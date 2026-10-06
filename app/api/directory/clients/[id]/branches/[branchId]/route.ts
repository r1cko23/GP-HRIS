import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { parseTimesheetPayFormat } from "@/lib/directory/timesheet-pay-format";
import { normalizeProseTextOrNull } from "@/lib/prose-text";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; branchId: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const { data, error } = await auth.supabase
    .from("client_branches")
    .select("id, client_id, name, location, is_active, timesheet_pay_format")
    .eq("organization_id", orgId)
    .eq("client_id", params.id)
    .eq("id", params.branchId)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Site not found", 404);
  return jsonOk({ data });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return jsonError("name is required", 400);
    }
    patch.name = normalizeProseTextOrNull(body.name) ?? body.name.trim();
  }
  if ("location" in body) {
    patch.location =
      typeof body.location === "string" && body.location.trim()
        ? normalizeProseTextOrNull(body.location)
        : null;
  }
  if ("is_active" in body) {
    patch.is_active = Boolean(body.is_active);
  }
  if ("timesheet_pay_format" in body) {
    const parsed = parseTimesheetPayFormat(body.timesheet_pay_format);
    if (body.timesheet_pay_format != null && body.timesheet_pay_format !== "" && parsed == null) {
      return jsonError("timesheet_pay_format must be 0, 7, 10, 11, 12, or 13", 400);
    }
    patch.timesheet_pay_format = parsed;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("No site fields to update", 400);
  }

  const { data, error } = await auth.supabase
    .from("client_branches")
    .update(patch)
    .eq("organization_id", orgId)
    .eq("client_id", params.id)
    .eq("id", params.branchId)
    .select()
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Site not found", 404);
  return jsonOk({ data });
}
