import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  generateOrganicPayslipPDF,
  organicPayslipFilename,
  type OrganicPayslipLine,
} from "@/lib/payroll-register/generate-organic-payslip-pdf";
import { deliverPayslip } from "@/lib/payroll-register/payslip-mailer";
import { payslipSendBatch, planPayslipSend } from "@/lib/payroll-register/payslip-send";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type SendRow = {
  line_id: string;
  employee_name: string;
  email: string | null;
  status: string;
  detail: string | null;
};

type RegisterLine = {
  id: string;
  directory_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  daily_rate: number | null;
  monthly_salary: number | null;
  gross_pay: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  hours: Record<string, number> | null;
  earnings: Record<string, number> | null;
  deductions: Record<string, number> | null;
  bank_name: string | null;
  bank_account_no: string | null;
};

function asPayslipLine(line: RegisterLine): OrganicPayslipLine {
  return {
    employee_code: line.employee_code,
    last_name: line.last_name,
    first_name: line.first_name,
    daily_rate: line.daily_rate,
    monthly_salary: line.monthly_salary,
    gross_pay: line.gross_pay,
    total_deductions: line.total_deductions,
    net_pay: line.net_pay,
    hours: line.hours ?? {},
    earnings: line.earnings ?? {},
    deductions: line.deductions ?? {},
    bank_name: line.bank_name,
    bank_account_no: line.bank_account_no,
  };
}

async function loadRun(orgId: string, cutoffId: string) {
  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id, status, period_start, period_end, payroll_date")
    .eq("id", cutoffId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return { ok: false as const, error: periodError.message, status: 500 };
  if (!period) return { ok: false as const, error: "Cutoff period not found", status: 404 };
  if (period.status !== "posted") {
    return { ok: false as const, error: "Post the register before sending payslips.", status: 409 };
  }
  const { data: run, error: runError } = await publicDb
    .from("payroll_register_runs")
    .select("id")
    .eq("cutoff_period_id", cutoffId)
    .eq("organization_id", orgId)
    .eq("status", "posted")
    .maybeSingle();
  if (runError) return { ok: false as const, error: runError.message, status: 500 };
  if (!run) return { ok: false as const, error: "Posted register not found", status: 404 };
  return { ok: true as const, period, run, publicDb };
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const loaded = await loadRun(orgId, params.id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);

  const { data, error } = await loaded.publicDb
    .from("payroll_payslip_sends")
    .select("line_id, employee_name, email, status, detail")
    .eq("run_id", loaded.run.id)
    .order("employee_name");
  if (error) return jsonError(error.message, 500);
  const rows = (data ?? []) as SendRow[];
  return jsonOk({
    data: {
      sent: rows.filter((row) => row.status === "sent").length,
      failed: rows.filter((row) => row.status === "failed"),
      skipped: rows.filter((row) => row.status === "skipped"),
    },
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const loaded = await loadRun(orgId, params.id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  const { period, run, publicDb } = loaded;

  const { data: lines, error: linesError } = await publicDb
    .from("payroll_register_lines")
    .select(
      "id, directory_employee_id, employee_code, last_name, first_name, daily_rate, monthly_salary, gross_pay, total_deductions, net_pay, hours, earnings, deductions, bank_name, bank_account_no",
    )
    .eq("run_id", run.id);
  if (linesError) return jsonError(linesError.message, 500);
  const registerLines = (lines ?? []) as RegisterLine[];

  const directoryIds = [
    ...new Set(
      registerLines
        .map((line) => line.directory_employee_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const emailById = new Map<string, string | null>();
  if (directoryIds.length) {
    const { data: people, error: peopleError } = await auth.supabase
      .from("employees")
      .select("id, email")
      .in("id", directoryIds);
    if (peopleError) return jsonError(peopleError.message, 500);
    for (const person of people ?? []) {
      emailById.set(person.id as string, (person.email as string | null) ?? null);
    }
  }

  const people = registerLines.map((line) => {
    const name = [line.last_name, line.first_name].filter(Boolean).join(", ") || "Employee";
    return {
      lineId: line.id,
      name,
      email: line.directory_employee_id
        ? emailById.get(line.directory_employee_id) ?? null
        : null,
    };
  });
  const lineById = new Map(registerLines.map((line) => [line.id, line]));

  const { data: previous, error: previousError } = await publicDb
    .from("payroll_payslip_sends")
    .select("line_id, status")
    .eq("run_id", run.id);
  if (previousError) return jsonError(previousError.message, 500);
  const alreadySent = (previous ?? [])
    .filter((row) => row.status === "sent")
    .map((row) => row.line_id as string);

  const batch = payslipSendBatch({
    planned: planPayslipSend(people),
    alreadySentLineIds: alreadySent,
  });
  const periodLabel = `${period.period_start} – ${period.period_end}`;
  const nowRows: SendRow[] = [];

  for (const person of batch.skipped) {
    nowRows.push({
      line_id: person.lineId,
      employee_name: person.name,
      email: person.email,
      status: "skipped",
      detail: "No email on the 201",
    });
  }
  for (const person of batch.toSend) {
    const line = lineById.get(person.lineId);
    if (!line) {
      nowRows.push({
        line_id: person.lineId,
        employee_name: person.name,
        email: person.email,
        status: "failed",
        detail: "Register line not found",
      });
      continue;
    }
    const payslipLine = asPayslipLine(line);
    const doc = generateOrganicPayslipPDF({
      periodStart: String(period.period_start),
      periodEnd: String(period.period_end),
      payrollDate: (period.payroll_date as string | null) ?? null,
      line: payslipLine,
    });
    const filename = organicPayslipFilename(
      payslipLine,
      String(period.period_start),
      String(period.period_end),
    );
    const pdfBytes = Buffer.from(doc.output("arraybuffer"));
    const delivered = await deliverPayslip({
      to: person.email ?? "",
      name: person.name,
      periodLabel,
      cutoffPeriodId: params.id,
      lineId: person.lineId,
      filename,
      pdfBytes,
    });
    nowRows.push({
      line_id: person.lineId,
      employee_name: person.name,
      email: person.email,
      status: delivered.ok ? "sent" : "failed",
      detail: delivered.ok ? null : delivered.error,
    });
  }

  if (nowRows.length) {
    const { error: writeError } = await publicDb.from("payroll_payslip_sends").upsert(
      nowRows.map((row) => ({
        run_id: run.id,
        line_id: row.line_id,
        organization_id: orgId,
        employee_name: row.employee_name,
        email: row.email,
        status: row.status,
        detail: row.detail,
      })),
      { onConflict: "run_id,line_id" },
    );
    if (writeError) return jsonError(writeError.message, 500);
  }

  return jsonOk({
    data: {
      sent: nowRows.filter((row) => row.status === "sent").length + batch.alreadySent,
      failed: nowRows.filter((row) => row.status === "failed"),
      skipped: nowRows.filter((row) => row.status === "skipped"),
      already_sent: batch.alreadySent,
    },
  });
}
