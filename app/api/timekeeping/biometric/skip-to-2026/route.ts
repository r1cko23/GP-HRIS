import { NextResponse } from "next/server";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";
import { skipAttlogBufferTo2026 } from "@/lib/timekeeping/zkteco-adms";
import {
  ATTLOG_STAMP_FROM_2026,
  DEFAULT_MB10_SERIAL,
} from "@/lib/timekeeping/zkteco-attlog";

export const dynamic = "force-dynamic";

/**
 * POST /api/timekeeping/biometric/skip-to-2026
 * Tell the MB10 (via ATTLOGStamp + optional QUERY) to stop replaying 2024/2025.
 * Does not delete attendance on the device.
 */
export async function POST() {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  const result = await skipAttlogBufferTo2026(admin, DEFAULT_MB10_SERIAL);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to queue skip" },
      { status: 400 }
    );
  }

  const { data: device } = await admin
    .from("biometric_devices")
    .select("attlog_stamp, pending_command, last_seen_at")
    .eq("serial_number", DEFAULT_MB10_SERIAL)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    attlog_stamp: device?.attlog_stamp ?? ATTLOG_STAMP_FROM_2026,
    pending_command: device?.pending_command ?? null,
    last_seen_at: device?.last_seen_at ?? null,
    message:
      "Skip queued. Device logs are NOT deleted. ADMS will ask only for 2026+ punches. Wait ~1 minute, then punch once as a test.",
  });
}
