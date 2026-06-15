/**
 * GET  /api/payroll/summary-audit/client-employees?company_id=
 * POST /api/payroll/summary-audit/client-employees — register from uploads
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { normalizeEmployeeName } from "@/lib/payroll-summary/normalize-name";
import type {
  PayrollAuditClientEmployee,
  PayrollSummaryMetrics,
  PlantillaMetrics,
} from "@/lib/payroll-summary/types";

export const runtime = "nodejs";

function rowToClientEmployee(row: Record<string, unknown>): PayrollAuditClientEmployee {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    displayName: String(row.display_name),
    normalizedName: String(row.normalized_name),
    dailyRate: row.daily_rate != null ? Number(row.daily_rate) : null,
    position: (row.position as string | null) ?? null,
    hoursWorked: row.hours_worked != null ? Number(row.hours_worked) : null,
    grossAmount: row.gross_amount != null ? Number(row.gross_amount) : null,
    netAmount: row.net_amount != null ? Number(row.net_amount) : null,
    silCutoff: row.sil_cutoff != null ? Number(row.sil_cutoff) : null,
    plantillaUploadId: (row.plantilla_upload_id as string | null) ?? null,
    registerUploadId: (row.register_upload_id as string | null) ?? null,
    registeredAt: String(row.registered_at),
    updatedAt: String(row.updated_at),
  };
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = request.nextUrl.searchParams.get("company_id");
    if (!companyId) {
      return NextResponse.json(
        { error: "company_id is required" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    const { data, error } = await supabase
      .from("payroll_audit_client_employees")
      .select("*")
      .eq("company_id", companyId)
      .order("display_name");

    if (error) throw error;

    return NextResponse.json({
      employees: (data ?? []).map((row) => rowToClientEmployee(row)),
    });
  } catch (error: unknown) {
    console.error("Payroll audit client employees GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load employees";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      company_id,
      plantilla_upload_id,
      register_upload_id,
    } = body as {
      company_id?: string;
      plantilla_upload_id?: string;
      register_upload_id?: string;
    };

    if (!company_id) {
      return NextResponse.json(
        { error: "company_id is required" },
        { status: 400 }
      );
    }

    if (!plantilla_upload_id && !register_upload_id) {
      return NextResponse.json(
        { error: "Provide at least one upload id (plantilla or register)" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });

    let plantillaMetrics: PlantillaMetrics | null = null;
    let registerMetrics: PayrollSummaryMetrics | null = null;

    if (plantilla_upload_id) {
      const { data, error } = await supabase
        .from("payroll_summary_uploads")
        .select("parsed_json, document_type, company_id")
        .eq("id", plantilla_upload_id)
        .single();
      if (error) throw error;
      if (data.company_id !== company_id) {
        return NextResponse.json(
          { error: "Plantilla upload does not belong to this client" },
          { status: 400 }
        );
      }
      plantillaMetrics = data.parsed_json as PlantillaMetrics;
    }

    if (register_upload_id) {
      const { data, error } = await supabase
        .from("payroll_summary_uploads")
        .select("parsed_json, document_type, company_id")
        .eq("id", register_upload_id)
        .single();
      if (error) throw error;
      if (data.company_id !== company_id) {
        return NextResponse.json(
          { error: "Register upload does not belong to this client" },
          { status: 400 }
        );
      }
      registerMetrics = data.parsed_json as PayrollSummaryMetrics;
    }

    type MergeRow = {
      display_name: string;
      normalized_name: string;
      daily_rate: number | null;
      position: string | null;
      hours_worked: number | null;
      gross_amount: number | null;
      net_amount: number | null;
      sil_cutoff: number | null;
      plantilla_upload_id: string | null;
      register_upload_id: string | null;
      company_id: string;
      updated_at: string;
    };

    const merged = new Map<string, MergeRow>();

    if (plantillaMetrics?.employees) {
      for (const emp of plantillaMetrics.employees) {
        const key = normalizeEmployeeName(emp.name);
        merged.set(key, {
          company_id,
          display_name: emp.name.trim(),
          normalized_name: key,
          daily_rate: emp.dailyRate ?? null,
          position: emp.position ?? null,
          hours_worked: null,
          gross_amount: null,
          net_amount: null,
          sil_cutoff: null,
          plantilla_upload_id: plantilla_upload_id ?? null,
          register_upload_id: null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (registerMetrics?.employees) {
      for (const emp of registerMetrics.employees) {
        const key = normalizeEmployeeName(emp.name);
        const existing = merged.get(key);
        merged.set(key, {
          company_id,
          display_name: existing?.display_name ?? emp.name.trim(),
          normalized_name: key,
          daily_rate: existing?.daily_rate ?? null,
          position: existing?.position ?? null,
          hours_worked: emp.hoursWorked,
          gross_amount: emp.grossAmount,
          net_amount: emp.netAmount,
          sil_cutoff: emp.silCutoff,
          plantilla_upload_id:
            existing?.plantilla_upload_id ?? plantilla_upload_id ?? null,
          register_upload_id: register_upload_id ?? null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    const rows = Array.from(merged.values());
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No employees found in the selected uploads" },
        { status: 400 }
      );
    }

    const { data: upserted, error: upsertError } = await supabase
      .from("payroll_audit_client_employees")
      .upsert(rows, { onConflict: "company_id,normalized_name" })
      .select("*");

    if (upsertError) throw upsertError;

    return NextResponse.json({
      registered: (upserted ?? []).length,
      employees: (upserted ?? []).map((row) => rowToClientEmployee(row)),
    });
  } catch (error: unknown) {
    console.error("Payroll audit client employees POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to register employees";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
