import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  return [
    headers.join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

/**
 * Export remittance / bank / payslip-summary CSV for an Organic payroll register.
 * ?type=sss|philhealth|pagibig|wtax|bank|payslips
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
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

  const { data: lines, error: linesError } = await publicDb
    .from("payroll_register_lines")
    .select("*")
    .eq("run_id", run.id)
    .order("last_name");
  if (linesError) return jsonError(linesError.message, 500);

  const rows = lines ?? [];
  let headers: string[] = [];
  let csvRows: Array<Array<unknown>> = [];
  let filename = `organic-${type}-${run.period_start}-${run.period_end}.csv`;

  if (type === "bank") {
    headers = [
      "employee_code",
      "last_name",
      "first_name",
      "bank_name",
      "bank_account_no",
      "net_pay",
    ];
    csvRows = rows.map((row) => [
      row.employee_code,
      row.last_name,
      row.first_name,
      row.bank_name,
      row.bank_account_no,
      row.net_pay,
    ]);
  } else if (type === "sss") {
    headers = ["employee_code", "last_name", "first_name", "sss_ee", "gross_pay"];
    csvRows = rows.map((row) => {
      const d = (row.deductions as Record<string, number>) ?? {};
      return [
        row.employee_code,
        row.last_name,
        row.first_name,
        d.sss ?? 0,
        row.gross_pay,
      ];
    });
  } else if (type === "philhealth") {
    headers = [
      "employee_code",
      "last_name",
      "first_name",
      "philhealth_ee",
      "gross_pay",
    ];
    csvRows = rows.map((row) => {
      const d = (row.deductions as Record<string, number>) ?? {};
      return [
        row.employee_code,
        row.last_name,
        row.first_name,
        d.philhealth ?? 0,
        row.gross_pay,
      ];
    });
  } else if (type === "pagibig") {
    headers = [
      "employee_code",
      "last_name",
      "first_name",
      "pagibig_ee",
      "gross_pay",
    ];
    csvRows = rows.map((row) => {
      const d = (row.deductions as Record<string, number>) ?? {};
      return [
        row.employee_code,
        row.last_name,
        row.first_name,
        d.pagibig ?? 0,
        row.gross_pay,
      ];
    });
  } else if (type === "wtax") {
    headers = [
      "employee_code",
      "last_name",
      "first_name",
      "withholding_tax",
      "gross_pay",
      "net_pay",
    ];
    csvRows = rows.map((row) => {
      const d = (row.deductions as Record<string, number>) ?? {};
      return [
        row.employee_code,
        row.last_name,
        row.first_name,
        d.withholding_tax ?? 0,
        row.gross_pay,
        row.net_pay,
      ];
    });
  } else if (type === "payslips") {
    headers = [
      "employee_code",
      "last_name",
      "first_name",
      "gross_pay",
      "sss",
      "philhealth",
      "pagibig",
      "withholding_tax",
      "loans",
      "total_deductions",
      "net_pay",
    ];
    csvRows = rows.map((row) => {
      const d = (row.deductions as Record<string, number>) ?? {};
      return [
        row.employee_code,
        row.last_name,
        row.first_name,
        row.gross_pay,
        d.sss ?? 0,
        d.philhealth ?? 0,
        d.pagibig ?? 0,
        d.withholding_tax ?? 0,
        d.loans ?? 0,
        row.total_deductions,
        row.net_pay,
      ];
    });
  } else {
    return jsonError(
      "Invalid type. Use sss, philhealth, pagibig, wtax, bank, or payslips",
      400
    );
  }

  const csv = toCsv(headers, csvRows);
  if (request.nextUrl.searchParams.get("format") === "json") {
    return jsonOk({
      data: { type, filename, headers, rows: csvRows, csv },
    });
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
