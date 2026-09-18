import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  UNMAPPED_SKIP_REASON,
  aggregateUnmappedPins,
  filterAndPageUnmapped,
  mapKey,
  type PunchEventHint,
} from "@/lib/timekeeping/biometric-unmapped";

export const dynamic = "force-dynamic";

/**
 * GET /api/timekeeping/biometric/unmapped
 * PINs seen in ADMS punches that still lack an employee map.
 * Includes terminal display_name when OPERLOG/USERINFO has synced.
 */
export async function GET(request: NextRequest) {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const q = params.get("q")?.trim() ?? "";
  const deviceId = params.get("device_id")?.trim();

  const admin = getAdminClient();

  let eventsQuery = admin
    .from("biometric_punch_events")
    .select("device_id, device_user_id, punched_at, skip_reason")
    .eq("skip_reason", UNMAPPED_SKIP_REASON)
    .order("punched_at", { ascending: false })
    .limit(5000);

  if (deviceId) eventsQuery = eventsQuery.eq("device_id", deviceId);

  const { data: events, error: eventsErr } = await eventsQuery;
  if (eventsErr) {
    return NextResponse.json({ error: eventsErr.message }, { status: 500 });
  }

  let mapsQuery = admin
    .from("biometric_user_maps")
    .select("device_id, device_user_id");
  if (deviceId) mapsQuery = mapsQuery.eq("device_id", deviceId);

  const { data: maps, error: mapsErr } = await mapsQuery;
  if (mapsErr) {
    return NextResponse.json({ error: mapsErr.message }, { status: 500 });
  }

  const mappedKeys = new Set(
    (maps ?? []).map((m) =>
      mapKey(m.device_id as string, m.device_user_id as string)
    )
  );

  let aggregated = aggregateUnmappedPins(
    (events ?? []) as PunchEventHint[],
    mappedKeys
  );

  const nameByKey = new Map<string, string>();
  if (aggregated.length) {
    const deviceIds = [...new Set(aggregated.map((r) => r.deviceId))];
    const { data: names } = await admin
      .from("biometric_device_users")
      .select("device_id, device_user_id, display_name")
      .in("device_id", deviceIds);
    for (const n of names ?? []) {
      nameByKey.set(
        mapKey(n.device_id as string, n.device_user_id as string),
        ((n.display_name as string) || "").trim()
      );
    }
    aggregated = aggregated.map((row) => ({
      ...row,
      displayName: nameByKey.get(mapKey(row.deviceId, row.deviceUserId)) || "",
    }));
  }

  const page = filterAndPageUnmapped(aggregated, { q, limit, offset });

  const pageDeviceIds = [...new Set(page.data.map((r) => r.deviceId))];
  const deviceById = new Map<
    string,
    { id: string; serial_number: string; name: string }
  >();
  if (pageDeviceIds.length) {
    const { data: devices } = await admin
      .from("biometric_devices")
      .select("id, serial_number, name")
      .in("id", pageDeviceIds);
    for (const d of devices ?? []) {
      deviceById.set(d.id as string, d as {
        id: string;
        serial_number: string;
        name: string;
      });
    }
  }

  return NextResponse.json({
    data: page.data.map((row) => ({
      device_id: row.deviceId,
      device_user_id: row.deviceUserId,
      display_name: row.displayName || "",
      punch_count: row.punchCount,
      last_punched_at: row.lastPunchedAt,
      device: deviceById.get(row.deviceId) ?? null,
    })),
    count: page.count,
    limit: page.limit,
    offset: page.offset,
  });
}
