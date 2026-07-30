import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { generatePayslipsForEmployees } from "@/lib/ph-payroll/bulk-payslip";

const GENERATOR_VERSION = "gp-payroll-run-generate-v1-bimonthly";

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
      .select("id, cutoff_start, cutoff_end, selected_employee_ids, status")
      .eq("id", payroll_run_id)
      .single();

    if (runErr) throw runErr;
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    if (run.status === "finalized") {
      return NextResponse.json(
        { error: "Payroll run is already finalized" },
        { status: 400 }
      );
    }

    const cutoffStart = String(run.cutoff_start);
    const periodStart = new Date(`${cutoffStart}T12:00:00`);

    let employeeIdsScope: string[] | null = null;
    if (
      Array.isArray(run.selected_employee_ids) &&
      run.selected_employee_ids.length > 0
    ) {
      employeeIdsScope = run.selected_employee_ids.map((x: unknown) => String(x));
    }

    let empQuery = admin
      .from("employees")
      .select(
        "id, employee_id, full_name, monthly_rate, per_day, employee_type, position, job_level"
      )
      .eq("is_active", true);

    if (employeeIdsScope?.length) {
      empQuery = empQuery.in("id", employeeIdsScope);
    }

    const { data: employees, error: empErr } = await empQuery;
    if (empErr) throw empErr;

    if (!employees?.length) {
      return NextResponse.json(
        { error: "No employees in scope for this payroll run" },
        { status: 400 }
      );
    }

    await admin.from("payslips").delete().eq("payroll_run_id", payroll_run_id);

    const results = await generatePayslipsForEmployees(
      admin,
      employees,
      periodStart,
      { overwrite: true, payrollRunId: payroll_run_id }
    );

    const generated = results.filter(
      (r) => r.status === "created" || r.status === "updated"
    ).length;
    const skipped = results.filter((r) => r.status === "skipped");

    if (generated === 0) {
      return NextResponse.json(
        {
          error: "No payslips generated. Finalize timesheets and fix blockers first.",
          skipped,
          generator_version: GENERATOR_VERSION,
        },
        { status: 400 }
      );
    }

    await admin
      .from("payroll_runs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", payroll_run_id);

    return NextResponse.json({
      success: true,
      payroll_run_id,
      generator_version: GENERATOR_VERSION,
      generated,
      skipped,
      results,
    });
  } catch (error: unknown) {
    console.error("payroll-runs generate error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate payslips";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
