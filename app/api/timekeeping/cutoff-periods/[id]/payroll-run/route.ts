import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import {
  buildRegisterLine,
  summarizeRegisterLines,
  type CutoffHoursRow,
} from "@/lib/payroll-register/compute";
import type { LoanRow } from "@/lib/ph-payroll/compute-cutoff-payslip";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Build or refresh a draft payroll register from approved cutoff_hours.
 * POST body: { notes?: string }
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = ((await request.json().catch(() => ({}))) ?? {}) as {
    notes?: string | null;
  };
  const publicDb = publicDbClient();

  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);
  if (period.status !== "approved" && period.status !== "posted") {
    return jsonError(
      "Register can only be built after cutoff is approved",
      409
    );
  }

  const { data: existingRun } = await publicDb
    .from("payroll_register_runs")
    .select("id, status")
    .eq("cutoff_period_id", params.id)
    .maybeSingle();

  if (existingRun?.status === "posted") {
    return jsonError("Register already posted for this cutoff", 409);
  }

  const { data: hours, error: hoursError } = await publicDb
    .from("cutoff_hours")
    .select("*")
    .eq("cutoff_period_id", params.id)
    .order("last_name");
  if (hoursError) return jsonError(hoursError.message, 500);

  const officeIds = [
    ...new Set(
      (hours ?? [])
        .map((row) => row.office_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const payeeById = new Map<
    string,
    {
      id: string;
      monthly_rate: number | null;
      per_day: number | null;
      daily_rate: number | null;
      bank_name: string | null;
      bank_account_no: string | null;
    }
  >();
  const loansByEmployee = new Map<string, Array<LoanRow & { id: string }>>();

  if (officeIds.length) {
    const { data: payees } = await publicDb
      .from("employees")
      .select(
        "id, monthly_rate, per_day, daily_rate, bank_name, bank_account_no"
      )
      .in("id", officeIds);
    for (const row of payees ?? []) {
      payeeById.set(row.id as string, row as never);
    }

    const { data: loans } = await publicDb
      .from("employee_loans")
      .select(
        "id, employee_id, loan_type, monthly_payment, cutoff_assignment, deduct_bi_monthly, is_active, effectivity_date"
      )
      .in("employee_id", officeIds)
      .eq("is_active", true);
    for (const loan of loans ?? []) {
      const empId = loan.employee_id as string;
      const list = loansByEmployee.get(empId) ?? [];
      list.push({
        id: loan.id as string,
        loan_type: String(loan.loan_type),
        monthly_payment: Number(loan.monthly_payment) || 0,
        cutoff_assignment: String(loan.cutoff_assignment || "both"),
        deduct_bi_monthly: loan.deduct_bi_monthly as boolean | null,
      });
      loansByEmployee.set(empId, list);
    }
  }

  const periodStart = new Date(`${period.period_start}T00:00:00Z`);
  const lines = (hours ?? []).map((row) => {
    const officeId = row.office_employee_id as string | null;
    return buildRegisterLine({
      hoursRow: row as CutoffHoursRow,
      payee: officeId ? payeeById.get(officeId) : null,
      loans: officeId ? loansByEmployee.get(officeId) ?? [] : [],
      periodStart,
    });
  });

  const totals = summarizeRegisterLines(lines);

  let runId = existingRun?.id as string | undefined;
  if (runId) {
    await publicDb.from("payroll_register_lines").delete().eq("run_id", runId);
    const { error: updError } = await publicDb
      .from("payroll_register_runs")
      .update({
        status: "draft",
        period_start: period.period_start,
        period_end: period.period_end,
        payroll_date: period.payroll_date,
        line_count: lines.length,
        totals,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (updError) return jsonError(updError.message, 400);
  } else {
    const { data: created, error: createError } = await publicDb
      .from("payroll_register_runs")
      .insert({
        cutoff_period_id: params.id,
        organization_id: orgId,
        client_id: period.client_id,
        status: "draft",
        period_start: period.period_start,
        period_end: period.period_end,
        payroll_date: period.payroll_date,
        line_count: lines.length,
        totals,
        notes: body.notes ?? null,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    if (createError) return jsonError(createError.message, 400);
    runId = created.id as string;
  }

  if (lines.length) {
    const { error: lineError } = await publicDb
      .from("payroll_register_lines")
      .insert(
        lines.map((line) => ({
          run_id: runId,
          cutoff_period_id: params.id,
          organization_id: orgId,
          client_id: period.client_id,
          ...line,
        }))
      );
    if (lineError) return jsonError(lineError.message, 400);
  }

  const { data: run } = await publicDb
    .from("payroll_register_runs")
    .select("*")
    .eq("id", runId!)
    .single();

  return jsonOk({
    data: {
      run,
      totals,
      line_count: lines.length,
    },
  });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0);

  const publicDb = publicDbClient();
  const { data: run, error } = await publicDb
    .from("payroll_register_runs")
    .select("*")
    .eq("cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!run) return jsonOk({ data: null });

  let linesQuery = publicDb
    .from("payroll_register_lines")
    .select("*", { count: "exact" })
    .eq("run_id", run.id)
    .order("last_name")
    .range(offset, offset + limit - 1);
  if (q) {
    linesQuery = linesQuery.or(
      `last_name.ilike.%${q}%,first_name.ilike.%${q}%,employee_code.ilike.%${q}%`
    );
  }
  const { data: lines, error: linesError, count } = await linesQuery;
  if (linesError) return jsonError(linesError.message, 500);

  return jsonOk({
    data: {
      run,
      lines: lines ?? [],
      count: count ?? 0,
      limit,
      offset,
    },
  });
}
