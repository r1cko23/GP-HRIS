/**
 * POST /api/payroll/summary-audit/upload — queue register PDF (async) or parse plantilla (sync).
 * Register uploads may omit company_id: client is resolved from the PDF (find-or-create).
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
import { findOrCreateAuditCompany } from "@/lib/payroll-summary/find-or-create-audit-company";
import { peekRegisterClientName } from "@/lib/payroll-summary/peek-register-client";
import {
  PAYROLL_AUDIT_STORAGE_BUCKET,
  rowToUploadRecord,
} from "@/lib/payroll-summary/process-register-upload";
import { queuePayrollRegisterUpload } from "@/lib/payroll-summary/queue-register-upload";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  AuditCompany,
  AuditDocumentType,
  PayrollSummaryUploadRecord,
  PlantillaMetrics,
} from "@/lib/payroll-summary/types";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** List/history: scalars only — omit heavy parsed_json / file_base64. */
const LIST_SELECT =
  "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, status, error_message, rollup_gap_centavos, processed_at, storage_path";

/** Detail / plantilla insert response: includes parsed_json for employees. */
const DETAIL_SELECT = `${LIST_SELECT}, parsed_json`;

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
  fileName: string | null
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
      file_base64: null,
      processed_at: new Date().toISOString(),
    };
}

function isReadyUpload(upload: PayrollSummaryUploadRecord): boolean {
  return (upload.status ?? "ready") === "ready" && Boolean(upload.periodStart);
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const id = request.nextUrl.searchParams.get("id");
    const companyId = request.nextUrl.searchParams.get("company_id");
    const documentType = request.nextUrl.searchParams.get("document_type");
    const periodStart = request.nextUrl.searchParams.get("period_start");
    const periodEnd = request.nextUrl.searchParams.get("period_end");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(Number(limitParam ?? 50) || 50, 200);

    if (id) {
      const { data, error } = await supabase
        .from("payroll_summary_uploads")
        .select(DETAIL_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: "Upload not found" }, { status: 404 });
      }
      return NextResponse.json({ upload: rowToUploadRecord(data) });
    }

    let query = supabase
      .from("payroll_summary_uploads")
      .select(LIST_SELECT)
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

    let trend = Array.from(latestByPeriod.values()).sort((a, b) =>
      a.periodStart.localeCompare(b.periodStart)
    );

    // Hydrate employees only for trend cutoffs (composition / period drilldown).
    if (trend.length > 0) {
      const trendIds = trend.map((t) => t.id);
      const { data: hydrated, error: hydrateError } = await supabase
        .from("payroll_summary_uploads")
        .select("id, parsed_json")
        .in("id", trendIds);
      if (hydrateError) throw hydrateError;

      const byId = new Map(
        (hydrated ?? []).map((row) => [String(row.id), row.parsed_json])
      );
      trend = trend.map((upload) => {
        const parsed = byId.get(upload.id) as
          | { employees?: PayrollSummaryUploadRecord["employees"] }
          | null
          | undefined;
        if (!parsed?.employees?.length) return upload;
        return { ...upload, employees: parsed.employees };
      });
    }

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
      company_id: companyIdInput,
      relative_path,
      document_type = "payroll_register",
    } = body as {
      file_name?: string;
      file_base64?: string;
      company_id?: string;
      relative_path?: string | null;
      document_type?: AuditDocumentType;
    };

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
      if (!companyIdInput) {
        return NextResponse.json(
          { error: "company_id is required for plantilla uploads" },
          { status: 400 }
        );
      }

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
            companyIdInput,
            document_type,
            file_name ?? null
          )
        )
        .select(DETAIL_SELECT)
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

    let company: AuditCompany;
    let clientCreated = false;
    let clientSource: "pdf" | "path" | "filename" | "provided" = "provided";

    if (companyIdInput) {
      const { data: existing, error: companyError } = await supabase
        .from("companies")
        .select("id, name, slug")
        .eq("id", companyIdInput)
        .eq("is_active", true)
        .maybeSingle();

      if (companyError) throw companyError;
      if (!existing) {
        return NextResponse.json(
          { error: "Client not found. Choose an active client or omit company_id to auto-create from the PDF." },
          { status: 404 }
        );
      }
      company = { id: existing.id, name: existing.name, slug: existing.slug };
    } else {
      const peek = await peekRegisterClientName({
        buffer,
        fileName: file_name ?? "register.pdf",
        relativePath: relative_path ?? null,
      });
      const ensured = await findOrCreateAuditCompany(supabase, peek.clientName);
      company = ensured.company;
      clientCreated = ensured.created;
      clientSource = peek.source;
    }

    const admin = getAdminClient();
    const upload = await queuePayrollRegisterUpload({
      supabase,
      admin,
      uploadedBy: authUser.userId,
      companyId: company.id,
      fileName: file_name ?? "register.pdf",
      buffer,
      fileBase64: file_base64,
      request,
    });

    return NextResponse.json(
      {
        upload,
        upload_id: upload.id,
        company,
        client_created: clientCreated,
        client_source: clientSource,
        status: "processing",
        message: clientCreated
          ? `Created client "${company.name}" and queued the register for parsing.`
          : `Queued under "${company.name}". Parsing and centavo validation will finish in the background.`,
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error("Payroll summary audit POST error:", error);
    const { message, status } = formatUploadError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
