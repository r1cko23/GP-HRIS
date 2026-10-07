import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  evaluateRolloutExitGates,
  type RolloutMetrics,
} from "@/lib/integration/rollout-gates";
import { publicDbClient } from "@/lib/timekeeping/public-db";

const STATUSES = new Set([
  "planned",
  "pilot",
  "expanded",
  "retired",
  "rolled_back",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const organizationId = await requireAuthorizedOrganization(auth);
  if (typeof organizationId !== "string") return organizationId;
  const gate = await requireCapability(auth, "fn:admin.system");
  if ("error" in gate) return gate.error;

  const body = (await request.json().catch(() => null)) as {
    status?: string;
    identity_enabled?: boolean;
    demand_enabled?: boolean;
    approved_work_enabled?: boolean;
    pay_bill_enabled?: boolean;
    rollback_reason?: string | null;
    metrics?: Partial<RolloutMetrics>;
  } | null;
  if (!body?.status || !STATUSES.has(body.status)) {
    return jsonError("Invalid rollout status", 400);
  }
  const metrics: RolloutMetrics = {
    identityCoveragePercent: Number(body.metrics?.identityCoveragePercent ?? 0),
    placementCoveragePercent: Number(body.metrics?.placementCoveragePercent ?? 0),
    workLineageCoveragePercent: Number(
      body.metrics?.workLineageCoveragePercent ?? 0
    ),
    orphanCount: Number(body.metrics?.orphanCount ?? 0),
    unexplainedVarianceCount: Number(
      body.metrics?.unexplainedVarianceCount ?? 0
    ),
    signedOffCutoffs: Number(body.metrics?.signedOffCutoffs ?? 0),
  };
  const evaluation = evaluateRolloutExitGates(metrics);
  const allSlices =
    body.identity_enabled === true &&
    body.demand_enabled === true &&
    body.approved_work_enabled === true &&
    body.pay_bill_enabled === true;
  if (
    body.status === "retired" &&
    (!evaluation.canRetireLegacyPaths || !allSlices)
  ) {
    return jsonError("Legacy paths cannot retire until every exit gate passes", 409, {
      blockers: [
        ...evaluation.blockers,
        ...(allSlices ? [] : ["platform_slices"]),
      ],
    });
  }

  const now = new Date().toISOString();
  const { data, error } = await publicDbClient()
    .from("platform_rollout_pilots")
    .update({
      status: body.status,
      identity_enabled: body.identity_enabled === true,
      demand_enabled: body.demand_enabled === true,
      approved_work_enabled: body.approved_work_enabled === true,
      pay_bill_enabled: body.pay_bill_enabled === true,
      legacy_paths_retired: body.status === "retired",
      metrics,
      exit_gate_blockers: evaluation.blockers,
      signed_off_cutoffs: metrics.signedOffCutoffs,
      started_at: body.status === "pilot" ? now : undefined,
      retired_at: body.status === "retired" ? now : null,
      rollback_reason:
        body.status === "rolled_back"
          ? body.rollback_reason?.trim() || "Rollback requested"
          : null,
      updated_by: auth.userId,
      updated_at: now,
    })
    .eq("id", params.id)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();
  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Rollout pilot not found", 404);
  return jsonOk({ data, evaluation });
}
