import type { SupabaseClient } from "@supabase/supabase-js";
import { diffPayrollSummary } from "./diff-payroll-summary";
import { diffPayrollEmployees } from "./diff-payroll-employees";
import { parsePayrollRegisterPdfResult } from "./parse-payroll-register-pdf";
import { upsertClientEmployeesFromRegister } from "./register-client-employees";
import { validateParsedRegisterMetrics } from "./validate-parsed-register";
import type {
  AuditUploadAnomalies,
  PayrollSummaryDiff,
  PayrollSummaryMetrics,
  PayrollSummaryUploadRecord,
} from "./types";

export const PAYROLL_AUDIT_STORAGE_BUCKET = "payroll-audit-files";

export type PayrollAuditUploadStatus = "processing" | "ready" | "failed";

export interface ProcessRegisterUploadResult {
  upload: PayrollSummaryUploadRecord;
  metrics: PayrollSummaryMetrics;
  previous: PayrollSummaryMetrics | null;
  diff: PayrollSummaryDiff;
  anomalies: AuditUploadAnomalies;
  registeredCount: number;
  pdfExtraction: {
    source: "pdf-parse" | "ocr-space";
    nativeScore: number;
    ocrScore: number | null;
    ocrConfigured: boolean;
  };
  status: "ready";
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

export function rowToUploadRecord(row: Record<string, unknown>): PayrollSummaryUploadRecord {
  return {
    ...rowToMetrics(row),
    id: String(row.id),
    uploadedAt: String(row.uploaded_at),
    uploadedBy: String(row.uploaded_by),
    sourceFileName: (row.source_file_name as string | null) ?? null,
    companyId: (row.company_id as string | null) ?? null,
    documentType:
      (row.document_type as PayrollSummaryUploadRecord["documentType"]) ??
      "payroll_register",
    status: (row.status as PayrollAuditUploadStatus) ?? "ready",
    errorMessage: (row.error_message as string | null) ?? null,
    rollupGapCentavos:
      row.rollup_gap_centavos != null
        ? Number(row.rollup_gap_centavos)
        : null,
    processedAt: (row.processed_at as string | null) ?? null,
    storagePath: (row.storage_path as string | null) ?? null,
  };
}

async function loadUploadPdfBuffer(
  admin: SupabaseClient,
  row: Record<string, unknown>
): Promise<Buffer> {
  const storagePath = row.storage_path as string | null;
  if (storagePath) {
    const { data, error } = await admin.storage
      .from(PAYROLL_AUDIT_STORAGE_BUCKET)
      .download(storagePath);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  const base64 = row.file_base64 as string | null;
  if (base64) {
    return Buffer.from(base64, "base64");
  }

  throw new Error("Upload file is missing from storage. Re-upload the PDF.");
}

function metricsToUpdateRow(metrics: PayrollSummaryMetrics) {
  return {
    period_start: metrics.periodStart,
    period_end: metrics.periodEnd,
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
    status: "ready" as const,
    error_message: null,
    rollup_gap_centavos: 0,
    processed_at: new Date().toISOString(),
    file_base64: null,
  };
}

const UPLOAD_SELECT =
  "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, parsed_json, status, error_message, rollup_gap_centavos, processed_at, storage_path, file_base64, processing_started_at";

interface UploadRowForCleanup extends Record<string, unknown> {
  id: string;
  uploaded_at?: string;
  storage_path?: string | null;
}

export function newestUploadAndDuplicates<T extends UploadRowForCleanup>(
  rows: T[]
): { newest: T | null; duplicates: T[] } {
  const sorted = [...rows].sort((a, b) => {
    const byDate = String(b.uploaded_at ?? "").localeCompare(
      String(a.uploaded_at ?? "")
    );
    return byDate || String(b.id).localeCompare(String(a.id));
  });
  return {
    newest: sorted[0] ?? null,
    duplicates: sorted.slice(1),
  };
}

async function deleteUploadRows(
  admin: SupabaseClient,
  rows: UploadRowForCleanup[]
): Promise<void> {
  if (!rows.length) return;

  const storagePaths = rows
    .map((row) => row.storage_path)
    .filter((value): value is string => Boolean(value));
  if (storagePaths.length) {
    const { error: storageError } = await admin.storage
      .from(PAYROLL_AUDIT_STORAGE_BUCKET)
      .remove(storagePaths);
    if (storageError) {
      // The DB rows still need removing so duplicates/failures are not retained.
      console.error("Payroll audit storage cleanup failed:", storageError);
    }
  }

  const ids = rows.map((row) => String(row.id));
  const { error: deleteError } = await admin
    .from("payroll_summary_uploads")
    .delete()
    .in("id", ids);
  if (deleteError) throw deleteError;
}

export async function processRegisterUpload(
  admin: SupabaseClient,
  uploadId: string,
  options: { allowRetryFailed?: boolean } = {}
): Promise<ProcessRegisterUploadResult | { status: "processing" }> {
  const { data: row, error: rowError } = await admin
    .from("payroll_summary_uploads")
    .select(UPLOAD_SELECT)
    .eq("id", uploadId)
    .maybeSingle();

  if (rowError) throw rowError;
  if (!row) throw new Error("Upload not found");

  const status = row.status as PayrollAuditUploadStatus;
  if (status === "ready") {
    return buildResultFromRow(admin, row);
  }

  if (status === "failed" && !options.allowRetryFailed) {
    throw new Error(
      (row.error_message as string | null) ??
        "This upload failed processing. Delete it and upload again."
    );
  }

  if (status === "failed" && options.allowRetryFailed) {
    await admin
      .from("payroll_summary_uploads")
      .update({
        status: "processing",
        processing_started_at: null,
        error_message: null,
        rollup_gap_centavos: null,
        processed_at: null,
      })
      .eq("id", uploadId)
      .eq("status", "failed");
  }

  const { data: locked, error: lockError } = await admin
    .from("payroll_summary_uploads")
    .update({
      processing_started_at: new Date().toISOString(),
      status: "processing",
      error_message: null,
      rollup_gap_centavos: null,
    })
    .eq("id", uploadId)
    .eq("status", "processing")
    .is("processing_started_at", null)
    .select(UPLOAD_SELECT)
    .maybeSingle();

  if (lockError) throw lockError;

  if (!locked) {
    const { data: current } = await admin
      .from("payroll_summary_uploads")
      .select("status")
      .eq("id", uploadId)
      .maybeSingle();

    if (current?.status === "ready") {
      const { data: readyRow } = await admin
        .from("payroll_summary_uploads")
        .select(UPLOAD_SELECT)
        .eq("id", uploadId)
        .single();
      return buildResultFromRow(admin, readyRow!);
    }

    return { status: "processing" };
  }

  let uploadAccepted = false;
  try {
    const buffer = await loadUploadPdfBuffer(admin, locked);
    const parsed = await parsePayrollRegisterPdfResult(buffer);
    const metrics = parsed.metrics;

    validateParsedRegisterMetrics(metrics, {
      requireExactCentavos: true,
      pdfText: parsed.pdfText,
    });

    const companyId = String(locked.company_id);
    const [{ data: samePeriodRows }, { data: priorRegisterRows }] =
      await Promise.all([
        admin
          .from("payroll_summary_uploads")
          .select(UPLOAD_SELECT)
          .eq("company_id", companyId)
          .eq("document_type", "payroll_register")
          .eq("status", "ready")
          .eq("period_start", metrics.periodStart)
          .eq("period_end", metrics.periodEnd)
          .neq("id", uploadId)
          .order("uploaded_at", { ascending: false })
          .limit(1),
        admin
          .from("payroll_summary_uploads")
          .select(UPLOAD_SELECT)
          .eq("company_id", companyId)
          .eq("document_type", "payroll_register")
          .eq("status", "ready")
          .neq("id", uploadId)
          .order("uploaded_at", { ascending: false })
          .limit(1),
      ]);

    const previousSamePeriod =
      samePeriodRows && samePeriodRows.length > 0
        ? rowToMetrics(samePeriodRows[0])
        : null;

    const previousAnyRegister =
      priorRegisterRows && priorRegisterRows.length > 0
        ? rowToMetrics(priorRegisterRows[0])
        : null;

    const { data: updated, error: updateError } = await admin
      .from("payroll_summary_uploads")
      .update(metricsToUpdateRow(metrics))
      .eq("id", uploadId)
      .select(UPLOAD_SELECT)
      .single();

    if (updateError) throw updateError;
    uploadAccepted = true;

    const { data: readySamePeriodRows, error: duplicateLookupError } =
      await admin
        .from("payroll_summary_uploads")
        .select(UPLOAD_SELECT)
        .eq("company_id", companyId)
        .eq("document_type", "payroll_register")
        .eq("status", "ready")
        .eq("period_start", metrics.periodStart)
        .eq("period_end", metrics.periodEnd);
    if (duplicateLookupError) throw duplicateLookupError;

    const { newest, duplicates } = newestUploadAndDuplicates(
      (readySamePeriodRows ?? []) as UploadRowForCleanup[]
    );

    // A newer upload for this same cutoff won the race. Remove this stale row
    // without letting it overwrite the surviving upload's employee snapshot.
    if (newest && String(newest.id) !== uploadId) {
      await deleteUploadRows(admin, duplicates);
      return buildResultFromRow(admin, newest);
    }

    const registeredEmployees = await upsertClientEmployeesFromRegister(
      admin,
      companyId,
      metrics,
      uploadId
    );
    await deleteUploadRows(admin, duplicates);

    const diff = diffPayrollSummary(metrics, previousSamePeriod);
    const vsLastBaseline =
      previousAnyRegister &&
      previousSamePeriod &&
      previousAnyRegister.periodStart === previousSamePeriod.periodStart &&
      previousAnyRegister.periodEnd === previousSamePeriod.periodEnd
        ? null
        : previousAnyRegister;

    return {
      upload: rowToUploadRecord(updated),
      metrics,
      previous: previousSamePeriod,
      diff,
      anomalies: {
        samePeriod: diffPayrollEmployees(metrics, previousSamePeriod),
        vsLastRegister: diffPayrollEmployees(metrics, vsLastBaseline),
      },
      registeredCount: registeredEmployees.length,
      pdfExtraction: {
        source: parsed.pdfTextSource,
        nativeScore: parsed.nativeScore,
        ocrScore: parsed.ocrScore,
        ocrConfigured: parsed.ocrConfigured,
      },
      status: "ready",
    };
  } catch (error) {
    if (!uploadAccepted) {
      try {
        await deleteUploadRows(admin, [
          locked as unknown as UploadRowForCleanup,
        ]);
      } catch (cleanupError) {
        console.error("Failed to remove rejected payroll upload:", cleanupError);
        const message =
          error instanceof Error ? error.message : "Failed to process upload";
        await admin
          .from("payroll_summary_uploads")
          .update({
            status: "failed",
            error_message: message,
            processed_at: new Date().toISOString(),
          })
          .eq("id", uploadId);
      }
    }

    throw error;
  }
}

async function buildResultFromRow(
  admin: SupabaseClient,
  row: Record<string, unknown>
): Promise<ProcessRegisterUploadResult> {
  const metrics = rowToMetrics(row);
  const companyId = String(row.company_id);

  const [{ data: samePeriodRows }, { data: priorRegisterRows }] =
    await Promise.all([
      admin
        .from("payroll_summary_uploads")
        .select(UPLOAD_SELECT)
        .eq("company_id", companyId)
        .eq("document_type", "payroll_register")
        .eq("status", "ready")
        .eq("period_start", metrics.periodStart)
        .eq("period_end", metrics.periodEnd)
        .neq("id", row.id)
        .order("uploaded_at", { ascending: false })
        .limit(1),
      admin
        .from("payroll_summary_uploads")
        .select(UPLOAD_SELECT)
        .eq("company_id", companyId)
        .eq("document_type", "payroll_register")
        .eq("status", "ready")
        .neq("id", row.id)
        .order("uploaded_at", { ascending: false })
        .limit(1),
    ]);

  const previousSamePeriod =
    samePeriodRows && samePeriodRows.length > 0
      ? rowToMetrics(samePeriodRows[0])
      : null;

  const previousAnyRegister =
    priorRegisterRows && priorRegisterRows.length > 0
      ? rowToMetrics(priorRegisterRows[0])
      : null;

  const diff = diffPayrollSummary(metrics, previousSamePeriod);
  const vsLastBaseline =
    previousAnyRegister &&
    previousSamePeriod &&
    previousAnyRegister.periodStart === previousSamePeriod.periodStart &&
    previousAnyRegister.periodEnd === previousSamePeriod.periodEnd
      ? null
      : previousAnyRegister;

  return {
    upload: rowToUploadRecord(row),
    metrics,
    previous: previousSamePeriod,
    diff,
    anomalies: {
      samePeriod: diffPayrollEmployees(metrics, previousSamePeriod),
      vsLastRegister: diffPayrollEmployees(metrics, vsLastBaseline),
    },
    registeredCount: metrics.employeeCount,
    pdfExtraction: {
      source: "pdf-parse",
      nativeScore: 0,
      ocrScore: null,
      ocrConfigured: false,
    },
    status: "ready",
  };
}

export async function storePayrollAuditPdf(
  admin: SupabaseClient,
  companyId: string,
  uploadId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const safeName = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const storagePath = `${companyId}/${uploadId}/${safeName}`;

  const { error } = await admin.storage
    .from(PAYROLL_AUDIT_STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) throw error;
  return storagePath;
}
