import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { binaryFileResponse } from "@/lib/http/binary-file-response";
import {
  BDO_DEFAULT_COMPANY_CODE,
  BDO_DEFAULT_FUNDING_ACCOUNT,
  buildBdoAtmCreditTxt,
} from "@/lib/payroll-register/bdo-atm-credit-file";
import {
  activeDisbursement,
  canEnqueueRun,
  canGenerateForRun,
  type BdoDisbursementSnap,
} from "@/lib/payroll-register/bdo-disbursement";
import { loadBdoAtmRowsForRun } from "@/lib/payroll-register/load-bdo-atm-rows";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * POST /api/payroll/bdo-disbursements
 *
 * action=enqueue — manually add a posted run to the Debit Memo Queue (status=queued).
 * (default)     — generate BDO .txt from an existing queued row → awaiting_ref.
 *
 * Body (enqueue): { action: "enqueue", run_id }
 * Body (generate): { run_id, upload_date, batch_no?, company_code?, funding_account?, format? }
 */
export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  let body: {
    action?: string;
    run_id?: string;
    upload_date?: string;
    batch_no?: number;
    company_code?: string;
    funding_account?: string;
    format?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const runId = String(body.run_id ?? "").trim();
  if (!runId) return jsonError("run_id is required", 400);

  const publicDb = publicDbClient();
  const { data: run, error: runErr } = await publicDb
    .from("payroll_register_runs")
    .select("id, cutoff_period_id, organization_id, status")
    .eq("id", runId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (runErr) return jsonError(runErr.message, 500);
  if (!run) return jsonError("Payroll register run not found", 404);
  if (run.status !== "posted") {
    return jsonError("Payroll register must be posted before Debit Memo Queue", 409);
  }

  const { data: existingRows, error: exErr } = await publicDb
    .from("payroll_bdo_disbursements")
    .select("id, status, bdo_reference, payroll_register_run_id")
    .eq("payroll_register_run_id", runId)
    .eq("organization_id", orgId);

  if (exErr) return jsonError(exErr.message, 500);
  const active = activeDisbursement(
    (existingRows ?? []) as BdoDisbursementSnap[]
  );

  if (body.action === "enqueue") {
    const gate = canEnqueueRun(active);
    if (!gate.ok) return jsonError(gate.error ?? "Cannot enqueue", 409);

    const { data: inserted, error: insErr } = await publicDb
      .from("payroll_bdo_disbursements")
      .insert({
        organization_id: orgId,
        payroll_register_run_id: runId,
        cutoff_period_id: run.cutoff_period_id,
        upload_date: null,
        batch_no: null,
        company_code: BDO_DEFAULT_COMPANY_CODE,
        funding_account: BDO_DEFAULT_FUNDING_ACCOUNT,
        record_count: 0,
        total_amount: 0,
        file_sha256: null,
        file_body: null,
        status: "queued",
        generated_at: null,
        generated_by: auth.userId,
      })
      .select("*")
      .single();

    if (insErr) {
      if (insErr.code === "23505") {
        return jsonError("This cutoff is already on the Debit Memo Queue", 409);
      }
      return jsonError(insErr.message, 500);
    }

    return jsonOk(
      {
        data: {
          disbursement: inserted,
          cutoff_period_id: run.cutoff_period_id,
          queue_status: "queued",
        },
      },
      201
    );
  }

  const uploadDate = String(body.upload_date ?? "").trim();
  const batchNo = Number(body.batch_no ?? 1);
  const companyCode =
    String(body.company_code ?? "").trim() || BDO_DEFAULT_COMPANY_CODE;
  const fundingAccount =
    String(body.funding_account ?? "").trim() || BDO_DEFAULT_FUNDING_ACCOUNT;

  if (!uploadDate) return jsonError("upload_date is required", 400);

  const gate = canGenerateForRun(active);
  if (!gate.ok) return jsonError(gate.error ?? "Cannot generate", 409);
  if (!active) {
    return jsonError(
      "Add this cutoff to the Debit Memo Queue before generating a BDO file",
      409
    );
  }

  const directory = directoryClient();
  const loaded = await loadBdoAtmRowsForRun({
    publicDb,
    directory,
    runId,
    organizationId: orgId,
  });
  if (loaded.error) return jsonError(loaded.error, 500);
  if (!loaded.data || loaded.data.atmRows.length === 0) {
    return jsonError("No ATM Debit Memo rows for this payroll run", 400);
  }

  const built = buildBdoAtmCreditTxt({
    uploadDate,
    batchNo,
    companyCode,
    fundingAccount,
    rows: loaded.data.atmRows.map((r) => ({
      accountNo: r.accountNo,
      amount: r.amount,
      name: r.name,
    })),
  });
  if (!built.ok) {
    return jsonError(built.error, 400, { warnings: built.warnings });
  }

  const fileHash = sha256(built.text);
  const { data: updated, error: updErr } = await publicDb
    .from("payroll_bdo_disbursements")
    .update({
      upload_date: uploadDate,
      batch_no: batchNo,
      company_code: companyCode,
      funding_account: fundingAccount,
      record_count: built.recordCount,
      total_amount: built.totalAmount,
      file_sha256: fileHash,
      file_body: built.text,
      status: "awaiting_ref",
      generated_at: new Date().toISOString(),
      generated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", active.id)
    .eq("organization_id", orgId)
    .eq("status", "queued")
    .select("*")
    .single();

  if (updErr) {
    if (updErr.code === "23505") {
      return jsonError(
        "A BDO file already exists for this run or batch — void or re-download instead",
        409
      );
    }
    return jsonError(updErr.message, 500);
  }
  if (!updated) {
    return jsonError(
      "Queue row changed — refresh and try generating again",
      409
    );
  }

  if (body.format === "json") {
    return jsonOk({
      data: {
        disbursement: updated,
        filename: built.filename,
        warnings: built.warnings,
        preview: loaded.data.preview,
        txt_base64: Buffer.from(built.text, "utf8").toString("base64"),
      },
    });
  }

  return binaryFileResponse(Buffer.from(built.text, "utf8"), {
    contentType: "text/plain; charset=utf-8",
    filename: built.filename,
  });
}
