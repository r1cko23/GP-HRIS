import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Finalize payroll run and release payslips to employees (status paid). */
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
      .select("id, status")
      .eq("id", payroll_run_id)
      .single();

    if (runErr) throw runErr;
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    if (run.status === "finalized") {
      return NextResponse.json({ success: true, already_finalized: true });
    }

    if (run.status !== "processing") {
      return NextResponse.json(
        { error: "Generate payslips before finalizing this run" },
        { status: 400 }
      );
    }

    const { error: runUpdateErr } = await admin
      .from("payroll_runs")
      .update({ status: "finalized", updated_at: new Date().toISOString() })
      .eq("id", payroll_run_id);

    if (runUpdateErr) throw runUpdateErr;

    await admin
      .from("payslips")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("payroll_run_id", payroll_run_id)
      .eq("status", "draft");

    return NextResponse.json({ success: true, payroll_run_id });
  } catch (error: unknown) {
    console.error("payroll-runs finalize error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to finalize payroll run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
