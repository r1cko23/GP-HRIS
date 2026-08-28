import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import { HOURS_EDITABLE_FIELDS } from "@/lib/timekeeping/hours-edit-fields";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; hoursId: string } };

type PatchBody = {
  note?: string | null;
} & Partial<Record<(typeof HOURS_EDITABLE_FIELDS)[number], number | null>>;

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as PatchBody;
  const publicDb = publicDbClient();

  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id, status, organization_id")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);
  if (period.status !== "draft" && period.status !== "pending_audit") {
    return jsonError("Hours can only be edited while draft or pending audit", 409);
  }

  const { data: existing, error: loadError } = await publicDb
    .from("cutoff_hours")
    .select("*")
    .eq("id", params.hoursId)
    .eq("cutoff_period_id", params.id)
    .maybeSingle();
  if (loadError) return jsonError(loadError.message, 500);
  if (!existing) return jsonError("Cutoff hours row not found", 404);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const field of HOURS_EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      const value = body[field];
      patch[field] =
        value === null || value === undefined ? 0 : Number(value);
    }
  }
  if (body.note !== undefined && body.note != null) {
    patch.remarks = body.note;
  }

  if (Object.keys(patch).length <= 1) {
    return jsonError("No hour fields to update", 400);
  }

  const { data, error } = await publicDb
    .from("cutoff_hours")
    .update(patch)
    .eq("id", params.hoursId)
    .eq("cutoff_period_id", params.id)
    .select()
    .single();
  if (error) return jsonError(error.message, 400);

  await publicDb.from("cutoff_hours_audit").insert({
    cutoff_hours_id: params.hoursId,
    cutoff_period_id: params.id,
    changed_by: auth.userId,
    before_row: existing,
    after_row: data,
    note: body.note ?? null,
  });

  return jsonOk({ data });
}
