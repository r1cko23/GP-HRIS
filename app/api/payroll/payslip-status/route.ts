/**
 * PATCH /api/payroll/payslip-status
 * Admin-only: transition payslip draft → paid (Phase 4 workflow gating).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["paid"],
};

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { payslip_id, status } = body as {
      payslip_id?: string;
      status?: string;
    };

    if (!payslip_id || !status) {
      return NextResponse.json(
        { error: "payslip_id and status are required" },
        { status: 400 }
      );
    }

    if (status !== "paid") {
      return NextResponse.json(
        { error: "Only marking payslips as paid is supported" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });

    const { data: existing, error: fetchError } = await supabase
      .from("payslips")
      .select("id, status, employee_id, period_start, period_end")
      .eq("id", payslip_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Cannot change payslip status from ${existing.status} to ${status}`,
        },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("payslips")
      .update({ status })
      .eq("id", payslip_id)
      .select("id, status, employee_id, period_start, period_end, net_pay")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ payslip: updated });
  } catch (error: unknown) {
    console.error("Payslip status PATCH error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update payslip status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
