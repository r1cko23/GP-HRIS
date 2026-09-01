import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import {
  validateCatchupAmount,
  validateCatchupReason,
} from "@/lib/payroll-register/catchup-corrections";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; correctionId: string } };

async function loadPendingCorrection(
  orgId: string,
  sourceCutoffId: string,
  correctionId: string
) {
  const publicDb = publicDbClient();
  const { data, error } = await publicDb
    .from("payroll_catchup_corrections")
    .select("*")
    .eq("id", correctionId)
    .eq("organization_id", orgId)
    .eq("source_cutoff_period_id", sourceCutoffId)
    .maybeSingle();
  if (error) return { error: jsonError(error.message, 500) as Response };
  if (!data) return { error: jsonError("Correction not found", 404) as Response };
  if (data.status !== "pending") {
    return {
      error: jsonError("Only pending corrections can be changed", 409) as Response,
    };
  }
  return { data, publicDb };
}

/** Update amount/reason on a pending catch-up correction. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const loaded = await loadPendingCorrection(
    orgId,
    params.id,
    params.correctionId
  );
  if ("error" in loaded && loaded.error) return loaded.error;

  const body = ((await request.json().catch(() => ({}))) ?? {}) as {
    amount?: number;
    reason?: string;
  };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.amount !== undefined) {
    const amount = validateCatchupAmount(body.amount);
    if (amount == null) {
      return jsonError("amount must be a non-zero number", 400);
    }
    patch.amount = amount;
  }
  if (body.reason !== undefined) {
    const reason = validateCatchupReason(body.reason);
    if (!reason) {
      return jsonError("reason must be at least 3 characters", 400);
    }
    patch.reason = reason;
  }

  const { data, error } = await loaded.publicDb!
    .from("payroll_catchup_corrections")
    .update(patch)
    .eq("id", params.correctionId)
    .select("*")
    .single();
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data });
}

/** Cancel a pending catch-up correction. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const loaded = await loadPendingCorrection(
    orgId,
    params.id,
    params.correctionId
  );
  if ("error" in loaded && loaded.error) return loaded.error;

  const now = new Date().toISOString();
  const { data, error } = await loaded.publicDb!
    .from("payroll_catchup_corrections")
    .update({
      status: "cancelled",
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", params.correctionId)
    .select("*")
    .single();
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data });
}
