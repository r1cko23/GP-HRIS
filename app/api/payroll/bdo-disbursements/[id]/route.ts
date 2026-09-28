import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  canPasteBdoReference,
  canVoidDisbursement,
  type BdoDisbursementSnap,
} from "@/lib/payroll-register/bdo-disbursement";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * PATCH /api/payroll/bdo-disbursements/[id]
 * Paste BDO reference → confirmed, or void while awaiting_ref.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  let body: {
    bdo_reference?: string;
    status?: string;
    void_reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const publicDb = publicDbClient();
  const { data: row, error } = await publicDb
    .from("payroll_bdo_disbursements")
    .select("id, status, bdo_reference, payroll_register_run_id")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!row) return jsonError("Disbursement not found", 404);

  const snap = row as BdoDisbursementSnap;

  if (body.status === "void") {
    const gate = canVoidDisbursement(snap);
    if (!gate.ok) return jsonError(gate.error ?? "Cannot void", 409);
    const { data: updated, error: upErr } = await publicDb
      .from("payroll_bdo_disbursements")
      .update({
        status: "void",
        voided_at: new Date().toISOString(),
        void_reason: String(body.void_reason ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("organization_id", orgId)
      .select("*")
      .single();
    if (upErr) return jsonError(upErr.message, 500);
    return jsonOk({ data: updated });
  }

  if (body.bdo_reference != null) {
    const { data: otherRefs, error: refErr } = await publicDb
      .from("payroll_bdo_disbursements")
      .select("bdo_reference")
      .eq("organization_id", orgId)
      .not("bdo_reference", "is", null)
      .neq("id", params.id);

    if (refErr) return jsonError(refErr.message, 500);
    const existing = new Set(
      (otherRefs ?? [])
        .map((r) => String(r.bdo_reference ?? "").trim())
        .filter(Boolean)
    );
    const gate = canPasteBdoReference(
      snap,
      String(body.bdo_reference),
      existing
    );
    if (!gate.ok) return jsonError(gate.error ?? "Cannot confirm", 409);

    const ref = String(body.bdo_reference).trim();
    const { data: updated, error: upErr } = await publicDb
      .from("payroll_bdo_disbursements")
      .update({
        status: "confirmed",
        bdo_reference: ref,
        bdo_referenced_at: new Date().toISOString(),
        bdo_referenced_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("organization_id", orgId)
      .select("*")
      .single();

    if (upErr) {
      if (upErr.code === "23505") {
        return jsonError(
          "This BDO reference is already tied to another Debit Memo",
          409
        );
      }
      return jsonError(upErr.message, 500);
    }
    return jsonOk({ data: updated });
  }

  return jsonError("Provide bdo_reference or status: \"void\"", 400);
}
