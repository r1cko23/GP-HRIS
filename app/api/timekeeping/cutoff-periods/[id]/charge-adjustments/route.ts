import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const organizationId = await requireAuthorizedOrganization(auth);
  if (typeof organizationId !== "string") return organizationId;
  const gate = await requireCapability(auth, "fn:payslips.create");
  if ("error" in gate) return gate.error;

  const body = (await request.json().catch(() => null)) as {
    kind?: "payable" | "billable";
    source_batch_id?: string;
    reason?: string;
    lines?: Array<{
      approved_work_line_id?: string;
      adjustment_amount?: number;
    }>;
  } | null;
  if (
    !body ||
    !["payable", "billable"].includes(body.kind ?? "") ||
    !body.source_batch_id?.trim() ||
    !body.reason?.trim() ||
    !Array.isArray(body.lines) ||
    body.lines.length === 0 ||
    body.lines.some(
      (line) =>
        !line.approved_work_line_id?.trim() ||
        !Number.isFinite(line.adjustment_amount) ||
        line.adjustment_amount === 0
    )
  ) {
    return jsonError("Invalid charge adjustment", 400);
  }

  const db = publicDbClient();
  const { data: period, error: periodError } = await db
    .from("cutoff_periods")
    .select("id")
    .eq("id", params.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  const batchTable =
    body.kind === "payable"
      ? "payable_charge_batches"
      : "billable_charge_batches";
  const { data: source, error: sourceError } = await db
    .from(batchTable)
    .select("id,approved_work_snapshot_id,approved_work_snapshots!inner(cutoff_period_id)")
    .eq("id", body.source_batch_id)
    .eq("approved_work_snapshots.cutoff_period_id", params.id)
    .maybeSingle();
  if (sourceError) return jsonError(sourceError.message, 500);
  if (!source) return jsonError("Source charge batch not found", 404);

  const { data, error } = await db.rpc("create_charge_adjustment", {
    p_kind: body.kind,
    p_source_batch_id: body.source_batch_id,
    p_reason: body.reason.trim(),
    p_lines: body.lines,
  });
  if (error) return jsonError(error.message, 409);
  return jsonOk({ data: { batch_id: data, status: "draft" } }, 201);
}
