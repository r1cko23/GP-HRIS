import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/timekeeping/biometric/user-maps
 * List PIN → employee maps (search + pagination).
 */
export async function GET(request: NextRequest) {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const q = params.get("q")?.trim();
  const deviceId = params.get("device_id");

  const admin = getAdminClient();
  let query = admin
    .from("biometric_user_maps")
    .select(
      `
      id,
      device_user_id,
      employee_id,
      created_at,
      device:biometric_devices ( id, serial_number, name ),
      employee:employees ( id, employee_id, full_name, is_active )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (deviceId) query = query.eq("device_id", deviceId);
  if (q) {
    query = query.or(
      `device_user_id.ilike.%${q}%,employee_id.eq.${q}`
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], count: count ?? 0, limit, offset });
}

/**
 * POST /api/timekeeping/biometric/user-maps
 * Body: { device_user_id, employee_id, device_serial? }
 */
export async function POST(request: NextRequest) {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const deviceUserId = String(body?.device_user_id ?? "").trim();
  const employeeId = String(body?.employee_id ?? "").trim();
  const deviceSerial = String(
    body?.device_serial ?? "UDP3235201130"
  ).trim();

  if (!deviceUserId || !employeeId) {
    return NextResponse.json(
      { error: "device_user_id and employee_id are required" },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const { data: device, error: deviceErr } = await admin
    .from("biometric_devices")
    .select("id")
    .eq("serial_number", deviceSerial)
    .maybeSingle();

  if (deviceErr || !device?.id) {
    return NextResponse.json(
      { error: `Device SN ${deviceSerial} not found. Apply migration 241.` },
      { status: 404 }
    );
  }

  const { data: emp } = await admin
    .from("employees")
    .select("id, is_active")
    .eq("id", employeeId)
    .maybeSingle();

  if (!emp?.id || !emp.is_active) {
    return NextResponse.json(
      { error: "Employee not found or inactive" },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("biometric_user_maps")
    .upsert(
      {
        device_id: device.id,
        device_user_id: deviceUserId,
        employee_id: employeeId,
      },
      { onConflict: "device_id,device_user_id" }
    )
    .select(
      `
      id,
      device_user_id,
      employee_id,
      device:biometric_devices ( serial_number, name ),
      employee:employees ( employee_id, full_name )
    `
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

/**
 * DELETE /api/timekeeping/biometric/user-maps?id=
 */
export async function DELETE(request: NextRequest) {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin.from("biometric_user_maps").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
