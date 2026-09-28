/**
 * Organic cash-advance remittance from posted register loan_lines.
 * GET ?client_id=&q=&date_from=&date_to=&limit=&offset=&format=json|csv|xlsx|pdf
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
  cashAdvanceReportFilename,
  explodeCashAdvanceReportRows,
  filterLoansReportRows,
  paginateLoansReportRows,
} from "@/lib/reports/loans-report";
import { loadPostedLoanReportSource } from "@/lib/reports/posted-loan-report-source";
import { loadGpLogoDataUrl } from "@/lib/reports/gp-report-logo-node";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

function sanitizeIlike(value: string): string {
  return value.replace(/[%_,]/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const clientId = params.get("client_id")?.trim() || null;
  const q = sanitizeIlike(params.get("q")?.trim() || "");
  const dateFrom = params.get("date_from")?.trim() || null;
  const dateTo = params.get("date_to")?.trim() || null;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
  const format = (params.get("format") ?? "json").trim().toLowerCase();

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

  const exploded = explodeCashAdvanceReportRows(loaded.value.source);
  const filtered = filterLoansReportRows(exploded, {
    q,
    client_name: loaded.value.clientNameFilter,
  });
  const pageRows = paginateLoansReportRows(filtered, limit, offset);
  const particular = "Cash Advance";
  const title = "List of Other Deduction(Cash Advance)";
  const base = cashAdvanceReportFilename({ dateFrom, dateTo });
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
