import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { validatePayrollRun } from "@/lib/payroll-runs/validate-payroll-run";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payrollRunId = request.nextUrl.searchParams.get("payroll_run_id");
    if (!payrollRunId) {
      return NextResponse.json(
        { error: "payroll_run_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("id, cutoff_start, cutoff_end, selected_employee_ids, status")
      .eq("id", payrollRunId)
      .single();

    if (runErr) throw runErr;
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const scopeIds = Array.isArray(run.selected_employee_ids)
      ? (run.selected_employee_ids as string[])
      : null;

    const summary = await validatePayrollRun(admin, {
      id: run.id,
      cutoff_start: String(run.cutoff_start),
      cutoff_end: String(run.cutoff_end),
      selected_employee_ids: scopeIds,
      status: String(run.status),
    });

    return NextResponse.json(summary);
  } catch (error: unknown) {
    console.error("payroll-runs validate error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to validate payroll run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
