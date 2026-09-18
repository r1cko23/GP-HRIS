import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";
import { requestUserInfoSync } from "@/lib/timekeeping/zkteco-adms";
import { DEFAULT_MB10_SERIAL } from "@/lib/timekeeping/zkteco-attlog";

export const dynamic = "force-dynamic";

/**
 * POST /api/timekeeping/biometric/sync-names
 * Queue DATA QUERY USERINFO + reset OPERLOG stamp so the MB10 re-pushes users.
 */
export async function POST() {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  const result = await requestUserInfoSync(admin, DEFAULT_MB10_SERIAL);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to queue sync" },
      { status: 400 }
    );
  }

  // Reset OPERLOG stamp so handshake asks for user/op logs again
  await admin
    .from("biometric_devices")
    .update({
      operlog_stamp: null,
      updated_at: new Date().toISOString(),
    })
    .eq("serial_number", DEFAULT_MB10_SERIAL);

  const { data: device } = await admin
    .from("biometric_devices")
    .select("id, last_seen_at, pending_command")
    .eq("serial_number", DEFAULT_MB10_SERIAL)
    .maybeSingle();

  const { count: userCount } = device?.id
    ? await admin
        .from("biometric_device_users")
        .select("id", { count: "exact", head: true })
        .eq("device_id", device.id)
    : { count: 0 };

  return NextResponse.json({
    ok: true,
    pending_command: device?.pending_command ?? "DATA QUERY USERINFO",
    last_seen_at: device?.last_seen_at ?? null,
    terminal_names: userCount ?? 0,
    message:
      userCount && userCount > 0
        ? `Already have ${userCount} terminal name(s). Click Refresh.`
        : "Queued name sync. The terminal must stay on ADMS (cloud icon). Wait 1–2 minutes, then Refresh. If names stay blank, type them in the Name column — punches only send PIN.",
  });
}

/**
 * GET /api/timekeeping/biometric/sync-names — status for the UI.
 */
export async function GET() {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  const { data: device } = await admin
    .from("biometric_devices")
    .select("id, last_seen_at, pending_command, serial_number")
    .eq("serial_number", DEFAULT_MB10_SERIAL)
    .maybeSingle();

  const { count: userCount } = device?.id
    ? await admin
        .from("biometric_device_users")
        .select("id", { count: "exact", head: true })
        .eq("device_id", device.id)
    : { count: 0 };

  return NextResponse.json({
    last_seen_at: device?.last_seen_at ?? null,
    pending_command: device?.pending_command ?? null,
    terminal_names: userCount ?? 0,
  });
}
