/**
 * Loans remittance report from posted register loan_lines.
 * GET ?client_id=&loan_type=&q=&date_from=&date_to=&limit=&offset=&format=json|csv|xlsx|pdf
 */

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
  buildLoansRemittanceCsv,
  buildLoansRemittancePdf,
  buildLoansRemittanceWorkbook,
  explodeLoansReportRows,
  filterLoansReportRows,
  isLoansReportType,
  loansReportReviewKey,
  loansRemittanceTitle,
  loansReportFilename,
  paginateLoansReportRows,
  type LoansReportType,
} from "@/lib/reports/loans-report";
import { APRIL_HR_REVIEW_NOTE } from "@/lib/loans/hr-review";
import { particularLabel } from "@/lib/loans/particular";
import { loadPostedLoanReportSource } from "@/lib/reports/posted-loan-report-source";
import { loadGpLogoDataUrl } from "@/lib/reports/gp-report-logo-node";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

function sanitizeIlike(value: string): string {
  return value.replace(/[%_,]/g, " ").trim();
}

async function loadAprilReviewKeys(
  publicDb: ReturnType<typeof publicDbClient>,
  clientId: string | null
): Promise<Set<string>> {
  const keys = new Set<string>();
  const { data: loans, error } = await publicDb
    .from("employee_loans")
    .select("loan_type, employee_id")
    .ilike("notes", `${APRIL_HR_REVIEW_NOTE}%`);
  if (error) throw new Error(error.message);
  const employeeIds = [
    ...new Set(
      (loans ?? [])
        .map((row) => row.employee_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (!employeeIds.length) return keys;

  const codeById = new Map<string, string>();
  for (let i = 0; i < employeeIds.length; i += 200) {
    const slice = employeeIds.slice(i, i + 200);
    let peopleQuery = publicDb
      .from("employees")
      .select("id, employee_code, directory_client_id")
      .in("id", slice);
    if (clientId) peopleQuery = peopleQuery.eq("directory_client_id", clientId);
    const { data: people, error: peopleError } = await peopleQuery;
    if (peopleError) throw new Error(peopleError.message);
    for (const person of people ?? []) {
      codeById.set(person.id as string, String(person.employee_code ?? ""));
    }
  }

  for (const loan of loans ?? []) {
    const code = codeById.get(loan.employee_id as string);
    if (!code) continue;
    keys.add(loansReportReviewKey(code, loan.loan_type as string | null));
  }
  return keys;
}

function remittanceParticular(loanType: LoansReportType | null): string {
  if (!loanType) return "SSS Loan";
  return particularLabel(loanType);
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const clientId = params.get("client_id")?.trim() || null;
  const loanTypeRaw = params.get("loan_type")?.trim() || "";
  const q = sanitizeIlike(params.get("q")?.trim() || "");
  const dateFrom = params.get("date_from")?.trim() || null;
  const dateTo = params.get("date_to")?.trim() || null;
  const review = params.get("review")?.trim() || "";
  if (review && review !== "april") {
    return jsonError("Invalid review filter", 400);
  }
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
  const format = (params.get("format") ?? "json").trim().toLowerCase();

  let loanType: LoansReportType | null = null;
  if (loanTypeRaw && loanTypeRaw !== "all") {
    if (!isLoansReportType(loanTypeRaw)) {
      return jsonError(
        "Invalid loan_type. Use sss, sss_calamity, pagibig_mpl, pagibig_calamity, or pagibig_safe",
        400
      );
    }
    loanType = loanTypeRaw;
  }

  const loaded = await loadPostedLoanReportSource({
    publicDb: publicDbClient(),
    directory: directoryClient(),
    orgId,
    clientId,
    dateFrom,
    dateTo,
  });
  if (!loaded.ok) {
    const status = loaded.error === "Client not found" ? 404 : 500;
    return jsonError(loaded.error, status);
  }

  const exploded = explodeLoansReportRows(loaded.value.source, {
    loan_type: loanType,
  });
  let reviewKeys: Set<string> | null = null;
  if (review === "april") {
    try {
      reviewKeys = await loadAprilReviewKeys(publicDbClient(), clientId);
    } catch (err) {
      return jsonError(
        err instanceof Error ? err.message : "Failed to load review loans",
        500
      );
    }
  }
  const filtered = filterLoansReportRows(exploded, {
    q,
    client_name: loaded.value.clientNameFilter,
    review_keys: reviewKeys,
  });
  const pageRows = paginateLoansReportRows(filtered, limit, offset);

  const particular = remittanceParticular(loanType);
  const title = loansRemittanceTitle(particular);
  const base = loansReportFilename({ dateFrom, dateTo, loanType });
  const exportInput = {
    rows: filtered,
    dateFrom,
    dateTo,
    particular,
    title,
    logoDataUrl: loadGpLogoDataUrl(),
  };

  if (format === "csv") {
    const csv = buildLoansRemittanceCsv(filtered, {
      dateFrom,
      dateTo,
      particular,
    });
    return binaryFileResponse(Buffer.from(csv, "utf8"), {
      contentType: "text/csv; charset=utf-8",
      filename: `${base}.csv`,
    });
  }

  if (format === "xlsx") {
    return binaryFileResponse(buildLoansRemittanceWorkbook(exportInput), {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${base}.xlsx`,
    });
  }

  if (format === "pdf") {
    return binaryFileResponse(buildLoansRemittancePdf(exportInput), {
      contentType: "application/pdf",
      filename: `${base}.pdf`,
    });
  }

  return jsonOk({
    data: pageRows,
    count: filtered.length,
    limit,
    offset,
    title,
  });
}
