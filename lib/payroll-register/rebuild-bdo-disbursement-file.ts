/**
 * Rebuild a stored BDO .txt for an awaiting_ref disbursement using the
 * current converter format (tab-separated sample). Confirmed files stay frozen.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BDO_DEFAULT_FUNDING_ACCOUNT,
  buildBdoAtmCreditTxt,
  bdoAtmCreditFilename,
} from "@/lib/payroll-register/bdo-atm-credit-file";
import { loadBdoAtmRowsForRun } from "@/lib/payroll-register/load-bdo-atm-rows";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** True when stored body is the old VBA H/T layout, not the converter sample. */
export function isLegacyBdoHtFileBody(body: string | null | undefined): boolean {
  const s = String(body ?? "");
  return s.startsWith("H") || /\nT\d/.test(s) || s.includes("\nT");
}

export async function resolveBdoDisbursementFile(input: {
  publicDb: SupabaseClient;
  directory: SupabaseClient;
  organizationId: string;
  disbursement: {
    id: string;
    status: string;
    file_body: string | null;
    upload_date: string;
    batch_no: number;
    company_code: string | null;
    funding_account?: string | null;
    payroll_register_run_id: string;
  };
}): Promise<
  | { ok: true; text: string; filename: string }
  | { ok: false; error: string; status?: number }
> {
  const d = input.disbursement;
  const filename = bdoAtmCreditFilename({
    uploadDate: String(d.upload_date).slice(0, 10),
    batchNo: Number(d.batch_no),
    companyCode: String(d.company_code ?? "D7I"),
  });

  const body = d.file_body ? String(d.file_body) : "";
  const shouldRebuild =
    d.status === "awaiting_ref" && (!body || isLegacyBdoHtFileBody(body));

  if (!shouldRebuild) {
    if (!body) return { ok: false, error: "File body missing", status: 500 };
    return { ok: true, text: body, filename };
  }

  const loaded = await loadBdoAtmRowsForRun({
    publicDb: input.publicDb,
    directory: input.directory,
    runId: d.payroll_register_run_id,
    organizationId: input.organizationId,
  });
  if (loaded.error) return { ok: false, error: loaded.error, status: 500 };
  if (!loaded.data?.atmRows.length) {
    return { ok: false, error: "No ATM Debit Memo rows for this run", status: 400 };
  }

  const built = buildBdoAtmCreditTxt({
    uploadDate: String(d.upload_date).slice(0, 10),
    batchNo: Number(d.batch_no),
    companyCode: String(d.company_code ?? "D7I"),
    fundingAccount:
      String(d.funding_account ?? "").trim() || BDO_DEFAULT_FUNDING_ACCOUNT,
    rows: loaded.data.atmRows.map((r) => ({
      accountNo: r.accountNo,
      amount: r.amount,
      name: r.name,
    })),
    today: String(d.upload_date).slice(0, 10),
  });
  if (!built.ok) return { ok: false, error: built.error, status: 400 };

  await input.publicDb
    .from("payroll_bdo_disbursements")
    .update({
      file_body: built.text,
      file_sha256: sha256(built.text),
      record_count: built.recordCount,
      total_amount: built.totalAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", d.id)
    .eq("organization_id", input.organizationId);

  return { ok: true, text: built.text, filename: built.filename };
}
