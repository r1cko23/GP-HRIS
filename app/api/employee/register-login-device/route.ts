import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return (req as unknown as { ip?: string }).ip ?? null;
}

/**
 * Registers the current device for an employee (after successful authenticate_employee).
 * Call from client only after login success; server trusts body for same-origin portal.
 * Returns allowed (false only on validation/DB error), is_new_device, total_device_count,
 * exceeds_recommended_device_count when employee has more than 2 distinct devices (login still allowed).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employee_id,
      device_fingerprint,
      client_id,
      device_label,
    } = body as {
      employee_id?: string;
      device_fingerprint?: string;
      client_id?: string;
      device_label?: string;
    };

    if (!employee_id) {
      return NextResponse.json(
        { allowed: false, error: "Employee ID is required" },
        { status: 400 }
      );
    }
    if (!device_fingerprint || String(device_fingerprint).trim() === "") {
      return NextResponse.json(
        { allowed: false, error: "Device fingerprint is required" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    const ipAddress = getClientIp(request);

    const { data, error } = await supabase.rpc("register_employee_login_device", {
      p_employee_id: employee_id,
      p_device_fingerprint: String(device_fingerprint).trim(),
      p_client_id: client_id ?? null,
      p_device_label: device_label ?? null,
      p_ip_address: ipAddress,
    });

    if (error) {
      console.error("Error registering login device:", error);
      return NextResponse.json(
        { allowed: false, error: error.message },
        { status: 500 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    const is_new_device = row?.is_new_device ?? false;
    const total_device_count = Number(row?.total_device_count ?? 0);
    const allowed = row?.allowed ?? true;
    const message = row?.message ?? null;
    const exceeds_recommended_device_count =
      (row as { exceeds_recommended_device_count?: boolean })
        ?.exceeds_recommended_device_count ?? false;

    return NextResponse.json({
      allowed,
      is_new_device,
      total_device_count,
      exceeds_recommended_device_count,
      message: message || undefined,
    });
  } catch (err: unknown) {
    console.error("Error in register-login-device API:", err);
    return NextResponse.json(
      {
        allowed: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
