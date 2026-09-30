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
  canVoidSilRun,
  isSilRunStatus,
  type SilRunStatus,
} from "@/lib/reports/sil-run-lifecycle";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const publicDb = publicDbClient();
  const { data: run, error } = await publicDb
    .from("sil_monthly_runs")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!run) return jsonError("SIL run not found", 404);

  const status = String(run.status ?? "");
  if (!isSilRunStatus(status)) return jsonError("Invalid run status", 500);
  const gate = canVoidSilRun(status as SilRunStatus);
  if (!gate.ok) return jsonError(gate.error, 409);

  const now = new Date().toISOString();
  const { data: updated, error: updError } = await publicDb
    .from("sil_monthly_runs")
    .update({
      status: "void",
      voided_at: now,
      voided_by: auth.userId,
      updated_at: now,
    })
    .eq("id", params.id)
    .in("status", ["draft", "approved"])
    .select("*")
    .maybeSingle();
  if (updError) return jsonError(updError.message, 500);
  if (!updated) return jsonError("Run cannot be voided", 409);

  return jsonOk({
    run: {
      id: updated.id,
      status: updated.status,
      line_count: updated.line_count,
      totals: updated.totals,
      built_at: updated.built_at,
      approved_at: updated.approved_at,
      posted_at: updated.posted_at,
      voided_at: updated.voided_at,
    },
  });
}
