import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("employees")
      .select(
        "employee_id, full_name, position, employee_type, job_level, monthly_rate, per_day, assigned_hotel, is_active"
      )
      .eq("id", employeeId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      employee_id: data?.employee_id ?? null,
      full_name: data?.full_name ?? null,
      position: data?.position ?? null,
      employee_type: data?.employee_type ?? null,
      job_level: data?.job_level ?? null,
      monthly_rate:
        data?.monthly_rate != null ? Number(data.monthly_rate) : null,
      per_day: data?.per_day != null ? Number(data.per_day) : null,
      assigned_hotel: data?.assigned_hotel ?? null,
      is_active: data?.is_active ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
