/**
 * Annual Finance exports: SIL accrual, 13th-month YTD, alphalist.
 * ?type=sil|thirteenth-month|alphalist &year= &client_id= &q= &limit= &offset= &format=json
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
import { publicDbClient } from "@/lib/timekeeping/public-db";
import {
  alphalistRowValues,
  ALPHALIST_HEADERS,
  rollAlphalistRows,
} from "@/lib/reports/alphalist";
import {
  silAccrualFilename,
  silAccrualWorkbookBuffer,
  type SilAccrualRow,
} from "@/lib/reports/sil-accrual-export";
import {
  rollThirteenthMonthYtd,
  thirteenthMonthAccrual,
  thirteenthMonthRowValues,
  THIRTEENTH_MONTH_HEADERS,
  toMissMerryPersonRows,
  countMissMerrySalaryRanges,
  buildMissMerryValidatedWorkbook,
  buildMissMerryValidatedPdf,
  missMerryValidatedFilename,
  toFinalPayRows,
  buildFinalPayWorkbook,
  buildFinalPayPdf,
  finalPayExportFilename,
} from "@/lib/reports/thirteenth-month";
import { loadGpLogoDataUrl } from "@/lib/reports/gp-report-logo-node";
import { binaryFileResponse } from "@/lib/http/binary-file-response";
import XLSX from "xlsx-js-style";

export const dynamic = "force-dynamic";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";

function xlsxDownload(buffer: Buffer, filename: string) {
  return binaryFileResponse(buffer, { contentType: XLSX_MIME, filename });
}

function pdfDownload(buffer: Buffer, filename: string) {
  return binaryFileResponse(buffer, { contentType: PDF_MIME, filename });
}

function workbookFromAoa(
  sheetName: string,
  headers: readonly string[],
  rows: unknown[][],
  title: string
): Buffer {
  const wb = XLSX.utils.book_new();
  const aoa: unknown[][] = [
    ["Green Pasture People Management Inc."],
    [title],
    [],
    [...headers],
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const type = (request.nextUrl.searchParams.get("type") ?? "").trim();
  const year = Number(
    request.nextUrl.searchParams.get("year") ?? new Date().getFullYear()
  );
  const clientId = request.nextUrl.searchParams.get("client_id")?.trim() || null;
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0);
  const variant = (request.nextUrl.searchParams.get("variant") ?? "").trim();
  const dateFrom =
    request.nextUrl.searchParams.get("date_from")?.trim() || null;
  const dateTo = request.nextUrl.searchParams.get("date_to")?.trim() || null;
  const statusLabel =
    request.nextUrl.searchParams.get("status")?.trim() || "Active";
  const format = (
    request.nextUrl.searchParams.get("format") ?? "xlsx"
  )
    .trim()
    .toLowerCase();
  const asJson = format === "json";
  const asPdf = format === "pdf";

  if (!["sil", "thirteenth-month", "alphalist"].includes(type)) {
    return jsonError(
      "Invalid type. Use sil, thirteenth-month, or alphalist",
      400
    );
  }
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return jsonError("Invalid year", 400);
  }

  const publicDb = publicDbClient();
  const directory = directoryClient();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const periodStartBound =
    type === "thirteenth-month" && variant === "final-pay" && dateFrom
      ? dateFrom
      : yearStart;
  const periodEndBound =
    type === "thirteenth-month" && variant === "final-pay" && dateTo
      ? dateTo
      : yearEnd;

  let clientName = "";
  if (clientId) {
    const { data: client } = await directory
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!client) return jsonError("Client not found", 404);
    clientName = String(client.name ?? "").trim();
  }

  if (type === "sil") {
    let query = publicDb
      .from("employees")
      .select(
        "employee_code, last_name, first_name, hire_date, status, sil_allotted, sil_days_used, sil_credits, sil_balance_year, sil_last_accrual, directory_employee_id",
        { count: "exact" }
      )
      .eq("organization_id", orgId)
      .order("last_name")
      .range(offset, offset + limit - 1);

    if (q) {
      query = query.or(
        `last_name.ilike.%${q}%,first_name.ilike.%${q}%,employee_code.ilike.%${q}%`
      );
    }
    if (year) {
      query = query.or(`sil_balance_year.eq.${year},sil_balance_year.is.null`);
    }

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    let rows = (data ?? []) as SilAccrualRow[];
    if (clientId) {
      const dirIds = rows
        .map((r) => (r as { directory_employee_id?: string | null }).directory_employee_id)
        .filter(Boolean) as string[];
      if (dirIds.length) {
        const { data: dirPeople } = await directory
          .from("employees")
          .select("id")
          .eq("client_id", clientId)
          .in("id", dirIds);
        const allowed = new Set((dirPeople ?? []).map((r) => r.id as string));
        rows = rows.filter((r) =>
          allowed.has(
            String((r as { directory_employee_id?: string }).directory_employee_id ?? "")
          )
        );
      } else {
        rows = [];
      }
    }

    const buffer = silAccrualWorkbookBuffer(rows, {
      year,
      client_name: clientName,
    });
    const filename = silAccrualFilename(year, clientName || "org");
    if (asJson) {
      return jsonOk({
        data: {
          type,
          filename,
          count: count ?? rows.length,
          limit,
          offset,
          rows,
          xlsx_base64: buffer.toString("base64"),
        },
      });
    }
    return xlsxDownload(buffer, filename);
  }

  // thirteenth-month + alphalist: posted register lines in year (optional client)
  let periodQuery = publicDb
    .from("cutoff_periods")
    .select("id, period_start, period_end, client_id")
    .eq("organization_id", orgId)
    .eq("status", "posted")
    .gte("period_start", periodStartBound)
    .lte("period_end", periodEndBound);
  if (clientId) periodQuery = periodQuery.eq("client_id", clientId);
  const { data: periods, error: periodError } = await periodQuery;
  if (periodError) return jsonError(periodError.message, 500);
  const periodIds = (periods ?? []).map((p) => p.id as string);
  if (!periodIds.length) {
    const emptyBuf = workbookFromAoa(
      type === "alphalist" ? "Alphalist" : "13th",
      type === "alphalist" ? ALPHALIST_HEADERS : THIRTEENTH_MONTH_HEADERS,
      [],
      `${type} ${year}`
    );
    const filename =
      type === "alphalist"
        ? `Alphalist-${year}.xlsx`
        : `13th-month-${year}.xlsx`;
    if (asJson) {
      return jsonOk({
        data: {
          type,
          filename,
          count: 0,
          limit,
          offset,
          rows: [],
          xlsx_base64: emptyBuf.toString("base64"),
        },
      });
    }
    return xlsxDownload(emptyBuf, filename);
  }

  const { data: runs, error: runError } = await publicDb
    .from("payroll_register_runs")
    .select("id, cutoff_period_id, status")
    .eq("organization_id", orgId)
    .eq("status", "posted")
    .in("cutoff_period_id", periodIds);
  if (runError) return jsonError(runError.message, 500);
  const runIds = (runs ?? []).map((r) => r.id as string);
  if (!runIds.length) {
    return jsonError("No posted payroll registers for that year", 404);
  }

  const lines: Array<Record<string, unknown>> = [];
  const page = 500;
  for (const runId of runIds) {
    for (let off = 0; ; off += page) {
      const { data: chunk, error: lineError } = await publicDb
        .from("payroll_register_lines")
        .select(
          "run_id, directory_employee_id, employee_code, last_name, first_name, gross_pay, net_pay, earnings, deductions"
        )
        .eq("run_id", runId)
        .order("last_name")
        .range(off, off + page - 1);
      if (lineError) return jsonError(lineError.message, 500);
      const rows = chunk ?? [];
      lines.push(...rows);
      if (rows.length < page) break;
    }
  }

  const dirIds = [
    ...new Set(
      lines
        .map((l) => l.directory_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const tinByDir = new Map<string, { tin: string | null; middle_name: string | null }>();
  if (dirIds.length) {
    for (let i = 0; i < dirIds.length; i += 200) {
      const slice = dirIds.slice(i, i + 200);
      const { data: people } = await directory
        .from("employees")
        .select("id, tin, middle_name")
        .in("id", slice);
      for (const p of people ?? []) {
        tinByDir.set(p.id as string, {
          tin: (p.tin as string | null) ?? null,
          middle_name: (p.middle_name as string | null) ?? null,
        });
      }
    }
  }

  if (type === "thirteenth-month") {
    const periodClientById = new Map(
      (periods ?? []).map((p) => [
        p.id as string,
        p.client_id as string | null,
      ])
    );
    const runClientById = new Map<string, string | null>();
    for (const run of runs ?? []) {
      runClientById.set(
        run.id as string,
        periodClientById.get(run.cutoff_period_id as string) ?? null
      );
    }
    const clientIdsNeeded = [
      ...new Set(
        [...runClientById.values()].filter(Boolean) as string[]
      ),
    ];
    const clientNameById = new Map<string, string>();
    if (clientName && clientId) clientNameById.set(clientId, clientName);
    for (let i = 0; i < clientIdsNeeded.length; i += 200) {
      const slice = clientIdsNeeded.slice(i, i + 200);
      const { data: clientRows } = await directory
        .from("clients")
        .select("id, name")
        .in("id", slice);
      for (const c of clientRows ?? []) {
        clientNameById.set(
          c.id as string,
          String(c.name ?? "").trim()
        );
      }
    }

    // Attach client from first line per person (same client across year usually).
    const clientByPerson = new Map<string, string>();
    for (const line of lines) {
      const dirId = (line.directory_employee_id as string | null) ?? "";
      const code = String(line.employee_code ?? "");
      const key = dirId || `code:${code}`;
      if (!key || key === "code:") continue;
      if (clientByPerson.has(key)) continue;
      const cid = runClientById.get(String(line.run_id ?? "")) ?? null;
      if (cid) clientByPerson.set(key, cid);
    }

    const rolled = rollThirteenthMonthYtd(
      lines.map((line) => {
        const earnings = (line.earnings ?? {}) as Record<string, unknown>;
        const basic = Number(earnings.basic ?? 0);
        return {
          directory_employee_id:
            (line.directory_employee_id as string | null) ?? null,
          employee_code: (line.employee_code as string | null) ?? null,
          last_name: (line.last_name as string | null) ?? null,
          first_name: (line.first_name as string | null) ?? null,
          basic_pay: basic,
          accrual:
            Number(earnings.thirteenth_month_accrual ?? 0) ||
            thirteenthMonthAccrual(basic),
        };
      })
    );

    let filtered = rolled;
    if (q) {
      const needle = q.toLowerCase();
      filtered = rolled.filter(
        (r) =>
          r.last_name.toLowerCase().includes(needle) ||
          r.first_name.toLowerCase().includes(needle) ||
          r.employee_code.toLowerCase().includes(needle)
      );
    }

    if (variant === "miss-merry") {
      const merrySources = filtered.map((r) => {
        const key =
          r.directory_employee_id ||
          (r.employee_code ? `code:${r.employee_code}` : "");
        const cid = key ? clientByPerson.get(key) : null;
        const mid = r.directory_employee_id
          ? tinByDir.get(r.directory_employee_id)?.middle_name
          : null;
        return {
          ...r,
          client_name: cid
            ? clientNameById.get(cid) ?? clientName
            : clientName,
          middle_name: mid ?? null,
        };
      });
      const merryRows = toMissMerryPersonRows(merrySources);
      const ranges = countMissMerrySalaryRanges(
        merryRows.map((r) => r.thirteenth_month)
      );
      const pageRows = merryRows.slice(offset, offset + limit);
      const exportInput = {
        year,
        clientName: clientName || null,
        salaryRanges: ranges,
        people: merryRows,
        logoDataUrl: loadGpLogoDataUrl(),
      };
      const base = missMerryValidatedFilename(year, clientName);
      if (asJson) {
        const wantExport =
          request.nextUrl.searchParams.get("export") === "1";
        if (!wantExport) {
          return jsonOk({
            data: {
              type,
              variant: "miss-merry",
              count: merryRows.length,
              limit,
              offset,
              rows: pageRows,
              salary_ranges: ranges,
            },
          });
        }
        const xlsxBuf = buildMissMerryValidatedWorkbook(exportInput);
        const pdfBuf = buildMissMerryValidatedPdf(exportInput);
        return jsonOk({
          data: {
            type,
            variant: "miss-merry",
            filename: `${base}.xlsx`,
            pdf_filename: `${base}.pdf`,
            count: merryRows.length,
            limit,
            offset,
            rows: pageRows,
            salary_ranges: ranges,
            xlsx_base64: xlsxBuf.toString("base64"),
            pdf_base64: pdfBuf.toString("base64"),
          },
        });
      }
      if (asPdf) {
        return pdfDownload(
          buildMissMerryValidatedPdf(exportInput),
          `${base}.pdf`
        );
      }
      return xlsxDownload(
        buildMissMerryValidatedWorkbook(exportInput),
        `${base}.xlsx`
      );
    }

    if (variant === "final-pay") {
      const finalSources = filtered.map((r) => {
        const mid = r.directory_employee_id
          ? tinByDir.get(r.directory_employee_id)?.middle_name
          : null;
        return {
          ...r,
          middle_name: mid ?? null,
        };
      });
      const finalRows = toFinalPayRows(finalSources);
      const pageRows = finalRows.slice(offset, offset + limit);
      const totalBasic = finalRows.reduce((s, r) => s + r.total_basic, 0);
      const total13th = finalRows.reduce(
        (s, r) => s + r.thirteenth_month_pay,
        0
      );
      const exportInput = {
        rows: finalRows,
        clientName: clientName || null,
        status: statusLabel,
        periodFrom: dateFrom || yearStart,
        periodTo: dateTo || yearEnd,
        logoDataUrl: loadGpLogoDataUrl(),
      };
      const base = finalPayExportFilename({
        periodFrom: dateFrom || yearStart,
        periodTo: dateTo || yearEnd,
        clientName,
      });
      if (asJson) {
        const wantExport =
          request.nextUrl.searchParams.get("export") === "1";
        if (!wantExport) {
          return jsonOk({
            data: {
              type,
              variant: "final-pay",
              count: finalRows.length,
              limit,
              offset,
              client: clientName,
              status: statusLabel,
              period_from: dateFrom || yearStart,
              period_to: dateTo || yearEnd,
              rows: pageRows,
              totals: {
                total_basic: Math.round(totalBasic * 100) / 100,
                thirteenth_month_pay: Math.round(total13th * 100) / 100,
              },
            },
          });
        }
        const xlsxBuf = buildFinalPayWorkbook(exportInput);
        const pdfBuf = buildFinalPayPdf(exportInput);
        return jsonOk({
          data: {
            type,
            variant: "final-pay",
            filename: `${base}.xlsx`,
            pdf_filename: `${base}.pdf`,
            count: finalRows.length,
            limit,
            offset,
            client: clientName,
            status: statusLabel,
            period_from: dateFrom || yearStart,
            period_to: dateTo || yearEnd,
            rows: pageRows,
            totals: {
              total_basic: Math.round(totalBasic * 100) / 100,
              thirteenth_month_pay: Math.round(total13th * 100) / 100,
            },
            xlsx_base64: xlsxBuf.toString("base64"),
            pdf_base64: pdfBuf.toString("base64"),
          },
        });
      }
      if (asPdf) {
        return pdfDownload(buildFinalPayPdf(exportInput), `${base}.pdf`);
      }
      return xlsxDownload(buildFinalPayWorkbook(exportInput), `${base}.xlsx`);
    }

    const pageRows = filtered.slice(offset, offset + limit);
    const buffer = workbookFromAoa(
      "13th",
      THIRTEENTH_MONTH_HEADERS,
      filtered.map(thirteenthMonthRowValues),
      `13th month YTD ${year}${clientName ? ` · ${clientName}` : ""}`
    );
    const filename = `13th-month-${year}${clientName ? `-${clientName.replace(/\s+/g, "-")}` : ""}.xlsx`;
    if (asJson) {
      return jsonOk({
        data: {
          type,
          filename,
          count: filtered.length,
          limit,
          offset,
          rows: pageRows,
          xlsx_base64: buffer.toString("base64"),
        },
      });
    }
    return xlsxDownload(buffer, filename);
  }

  const alphalist = rollAlphalistRows(
    lines.map((line) => {
      const dirId = (line.directory_employee_id as string | null) ?? null;
      const ids = dirId ? tinByDir.get(dirId) : undefined;
      const earnings = (line.earnings ?? {}) as Record<string, unknown>;
      return {
        directory_employee_id: dirId,
        employee_code: (line.employee_code as string | null) ?? null,
        last_name: (line.last_name as string | null) ?? null,
        first_name: (line.first_name as string | null) ?? null,
        middle_name: ids?.middle_name ?? null,
        tin: ids?.tin ?? null,
        gross_pay: Number(line.gross_pay ?? 0),
        net_pay: Number(line.net_pay ?? 0),
        basic_pay: Number(earnings.basic ?? 0),
        deductions: (line.deductions ?? {}) as Record<string, unknown>,
        earnings,
      };
    })
  );
  let filteredAlpha = alphalist;
  if (q) {
    const needle = q.toLowerCase();
    filteredAlpha = alphalist.filter(
      (r) =>
        r.last_name.toLowerCase().includes(needle) ||
        r.first_name.toLowerCase().includes(needle) ||
        r.employee_code.toLowerCase().includes(needle) ||
        r.tin.toLowerCase().includes(needle)
    );
  }
  const pageAlpha = filteredAlpha.slice(offset, offset + limit);
  const buffer = workbookFromAoa(
    "Alphalist",
    ALPHALIST_HEADERS,
    filteredAlpha.map(alphalistRowValues),
    `Alphalist ${year}${clientName ? ` · ${clientName}` : ""}`
  );
  const filenameBase = `Alphalist-${year}${
    clientName ? `-${clientName.replace(/\s+/g, "-")}` : ""
  }`;
  const filename = `${filenameBase}.xlsx`;

  if (asPdf) {
    const {
      createGpLandscapeReport,
      stampGpReportFooter,
      gpReportTableBottomMargin,
      GP_REPORT_GREEN,
    } = await import("@/lib/reports/gp-report-pdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { doc, contentTop, margin } = createGpLandscapeReport({
      title: "Alphalist",
      subtitle: `${year}${clientName ? ` · ${clientName}` : ""}`,
      logoDataUrl: loadGpLogoDataUrl(),
    });
    autoTable(doc, {
      startY: contentTop,
      head: [[...ALPHALIST_HEADERS]],
      body: filteredAlpha.map((row) =>
        alphalistRowValues(row).map((cell) => String(cell ?? ""))
      ),
      margin: {
        left: margin,
        right: margin,
        top: margin,
        bottom: gpReportTableBottomMargin(margin),
      },
      styles: { fontSize: 6.5, cellPadding: 1.2 },
      headStyles: {
        fillColor: GP_REPORT_GREEN,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 6,
      },
    });
    stampGpReportFooter(doc, margin);
    return pdfDownload(
      Buffer.from(doc.output("arraybuffer")),
      `${filenameBase}.pdf`
    );
  }

  if (asJson) {
    const wantExport = request.nextUrl.searchParams.get("export") === "1";
    if (!wantExport) {
      return jsonOk({
        data: {
          type,
          count: filteredAlpha.length,
          limit,
          offset,
          rows: pageAlpha,
        },
      });
    }
    const {
      createGpLandscapeReport,
      stampGpReportFooter,
      gpReportTableBottomMargin,
      GP_REPORT_GREEN,
    } = await import("@/lib/reports/gp-report-pdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { doc, contentTop, margin } = createGpLandscapeReport({
      title: "Alphalist",
      subtitle: `${year}${clientName ? ` · ${clientName}` : ""}`,
      logoDataUrl: loadGpLogoDataUrl(),
    });
    autoTable(doc, {
      startY: contentTop,
      head: [[...ALPHALIST_HEADERS]],
      body: filteredAlpha.map((row) =>
        alphalistRowValues(row).map((cell) => String(cell ?? ""))
      ),
      margin: {
        left: margin,
        right: margin,
        top: margin,
        bottom: gpReportTableBottomMargin(margin),
      },
      styles: { fontSize: 6.5, cellPadding: 1.2 },
      headStyles: {
        fillColor: GP_REPORT_GREEN,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 6,
      },
    });
    stampGpReportFooter(doc, margin);
    const pdfBuf = Buffer.from(doc.output("arraybuffer"));
    return jsonOk({
      data: {
        type,
        filename,
        pdf_filename: `${filenameBase}.pdf`,
        count: filteredAlpha.length,
        limit,
        offset,
        rows: pageAlpha,
        xlsx_base64: buffer.toString("base64"),
        pdf_base64: pdfBuf.toString("base64"),
      },
    });
  }
  return xlsxDownload(buffer, filename);
}
