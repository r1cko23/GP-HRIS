/**
 * Payroll Summary Audit API
 *
 * POST /api/payroll/summary-audit/upload — parse file, store metrics, return diff
 * GET  /api/payroll/summary-audit/upload — list uploads + trend data
 * DELETE /api/payroll/summary-audit/upload?id= — remove one upload
 * DELETE /api/payroll/summary-audit/upload?company_id=&clear_all=true — clear client history
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { diffPayrollSummary } from "@/lib/payroll-summary/diff-payroll-summary";
import { diffPayrollEmployees } from "@/lib/payroll-summary/diff-payroll-employees";
import { upsertClientEmployeesFromRegister } from "@/lib/payroll-summary/register-client-employees";
import { parsePayrollRegisterPdfResult } from "@/lib/payroll-summary/parse-payroll-register-pdf";
import { assertPayrollSummaryFileName } from "@/lib/payroll-summary/detect-payroll-summary";
import type {
  AuditDocumentType,
  AuditUploadAnomalies,
  PayrollSummaryMetrics,
  PayrollSummaryUploadRecord,
  PlantillaMetrics,
} from "@/lib/payroll-summary/types";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type ParsedPayload = PayrollSummaryMetrics | PlantillaMetrics;

function formatUploadError(error: unknown): { message: string; status: number } {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code ?? "")
      : "";

  if (code === "23503") {
    return {
      message:
        "Your login is not linked to a user profile in GP-HRIS. Ask an admin to verify your account.",
      status: 500,
    };
  }
  if (code === "42501") {
    return {
      message: "You do not have permission to save this upload.",
      status: 403,
    };
  }

  const message =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Failed to process upload";

  const isParseError =
    /Could not find totals row|Could not detect cutoff period|Unexpected .* column count|Payroll Summary PDF|Failed to parse payroll register/i.test(
      message
    );

  return { message, status: isParseError ? 422 : 500 };
}

function metricsToRow(
  payload: ParsedPayload,
  uploadedBy: string,
  companyId: string,
  documentType: AuditDocumentType,
  fileName: string | null,
  fileBase64: string | null
) {
  if (documentType === "plantilla") {
    const plantilla = payload as PlantillaMetrics;
    return {
      uploaded_by: uploadedBy,
      company_id: companyId,
      document_type: documentType,
      period_start: null,
      period_end: null,
      source_file_name: fileName,
      source_format: plantilla.sourceFormat,
      company_name: null,
      payout_date: null,
      employee_count: plantilla.employeeCount,
      hours_worked_total: 0,
      reg_ot_hours_total: 0,
      total_ot_amount: null,
      sil_total: null,
      sil_cutoff_total: 0,
      gross_amount_total: 0,
      net_amount_total: 0,
      parsed_json: plantilla,
      file_base64: fileBase64,
    };
  }

  const metrics = payload as PayrollSummaryMetrics;
  return {
    uploaded_by: uploadedBy,
    company_id: companyId,
    document_type: documentType,
    period_start: metrics.periodStart,
    period_end: metrics.periodEnd,
    source_file_name: fileName,
    source_format: metrics.sourceFormat,
    company_name: metrics.companyName,
    payout_date: metrics.payoutDate,
    employee_count: metrics.employeeCount,
    hours_worked_total: metrics.hoursWorkedTotal,
    reg_ot_hours_total: metrics.regOTHoursTotal,
    total_ot_amount: metrics.totalOTAmount,
    sil_total: metrics.silTotal,
    sil_cutoff_total: metrics.silCutoffTotal,
    gross_amount_total: metrics.grossAmountTotal,
    net_amount_total: metrics.netAmountTotal,
    parsed_json: metrics,
    file_base64: fileBase64,
  };
}

function rowToMetrics(row: Record<string, unknown>): PayrollSummaryMetrics {
  const parsed =
    (row.parsed_json as PayrollSummaryMetrics | null) ??
    ({} as PayrollSummaryMetrics);

  return {
    periodStart: String(row.period_start ?? parsed.periodStart ?? ""),
    periodEnd: String(row.period_end ?? parsed.periodEnd ?? ""),
    employeeCount: Number(row.employee_count ?? parsed.employeeCount ?? 0),
    hoursWorkedTotal: Number(
      row.hours_worked_total ?? parsed.hoursWorkedTotal ?? 0
    ),
    regOTHoursTotal: Number(
      row.reg_ot_hours_total ?? parsed.regOTHoursTotal ?? 0
    ),
    silTotal:
      row.sil_total != null
        ? Number(row.sil_total)
        : (parsed.silTotal ?? null),
    silCutoffTotal: Number(
      row.sil_cutoff_total ?? parsed.silCutoffTotal ?? 0
    ),
    grossAmountTotal: Number(
      row.gross_amount_total ?? parsed.grossAmountTotal ?? 0
    ),
    netAmountTotal: Number(row.net_amount_total ?? parsed.netAmountTotal ?? 0),
    totalOTAmount:
      row.total_ot_amount != null
        ? Number(row.total_ot_amount)
        : (parsed.totalOTAmount ?? null),
    companyName:
      (row.company_name as string | null) ?? parsed.companyName ?? null,
    payoutDate:
      (row.payout_date as string | null) ?? parsed.payoutDate ?? null,
    sourceFormat:
      (row.source_format as PayrollSummaryMetrics["sourceFormat"]) ??
      parsed.sourceFormat ??
      "external_register",
    employees: parsed.employees ?? [],
  };
}

function rowToUploadRecord(row: Record<string, unknown>): PayrollSummaryUploadRecord {
  return {
    ...rowToMetrics(row),
    id: String(row.id),
    uploadedAt: String(row.uploaded_at),
    uploadedBy: String(row.uploaded_by),
    sourceFileName: (row.source_file_name as string | null) ?? null,
    companyId: (row.company_id as string | null) ?? null,
    documentType:
      (row.document_type as AuditDocumentType) ?? "payroll_register",
  };
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const companyId = request.nextUrl.searchParams.get("company_id");
    const documentType = request.nextUrl.searchParams.get("document_type");
    const periodStart = request.nextUrl.searchParams.get("period_start");
    const periodEnd = request.nextUrl.searchParams.get("period_end");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(Number(limitParam ?? 50) || 50, 200);

    let query = supabase
      .from("payroll_summary_uploads")
      .select(
        "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, parsed_json"
      )
      .order("uploaded_at", { ascending: false })
      .limit(limit);

    if (companyId) query = query.eq("company_id", companyId);
    if (documentType) query = query.eq("document_type", documentType);
    if (periodStart) query = query.eq("period_start", periodStart);
    if (periodEnd) query = query.eq("period_end", periodEnd);

    const { data, error } = await query;
    if (error) throw error;

    const uploads = (data ?? []).map((row) => rowToUploadRecord(row));

    const latestByPeriod = new Map<string, PayrollSummaryUploadRecord>();
    for (const upload of uploads) {
      if (upload.documentType !== "payroll_register" || !upload.periodStart) {
        continue;
      }
      const key = `${upload.periodStart}|${upload.periodEnd}`;
      if (!latestByPeriod.has(key)) {
        latestByPeriod.set(key, upload);
      }
    }

    const trend = Array.from(latestByPeriod.values()).sort((a, b) =>
      a.periodStart.localeCompare(b.periodStart)
    );

    return NextResponse.json({ uploads, trend });
  } catch (error: unknown) {
    console.error("Payroll summary audit GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load audit data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const id = request.nextUrl.searchParams.get("id");
    const companyId = request.nextUrl.searchParams.get("company_id");
    const clearAll = request.nextUrl.searchParams.get("clear_all") === "true";

    if (clearAll) {
      if (!companyId) {
        return NextResponse.json(
          { error: "company_id is required when clear_all=true" },
          { status: 400 }
        );
      }

      const { error: employeesError } = await supabase
        .from("payroll_audit_client_employees")
        .delete()
        .eq("company_id", companyId);
      if (employeesError) throw employeesError;

      const { data, error: uploadsError } = await supabase
        .from("payroll_summary_uploads")
        .delete()
        .eq("company_id", companyId)
        .select("id");
      if (uploadsError) throw uploadsError;

      return NextResponse.json({
        deletedCount: data?.length ?? 0,
        clearedEmployees: true,
      });
    }

    if (id) {
      const { error } = await supabase
        .from("payroll_summary_uploads")
        .delete()
        .eq("id", id);
      if (error) throw error;

      return NextResponse.json({ deleted: id });
    }

    return NextResponse.json(
      { error: "Provide id or company_id with clear_all=true" },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("Payroll summary audit DELETE error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete upload";
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
      file_name,
      file_base64,
      company_id,
      document_type = "payroll_register",
    } = body as {
      file_name?: string;
      file_base64?: string;
      company_id?: string;
      document_type?: AuditDocumentType;
    };

    if (!company_id) {
      return NextResponse.json(
        { error: "company_id is required — select a client first" },
        { status: 400 }
      );
    }

    if (!file_base64) {
      return NextResponse.json(
        { error: "file_base64 is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(file_base64, "base64");
    if (buffer.length > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id")
      .eq("id", authUser.userId)
      .eq("is_active", true)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Your admin account is missing an active user profile. Contact IT before uploading.",
        },
        { status: 500 }
      );
    }

    let payload: ParsedPayload;
    let pdfExtraction: {
      source: "pdf-parse" | "ocr-space";
      nativeScore: number;
      ocrScore: number | null;
      ocrConfigured: boolean;
    } | null = null;

    if (document_type === "plantilla") {
      const { parsePlantillaFile } = await import(
        "@/lib/payroll-summary/parse-plantilla"
      );
      payload = await parsePlantillaFile(buffer, file_name ?? "plantilla.csv");
    } else {
      if (file_name) {
        assertPayrollSummaryFileName(file_name);
      }
      try {
        const parsed = await parsePayrollRegisterPdfResult(buffer);
        payload = parsed.metrics;
        pdfExtraction = {
          source: parsed.pdfTextSource,
          nativeScore: parsed.nativeScore,
          ocrScore: parsed.ocrScore,
          ocrConfigured: parsed.ocrConfigured,
        };
      } catch (parseError) {
        const { message, status } = formatUploadError(parseError);
        return NextResponse.json({ error: message }, { status });
      }
    }

    let previousSamePeriod: PayrollSummaryMetrics | null = null;
    let previousAnyRegister: PayrollSummaryMetrics | null = null;

    if (document_type === "payroll_register") {
      const metrics = payload as PayrollSummaryMetrics;

      const [{ data: samePeriodRows }, { data: priorRegisterRows }] =
        await Promise.all([
          supabase
            .from("payroll_summary_uploads")
            .select(
              "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, parsed_json"
            )
            .eq("company_id", company_id)
            .eq("document_type", "payroll_register")
            .eq("period_start", metrics.periodStart)
            .eq("period_end", metrics.periodEnd)
            .order("uploaded_at", { ascending: false })
            .limit(1),
          supabase
            .from("payroll_summary_uploads")
            .select(
              "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, parsed_json"
            )
            .eq("company_id", company_id)
            .eq("document_type", "payroll_register")
            .order("uploaded_at", { ascending: false })
            .limit(1),
        ]);

      previousSamePeriod =
        samePeriodRows && samePeriodRows.length > 0
          ? rowToMetrics(samePeriodRows[0])
          : null;

      previousAnyRegister =
        priorRegisterRows && priorRegisterRows.length > 0
          ? rowToMetrics(priorRegisterRows[0])
          : null;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("payroll_summary_uploads")
      .insert(
        metricsToRow(
          payload,
          authUser.userId,
          company_id,
          document_type,
          file_name ?? null,
          file_base64
        )
      )
      .select(
        "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, parsed_json"
      )
      .single();

    if (insertError) throw insertError;

    const upload = rowToUploadRecord(inserted);
    const metrics = payload as PayrollSummaryMetrics;

    let diff = null;
    let anomalies: AuditUploadAnomalies | null = null;
    let registeredEmployees: unknown[] = [];

    if (document_type === "payroll_register") {
      diff = diffPayrollSummary(metrics, previousSamePeriod);

      const vsLastBaseline =
        previousAnyRegister &&
        previousSamePeriod &&
        previousAnyRegister.periodStart === previousSamePeriod.periodStart &&
        previousAnyRegister.periodEnd === previousSamePeriod.periodEnd
          ? null
          : previousAnyRegister;

      anomalies = {
        samePeriod: diffPayrollEmployees(metrics, previousSamePeriod),
        vsLastRegister: diffPayrollEmployees(metrics, vsLastBaseline),
      };

      registeredEmployees = await upsertClientEmployeesFromRegister(
        supabase,
        company_id,
        metrics,
        String(inserted.id)
      );
    }

    return NextResponse.json({
      upload,
      metrics: document_type === "payroll_register" ? metrics : null,
      plantilla: document_type === "plantilla" ? payload : null,
      previous: previousSamePeriod,
      diff,
      anomalies,
      registeredCount: registeredEmployees.length,
      pdfExtraction,
    });
  } catch (error: unknown) {
    console.error("Payroll summary audit POST error:", error);
    const { message, status } = formatUploadError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
