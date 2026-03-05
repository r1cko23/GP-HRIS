import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Returns devices for the given employee (for "Your devices" page).
 * Call from employee portal with employee_id from session; same-origin only.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employee_id = searchParams.get("employee_id");

    if (!employee_id) {
      return NextResponse.json(
        { error: "Employee ID is required" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    const { data, error } = await supabase.rpc("get_employee_devices", {
      p_employee_id: employee_id,
    });

    if (error) {
      console.error("Error fetching employee devices:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const devices = (Array.isArray(data) ? data : []) as Array<{
      device_label: string | null;
      first_seen_at: string;
      last_seen_at: string;
      ip_address: string | null;
    }>;

    return NextResponse.json({ devices });
  } catch (err: unknown) {
    console.error("Error in my-devices API:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
