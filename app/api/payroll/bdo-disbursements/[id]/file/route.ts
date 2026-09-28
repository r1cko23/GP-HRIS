import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { binaryFileResponse } from "@/lib/http/binary-file-response";
import { resolveBdoDisbursementFile } from "@/lib/payroll-register/rebuild-bdo-disbursement-file";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * GET /api/payroll/bdo-disbursements/[id]/file
 * Re-download .txt. Awaiting-ref legacy H/T bodies are rebuilt to converter sample format.
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const publicDb = publicDbClient();
  const { data: row, error } = await publicDb
    .from("payroll_bdo_disbursements")
    .select(
      "id, status, file_body, upload_date, batch_no, company_code, funding_account, payroll_register_run_id"
    )
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!row) return jsonError("Disbursement not found", 404);
  if (row.status === "void") {
    return jsonError("Voided disbursement file is not available", 409);
  }

  const resolved = await resolveBdoDisbursementFile({
    publicDb,
    directory: directoryClient(),
    organizationId: orgId,
    disbursement: {
      id: row.id as string,
      status: String(row.status),
      file_body: (row.file_body as string | null) ?? null,
      upload_date: String(row.upload_date),
      batch_no: Number(row.batch_no),
      company_code: (row.company_code as string | null) ?? null,
      funding_account: (row.funding_account as string | null) ?? null,
      payroll_register_run_id: String(row.payroll_register_run_id),
    },
  });

  if (!resolved.ok) {
    return jsonError(resolved.error, resolved.status ?? 500);
  }

  return binaryFileResponse(Buffer.from(resolved.text, "utf8"), {
    contentType: "text/plain; charset=utf-8",
    filename: resolved.filename,
  });
}
