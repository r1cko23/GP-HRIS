import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { canIngestFromGpClient } from "@/lib/timekeeping/cutoff-types";
import {
  aggregateGpClientIngestResults,
  loadCutoffPeriodSiteIds,
} from "@/lib/timekeeping/cutoff-period-sites";
import {
  GpClientConfigError,
  requestGpClientCutoffIngest,
} from "@/lib/timekeeping/gp-client-ingest";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id, client_id, branch_id, period_start, period_end, status, source_app")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  if (
    !canIngestFromGpClient(
      period.source_app as string | null,
      period.status as string | null
    )
  ) {
    return jsonError(
      "GP-Client ingest is only for Deployed draft or pending-audit cutoffs.",
      409
    );
  }

  const sites = await loadCutoffPeriodSiteIds(
    publicDb,
    period.id as string,
    period.branch_id as string | null
  );
  if (sites.error) return jsonError(sites.error, 500);
  if (!sites.branchIds.length) {
    return jsonError("This Deployed cutoff is missing a site.", 400);
  }

  try {
    const perSite = [];
    for (const branchId of sites.branchIds) {
      perSite.push(
        await requestGpClientCutoffIngest({
          id: period.id as string,
          client_id: period.client_id as string,
          branch_id: branchId,
          period_start: String(period.period_start),
          period_end: String(period.period_end),
        })
      );
    }
    return jsonOk({ data: aggregateGpClientIngestResults(perSite) });
  } catch (err) {
    if (err instanceof GpClientConfigError) {
      return jsonError(err.message, 503);
    }
    const message = err instanceof Error ? err.message : "GP-Client ingest failed";
    return jsonError(message, 400);
  }
}
