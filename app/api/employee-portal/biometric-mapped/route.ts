import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/employee-portal/biometric-mapped?employee_id=
 * Portal gate: true when this bundy employee has a biometric PIN map.
 */
export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employee_id")?.trim();
  if (!employeeId) {
    return NextResponse.json(
      { error: "employee_id is required" },
      { status: 400 }
    );
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("biometric_user_maps")
      .select("id")
      .eq("employee_id", employeeId)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ biometric_mapped: Boolean(data?.id) });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
