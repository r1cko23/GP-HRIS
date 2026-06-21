/**
 * Payroll Summary Audit API
 *
 * POST /api/payroll/summary-audit/upload — queue register PDF (async) or parse plantilla (sync)
 * GET  /api/payroll/summary-audit/upload — list uploads + trend data
 * DELETE /api/payroll/summary-audit/upload?id= — remove one upload
 * DELETE /api/payroll/summary-audit/upload?company_id=&clear_all=true — clear client history
 *
 * Background parsing: POST /api/payroll/summary-audit/process
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { assertPayrollSummaryFileName } from "@/lib/payroll-summary/detect-payroll-summary";
import {
  PAYROLL_AUDIT_STORAGE_BUCKET,
  rowToUploadRecord,
  storePayrollAuditPdf,
} from "@/lib/payroll-summary/process-register-upload";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  AuditDocumentType,
  PayrollSummaryUploadRecord,
  PlantillaMetrics,
} from "@/lib/payroll-summary/types";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const UPLOAD_SELECT =
  "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, parsed_json, status, error_message, rollup_gap_centavos, processed_at, storage_path";

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
    /Could not find totals row|Could not detect cutoff period|Unexpected .* column count|Payroll Summary PDF|Failed to parse payroll register|does not match register gross|does not match Salaries and Wages|No employees were parsed|Every centavo must tie out/i.test(
      message
    );

  return { message, status: isParseError ? 422 : 500 };
}

function metricsToRow(
  payload: PlantillaMetrics,
  uploadedBy: string,
  companyId: string,
  documentType: AuditDocumentType,
  fileName: string | null,
  fileBase64: string | null
) {
  const plantilla = payload;
  return {
      uploaded_by: uploadedBy,
      company_id: companyId,
      document_type: documentType,
      status: "ready",
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
      processed_at: new Date().toISOString(),
    };
}

function isReadyUpload(upload: PayrollSummaryUploadRecord): boolean {
  return (upload.status ?? "ready") === "ready" && Boolean(upload.periodStart);
}

function triggerBackgroundProcess(request: NextRequest, uploadId: string) {
  const processUrl = new URL(
    "/api/payroll/summary-audit/process",
    request.url
  );
  const cookie = request.headers.get("cookie");

  void fetch(processUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ upload_id: uploadId }),
  }).catch((error) => {
    console.error("Payroll audit background process trigger failed:", error);
  });
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
      .select(UPLOAD_SELECT)
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
      if (
        upload.documentType !== "payroll_register" ||
        !upload.periodStart ||
        !isReadyUpload(upload)
      ) {
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
    const admin = getAdminClient();
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

      const { data: storageRows } = await admin
        .from("payroll_summary_uploads")
        .select("storage_path")
        .eq("company_id", companyId)
        .not("storage_path", "is", null);

      const paths = (storageRows ?? [])
        .map((row) => row.storage_path as string | null)
        .filter((path): path is string => Boolean(path));

      if (paths.length > 0) {
        await admin.storage.from(PAYROLL_AUDIT_STORAGE_BUCKET).remove(paths);
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
      const { data: row } = await admin
        .from("payroll_summary_uploads")
        .select("storage_path")
        .eq("id", id)
        .maybeSingle();

      if (row?.storage_path) {
        await admin.storage
          .from(PAYROLL_AUDIT_STORAGE_BUCKET)
          .remove([row.storage_path as string]);
      }

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

    if (document_type === "plantilla") {
      const { parsePlantillaFile } = await import(
        "@/lib/payroll-summary/parse-plantilla"
      );
      const payload = await parsePlantillaFile(
        buffer,
        file_name ?? "plantilla.csv"
      );

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
        .select(UPLOAD_SELECT)
        .single();

      if (insertError) throw insertError;

      return NextResponse.json({
        upload: rowToUploadRecord(inserted),
        plantilla: payload,
        status: "ready",
      });
    }

    if (file_name) {
      assertPayrollSummaryFileName(file_name);
    }

    const { data: queued, error: queueError } = await supabase
      .from("payroll_summary_uploads")
      .insert({
        uploaded_by: authUser.userId,
        company_id,
        document_type: "payroll_register",
        status: "processing",
        source_file_name: file_name ?? null,
        source_format: "external_register",
        period_start: null,
        period_end: null,
        employee_count: 0,
        hours_worked_total: 0,
        reg_ot_hours_total: 0,
        sil_cutoff_total: 0,
        gross_amount_total: 0,
        net_amount_total: 0,
        parsed_json: {},
        file_base64: null,
      })
      .select(UPLOAD_SELECT)
      .single();

    if (queueError) throw queueError;

    const admin = getAdminClient();
    let storagePath: string | null = null;

    try {
      storagePath = await storePayrollAuditPdf(
        admin,
        company_id,
        String(queued.id),
        file_name ?? "register.pdf",
        buffer
      );

      const { error: pathError } = await admin
        .from("payroll_summary_uploads")
        .update({ storage_path: storagePath })
        .eq("id", queued.id);

      if (pathError) throw pathError;
    } catch (storageError) {
      await admin
        .from("payroll_summary_uploads")
        .update({
          file_base64,
          storage_path: null,
        })
        .eq("id", queued.id);

      console.warn(
        "Payroll audit storage upload failed; using DB fallback:",
        storageError
      );
    }

    const upload = rowToUploadRecord({
      ...queued,
      storage_path: storagePath,
    });

    triggerBackgroundProcess(request, String(queued.id));

    return NextResponse.json(
      {
        upload,
        upload_id: queued.id,
        status: "processing",
        message:
          "Upload received. Parsing and centavo validation will finish in the background.",
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error("Payroll summary audit POST error:", error);
    const { message, status } = formatUploadError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
