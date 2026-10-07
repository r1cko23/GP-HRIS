import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { requireCapability } from "@/lib/access/require-capability";
import { validatePlatformEvent } from "@/lib/integration/platform-events";

export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "pending",
  "delivering",
  "delivered",
  "failed",
  "dead",
]);

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const gate = await requireCapability(auth, "fn:admin.system");
  if ("error" in gate) return gate.error;

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const status = params.get("status")?.trim() ?? "";
  const producer = params.get("producer")?.trim() ?? "";
  const q = params.get("q")?.trim() ?? "";

  if (status && !STATUSES.has(status)) {
    return jsonError("Invalid integration event status", 400);
  }

  let query = auth.supabase
    .schema("public")
    .from("integration_outbox")
    .select(
      "id,event_id,event_type,event_version,occurred_at,recorded_at,producer,subject,organization_id,client_id,correlation_id,causation_id,destination_app,status,attempts,max_attempts,available_at,delivered_at,last_error",
      { count: "exact" }
    )
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (producer) query = query.eq("producer", producer);
  if (q) {
    const escaped = q.replaceAll(",", " ").replaceAll("%", "\\%");
    query = query.or(
      `event_type.ilike.%${escaped}%,subject.ilike.%${escaped}%,last_error.ilike.%${escaped}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk({ data: data ?? [], count: count ?? 0, limit, offset });
}

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  if (!auth.viaServiceKey) {
    return jsonError("Service authentication is required", 403);
  }

  const validation = validatePlatformEvent(
    await request.json().catch(() => null)
  );
  if (!validation.ok) return jsonError(validation.error, 400);
  const event = validation.event;
  if (
    auth.organizationId &&
    auth.organizationId !== event.organization_id
  ) {
    return jsonError("Event organization does not match request scope", 403);
  }

  if (event.event_type === "gp.csm.placement.approved.v1") {
    const { data, error } = await auth.supabase.rpc(
      "accept_csm_placement_event",
      { p_envelope: event }
    );
    if (error) return jsonError(error.message, 409);
    return jsonOk({ accepted: true, placement_id: data }, 202);
  }

  const integration = auth.supabase.schema("public");
  const { data, error } = await integration
    .from("integration_inbox")
    .upsert(
      {
        event_id: event.event_id,
        consumer_name: "gp-hris-platform",
        producer: event.producer,
        event_type: event.event_type,
        event_version: event.event_version,
        subject: event.subject,
        organization_id: event.organization_id,
        client_id: event.client_id,
        data: event.data,
        correlation_id: event.correlation_id,
        causation_id: event.causation_id,
        envelope: event,
        status: "received",
      },
      {
        onConflict: "consumer_name,event_id",
        ignoreDuplicates: true,
      }
    )
    .select("id,status")
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ accepted: true, duplicate: !data, receipt: data }, 202);
}
