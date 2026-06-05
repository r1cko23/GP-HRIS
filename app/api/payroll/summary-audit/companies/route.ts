/**
 * GET /api/payroll/summary-audit/companies — list active clients
 */

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import type { AuditCompany } from "@/lib/payroll-summary/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    const companies: AuditCompany[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
    }));

    return NextResponse.json({ companies });
  } catch (error: unknown) {
    console.error("Payroll audit companies GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load clients";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
