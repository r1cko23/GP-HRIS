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
import { buildOrganicRegisterSummaryTable } from "@/lib/payroll-register/build-register-summary-table";
import {
  generateOrganicPayslipPDF,
  organicPayslipFilename,
  type OrganicPayslipLine,
} from "@/lib/payroll-register/generate-organic-payslip-pdf";
import {
  buildCutoffCsvPack,
  isMonthlyRemittanceType,
  monthlyRemittanceHeld,
  monthlyRemittanceHeldMessage,
  remittanceFilesThisCutoff,
  toCsv,
  type CutoffExportType,
  type PackDirectoryIds,
} from "@/lib/payroll-register/cutoff-report-pack";
import { statutoryThisCutoff } from "@/lib/ph-payroll/statutory-schedule";
import { zipSync } from "fflate";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function asPayslipLine(line: {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  daily_rate?: number | null;
  monthly_salary?: number | null;
  gross_pay?: number | null;
  total_deductions?: number | null;
  net_pay?: number | null;
  hours?: unknown;
  earnings?: unknown;
  deductions?: unknown;
  bank_name?: string | null;
  bank_account_no?: string | null;
}): OrganicPayslipLine {
  return {
    employee_code: line.employee_code,
    last_name: line.last_name,
    first_name: line.first_name,
    daily_rate: line.daily_rate,
    monthly_salary: line.monthly_salary,
    gross_pay: line.gross_pay,
    total_deductions: line.total_deductions,
    net_pay: line.net_pay,
    hours: (line.hours as Record<string, number> | null) ?? {},
    earnings: (line.earnings as Record<string, number> | null) ?? {},
    deductions: (line.deductions as Record<string, number> | null) ?? {},
    bank_name: line.bank_name,
    bank_account_no: line.bank_account_no,
  };
}

/**
 * Export remittance / bank / payslip-summary CSV (or PDF/ZIP) for an Organic payroll register.
 * ?type=sss|philhealth|pagibig|wtax|bank|other_deductions|payslips|register_detail|summary-pdf|payslip-pdf|payslip-pdfs-zip
 * payslip-pdf requires employee= code (or line_id=)
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const type = (request.nextUrl.searchParams.get("type") ?? "payslips").trim();
  const publicDb = publicDbClient();

  const { data: run, error } = await publicDb
    .from("payroll_register_runs")
    .select("*")
    .eq("cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!run) return jsonError("Payroll register not found — build it first", 404);

  const { data: period } = await publicDb
    .from("cutoff_periods")
    .select("payroll_date, period_start, period_end, client_id")
    .eq("id", params.id)
    .maybeSingle();

  const directory = directoryClient();
  const { data: clientRow } = period?.client_id
    ? await directory
        .from("clients")
        .select(
          "cut1_start, cut1_end, cut2_start, cut2_end, pay_frequency, statutory_schedule, wtax_schedule, include_cola, include_sea, include_ctpa"
        )
        .eq("id", period.client_id)
        .maybeSingle()
    : { data: null };
  const supplementalPolicy = {
    include_cola: Boolean(clientRow?.include_cola),
    include_sea: Boolean(clientRow?.include_sea),
    include_ctpa: Boolean(clientRow?.include_ctpa),
  };
  const statutoryFlags = statutoryThisCutoff(
    clientRow ?? {},
    String(period?.period_start ?? run.period_start)
  );

  if (type === "available") {
    return jsonOk({
      data: remittanceFilesThisCutoff(statutoryFlags),
    });
  }

  if (isMonthlyRemittanceType(type) && monthlyRemittanceHeld(statutoryFlags, type)) {
    return jsonError(monthlyRemittanceHeldMessage(type), 409);
  }

  let linesQuery = publicDb
    .from("payroll_register_lines")
    .select("*")
    .eq("run_id", run.id)
    .order("last_name");

  const employeeCode = request.nextUrl.searchParams.get("employee")?.trim();
  const lineId = request.nextUrl.searchParams.get("line_id")?.trim();
  if (type === "payslip-pdf") {
    if (lineId) linesQuery = linesQuery.eq("id", lineId);
    else if (employeeCode) {
      linesQuery = linesQuery.eq("employee_code", employeeCode);
    } else {
      return jsonError("payslip-pdf requires employee= or line_id=", 400);
    }
  }

  const { data: lines, error: linesError } = await linesQuery;
  if (linesError) return jsonError(linesError.message, 500);

  const rows = lines ?? [];

  if (type === "summary-pdf") {
    const table = buildOrganicRegisterSummaryTable({
      periodStart: String(run.period_start),
      periodEnd: String(run.period_end),
      lines: rows,
    });
    const { generateGpPayrollRegisterPDF } = await import(
      "@/utils/payroll-run-register-pdf"
    );
    const doc = generateGpPayrollRegisterPDF(table);
    const filename = `payroll-summary-${run.period_start}-${run.period_end}.pdf`;
    const buffer = Buffer.from(doc.output("arraybuffer"));
    if (request.nextUrl.searchParams.get("format") === "json") {
      return jsonOk({
        data: {
          type,
          filename,
          pdf_base64: buffer.toString("base64"),
        },
      });
    }
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (type === "payslip-pdf") {
    const line = rows[0];
    if (!line) return jsonError("Register line not found", 404);
    const periodStart = String(run.period_start);
    const periodEnd = String(run.period_end);
    const doc = generateOrganicPayslipPDF({
      periodStart,
      periodEnd,
      payrollDate: period?.payroll_date ?? null,
      line: asPayslipLine(line),
    });
    const filename = organicPayslipFilename(line, periodStart, periodEnd);
    const buffer = Buffer.from(doc.output("arraybuffer"));
    if (request.nextUrl.searchParams.get("format") === "json") {
      return jsonOk({
        data: {
          type,
          filename,
          pdf_base64: buffer.toString("base64"),
        },
      });
    }
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (type === "payslip-pdfs-zip") {
    if (!rows.length) {
      return jsonError("No register lines to export", 404);
    }
    const periodStart = String(run.period_start);
    const periodEnd = String(run.period_end);
    const files: Record<string, Uint8Array> = {};
    const usedNames = new Map<string, number>();

    for (const line of rows) {
      const payslipLine = asPayslipLine(line);
      const doc = generateOrganicPayslipPDF({
        periodStart,
        periodEnd,
        payrollDate: period?.payroll_date ?? null,
        line: payslipLine,
      });
      let filename = organicPayslipFilename(payslipLine, periodStart, periodEnd);
      const seen = usedNames.get(filename) ?? 0;
      usedNames.set(filename, seen + 1);
      if (seen > 0) {
        filename = filename.replace(/\.pdf$/i, `_${seen + 1}.pdf`);
      }
      files[filename] = new Uint8Array(doc.output("arraybuffer"));
    }

    const zipped = zipSync(files, { level: 6 });
    const buffer = Buffer.from(zipped);
    const filename = `payslips_${periodStart}_${periodEnd}.zip`;
    if (request.nextUrl.searchParams.get("format") === "json") {
      return jsonOk({
        data: {
          type,
          filename,
          count: rows.length,
          zip_base64: buffer.toString("base64"),
        },
      });
    }
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const csvTypes: CutoffExportType[] = [
    "sss",
    "philhealth",
    "pagibig",
    "wtax",
    "bank",
    "other_deductions",
    "payslips",
    "register_detail",
  ];
  if (!csvTypes.includes(type as CutoffExportType)) {
    return jsonError(
      "Invalid type. Use sss, philhealth, pagibig, wtax, bank, other_deductions, payslips, register_detail, summary-pdf, payslip-pdf, or payslip-pdfs-zip",
      400
    );
  }

  const dirIds = [
    ...new Set(
      rows
        .map((row) => row.directory_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const byDir = new Map<string, PackDirectoryIds>();
  if (dirIds.length) {
    const { data: dirEmps } = await directory
      .from("employees")
      .select(
        "id, tin, sss_number, philhealth_number, pagibig_number, bank_name, bank_account_no"
      )
      .in("id", dirIds);
    for (const row of dirEmps ?? []) {
      byDir.set(row.id as string, {
        tin: (row.tin as string | null) ?? null,
        sss_number: (row.sss_number as string | null) ?? null,
        philhealth_number: (row.philhealth_number as string | null) ?? null,
        pagibig_number: (row.pagibig_number as string | null) ?? null,
        bank_name: (row.bank_name as string | null) ?? null,
        bank_account_no: (row.bank_account_no as string | null) ?? null,
      });
    }
  }

  const pack = buildCutoffCsvPack(
    type as CutoffExportType,
    rows,
    byDir,
    String(run.period_start),
    String(run.period_end),
    supplementalPolicy
  );
  const csv = toCsv(pack.headers, pack.rows);
  if (request.nextUrl.searchParams.get("format") === "json") {
    return jsonOk({
      data: {
        type,
        filename: pack.filename,
        headers: pack.headers,
        rows: pack.rows,
        csv,
      },
    });
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${pack.filename}"`,
    },
  });
}
