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

/** Employee portal: released payslips only (paid / approved). */
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

    const { data: emp, error: empError } = await admin
      .from("employees")
      .select("id, is_active")
      .eq("id", employeeId)
      .maybeSingle();

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }
    if (!emp?.is_active) {
      return NextResponse.json({ payslips: [] });
    }

    const { data, error } = await admin
      .from("payslips")
      .select("*")
      .eq("employee_id", employeeId)
      .in("status", ["paid", "approved"])
      .order("period_start", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (data || []).map((row) => {
      const periodStart = String(row.period_start || row.created_at).split(
        "T"
      )[0];
      const periodEnd = String(row.period_end || row.created_at).split("T")[0];
      const deductions = (row.deductions_breakdown || {}) as Record<
        string,
        unknown
      >;

      return {
        ...row,
        payslip_number: row.payslip_number || row.id,
        period_start: periodStart,
        period_end: periodEnd,
        gross_pay: Number(row.gross_pay || 0),
        net_pay: Number(row.net_pay || 0),
        sss_amount: Number(row.sss_amount || 0),
        philhealth_amount: Number(row.philhealth_amount || 0),
        pagibig_amount: Number(row.pagibig_amount || 0),
        withholding_tax: Number(deductions.withholding_tax || 0),
        total_deductions: Number(row.total_deductions || 0),
        adjustment_amount: Number(row.adjustment_amount || 0),
        earnings_breakdown: row.earnings_breakdown || {},
        deductions_breakdown: row.deductions_breakdown || {},
      };
    });

    return NextResponse.json({ payslips: normalized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
