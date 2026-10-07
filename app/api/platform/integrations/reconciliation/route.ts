import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  reconcileEventReceipts,
} from "@/lib/integration/reconciliation";

export const dynamic = "force-dynamic";

type ReconciliationBody = {
  destination_app?: string;
  organization_id?: string;
  receipts?: Array<{ event_id?: string; event_version?: number }>;
  replay_missing?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const gate = await requireCapability(auth, "fn:admin.system");
  if ("error" in gate) return gate.error;

  const body = (await request.json().catch(() => null)) as
    | ReconciliationBody
    | null;
  const destinationApp = body?.destination_app?.trim();
  const organizationId = body?.organization_id?.trim();
  const receipts = body?.receipts;
  if (!destinationApp) return jsonError("destination_app is required", 400);
  if (!Array.isArray(receipts)) return jsonError("receipts must be an array", 400);
  if (receipts.length > 10_000) {
    return jsonError("receipts cannot exceed 10000 rows per run", 400);
  }

  const integration = auth.supabase.schema("public");
  let query = integration
    .from("integration_outbox")
    .select("event_id,event_version,status")
    .eq("destination_app", destinationApp)
    .eq("status", "delivered")
    .order("event_id")
    .limit(10_000);
  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data: source, error: sourceError } = await query;
  if (sourceError) return jsonError(sourceError.message, 500);

  const result = reconcileEventReceipts({
    source: (source ?? []).map((row) => ({
      eventId: row.event_id,
      eventVersion: row.event_version,
    })),
    receipts: receipts.map((receipt) => ({
      eventId: receipt.event_id?.trim() ?? "",
      eventVersion: receipt.event_version ?? 0,
    })),
  });

  let repairedCount = 0;
  const replayIds = [...result.missingEventIds, ...result.staleEventIds];
  if (body?.replay_missing && replayIds.length > 0) {
    const { data: replayed, error: replayError } = await integration
      .from("integration_outbox")
      .update({
        status: "pending",
        attempts: 0,
        available_at: new Date().toISOString(),
        delivered_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .in("event_id", replayIds)
      .eq("destination_app", destinationApp)
      .select("id");
    if (replayError) return jsonError(replayError.message, 500);
    repairedCount = replayed?.length ?? 0;
  }

  const { data: run, error: runError } = await integration
    .from("integration_reconciliation_runs")
    .insert({
      reconciler: "gp-hris",
      scope_type: organizationId ? "organization" : "destination",
      scope_id: organizationId ?? destinationApp,
      status: "completed",
      scanned_count: result.scannedCount,
      missing_count: result.missingEventIds.length,
      repaired_count: repairedCount,
      unresolved_count:
        result.missingEventIds.length +
        result.staleEventIds.length -
        repairedCount,
      stale_count: result.staleEventIds.length,
      completed_at: new Date().toISOString(),
      details: {
        destination_app: destinationApp,
        unexpected_event_ids: result.unexpectedEventIds,
      },
    })
    .select("id,correlation_id,status,started_at,completed_at")
    .single();
  if (runError) return jsonError(runError.message, 500);

  return jsonOk({ data: { run, ...result, repairedCount } });
}
