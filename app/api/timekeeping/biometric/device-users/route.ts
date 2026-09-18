import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_MB10_SERIAL } from "@/lib/timekeeping/zkteco-attlog";

export const dynamic = "force-dynamic";

/**
 * PUT /api/timekeeping/biometric/device-users
 * Manually set terminal display name for a PIN (when USERINFO sync fails).
 * Body: { device_user_id, display_name, device_serial? }
 */
export async function PUT(request: NextRequest) {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const deviceUserId = String(body?.device_user_id ?? "").trim();
  const displayName = String(body?.display_name ?? "").trim();
  const deviceSerial = String(
    body?.device_serial ?? DEFAULT_MB10_SERIAL
  ).trim();

  if (!deviceUserId) {
    return NextResponse.json(
      { error: "device_user_id is required" },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const { data: device } = await admin
    .from("biometric_devices")
    .select("id")
    .eq("serial_number", deviceSerial)
    .maybeSingle();

  if (!device?.id) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("biometric_device_users")
    .upsert(
      {
        device_id: device.id,
        device_user_id: deviceUserId,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,device_user_id" }
    )
    .select("device_user_id, display_name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
