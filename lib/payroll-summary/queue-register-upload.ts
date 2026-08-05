import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rowToUploadRecord,
  storePayrollAuditPdf,
} from "@/lib/payroll-summary/process-register-upload";
import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary/types";

const LIST_SELECT =
  "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, status, error_message, rollup_gap_centavos, processed_at, storage_path";

const DETAIL_SELECT = `${LIST_SELECT}, parsed_json`;

export function triggerPayrollRegisterProcess(
  request: NextRequest,
  uploadId: string
) {
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
  }).catch((err) => {
    console.warn("Background payroll process trigger failed:", err);
  });
}

/**
 * Insert a processing upload row, store the PDF, and optionally kick off parse.
 */
export async function queuePayrollRegisterUpload(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  uploadedBy: string;
  companyId: string;
  fileName: string;
  buffer: Buffer;
  fileBase64: string;
  request?: NextRequest;
}): Promise<PayrollSummaryUploadRecord> {
  const { data: queued, error: queueError } = await input.supabase
    .from("payroll_summary_uploads")
    .insert({
      uploaded_by: input.uploadedBy,
      company_id: input.companyId,
      document_type: "payroll_register",
      status: "processing",
      source_file_name: input.fileName,
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
    .select(DETAIL_SELECT)
    .single();

  if (queueError) throw queueError;

  let storagePath: string | null = null;

  try {
    storagePath = await storePayrollAuditPdf(
      input.admin,
      input.companyId,
      String(queued.id),
      input.fileName,
      input.buffer
    );

    const { error: pathError } = await input.admin
      .from("payroll_summary_uploads")
      .update({ storage_path: storagePath })
      .eq("id", queued.id);

    if (pathError) throw pathError;
  } catch (storageError) {
    await input.admin
      .from("payroll_summary_uploads")
      .update({
        file_base64: input.fileBase64,
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

  if (input.request) {
    triggerPayrollRegisterProcess(input.request, String(queued.id));
  }

  return upload;
}
