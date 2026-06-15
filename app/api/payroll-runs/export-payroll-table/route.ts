import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { buildGpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const payroll_run_id = body?.payroll_run_id as string | undefined;
    if (!payroll_run_id) {
      return NextResponse.json(
        { error: "payroll_run_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("id, cutoff_start, cutoff_end, status")
      .eq("id", payroll_run_id)
      .single();

    if (runErr) throw runErr;
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }
    if (String(run.status) !== "finalized") {
      return NextResponse.json(
        { error: "Finalize the payroll run before exporting." },
        { status: 400 }
      );
    }

    const { data: slips, error: slipsErr } = await admin
      .from("payslips")
      .select(
        "gross_pay, total_deductions, net_pay, adjustment_amount, sss_amount, philhealth_amount, pagibig_amount, deductions_breakdown, employees:employee_id ( employee_id, full_name, position )"
      )
      .eq("payroll_run_id", payroll_run_id)
      .order("created_at", { ascending: true });

    if (slipsErr) throw slipsErr;

    const table = buildGpPayrollRegisterTable({
      cutoffStart: String(run.cutoff_start),
      cutoffEnd: String(run.cutoff_end),
      slips: (slips || []) as Parameters<
        typeof buildGpPayrollRegisterTable
      >[0]["slips"],
    });

    return NextResponse.json({ success: true, table });
  } catch (error: unknown) {
    console.error("export-payroll-table error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to export payroll table";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
