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
  buildRegisterLine,
  summarizeRegisterLines,
  type BuiltRegisterLine,
  type CutoffHoursRow,
} from "@/lib/payroll-register/compute";
import {
  sumCatchupByDirectoryEmployee,
  type CatchupCorrectionRow,
} from "@/lib/payroll-register/catchup-corrections";
import type { LoanRow } from "@/lib/ph-payroll/compute-cutoff-payslip";
import { statutoryThisCutoff } from "@/lib/ph-payroll/statutory-schedule";
import { isRegularCutoffStatus } from "@/lib/directory/cutoff-roster";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Build or refresh a draft payroll register from approved cutoff_hours.
 * POST body: { notes?: string }
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
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

  const { data: catchupRows, error: catchupError } = await publicDb
    .from("payroll_catchup_corrections")
    .select(
      "id, organization_id, client_id, source_cutoff_period_id, apply_cutoff_period_id, directory_employee_id, office_employee_id, employee_code, last_name, first_name, amount, reason, status"
    )
    .eq("apply_cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .eq("status", "pending");
  if (catchupError) return jsonError(catchupError.message, 500);

  const catchupPending = (catchupRows ?? []) as CatchupCorrectionRow[];
  const catchupByDir = sumCatchupByDirectoryEmployee(catchupPending);
  const catchupMetaByDir = new Map<string, CatchupCorrectionRow>();
  for (const row of catchupPending) {
    if (!catchupMetaByDir.has(row.directory_employee_id)) {
      catchupMetaByDir.set(row.directory_employee_id, row);
    }
  }

  const officeIds = [
    ...new Set(
      [
        ...(hours ?? []).map((row) => row.office_employee_id as string | null),
        ...catchupPending.map((row) => row.office_employee_id),
      ].filter(Boolean) as string[]
    ),
  ];
  const dirIds = [
    ...new Set(
      [
        ...(hours ?? []).map((row) => row.directory_employee_id as string | null),
        ...catchupPending.map((row) => row.directory_employee_id),
      ].filter(Boolean) as string[]
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
  const loansByDirectory = new Map<string, Array<LoanRow & { id: string }>>();

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
  }

  let loanQuery = publicDb
    .from("employee_loans")
    .select(
      "id, employee_id, directory_employee_id, loan_type, particular, monthly_payment, cutoff_assignment, deduct_bi_monthly, is_active, effectivity_date, current_balance"
    )
    .eq("is_active", true)
    .gt("current_balance", 0);
  if (officeIds.length && dirIds.length) {
    loanQuery = loanQuery.or(
      `employee_id.in.(${officeIds.join(",")}),directory_employee_id.in.(${dirIds.join(",")})`
    );
  } else if (officeIds.length) {
    loanQuery = loanQuery.in("employee_id", officeIds);
  } else if (dirIds.length) {
    loanQuery = loanQuery.in("directory_employee_id", dirIds);
  }

  const loanRows =
    officeIds.length || dirIds.length
      ? ((await loanQuery).data ?? [])
      : [];
  const scheduleByLoan = new Map<
    string,
    { id: string; amount: number }
  >();
  if (loanRows.length) {
    const { data: schedules } = await publicDb
      .from("employee_loan_schedules")
      .select("id, loan_id, amount, status")
      .in(
        "loan_id",
        loanRows.map((row) => row.id as string)
      )
      .eq("status", "pending")
      .eq("period_start", period.period_start);
    for (const row of schedules ?? []) {
      scheduleByLoan.set(row.loan_id as string, {
        id: row.id as string,
        amount: Number(row.amount) || 0,
      });
    }
  }

  const pushLoan = (
    map: Map<string, Array<LoanRow & { id: string }>>,
    key: string | null,
    loan: LoanRow & { id: string }
  ) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    if (list.some((row) => row.id === loan.id)) return;
    list.push(loan);
    map.set(key, list);
  };

  for (const loan of loanRows) {
    const scheduled = scheduleByLoan.get(loan.id as string);
    const mapped: LoanRow & { id: string } = {
      id: loan.id as string,
      loan_type: String(loan.loan_type),
      particular: (loan.particular as string | null) ?? null,
      monthly_payment: Number(loan.monthly_payment) || 0,
      cutoff_assignment: String(loan.cutoff_assignment || "both"),
      deduct_bi_monthly: loan.deduct_bi_monthly as boolean | null,
      current_balance: Number(loan.current_balance) || 0,
      effectivity_date: (loan.effectivity_date as string | null) ?? null,
      scheduled_amount: scheduled?.amount ?? null,
      schedule_id: scheduled?.id ?? null,
    };
    pushLoan(loansByEmployee, loan.employee_id as string | null, mapped);
    pushLoan(
      loansByDirectory,
      loan.directory_employee_id as string | null,
      mapped
    );
  }

  const loansForRow = (
    officeId: string | null,
    dirId: string | null
  ): Array<LoanRow & { id: string }> => {
    const merged = new Map<string, LoanRow & { id: string }>();
    for (const loan of officeId ? loansByEmployee.get(officeId) ?? [] : []) {
      merged.set(loan.id, loan);
    }
    for (const loan of dirId ? loansByDirectory.get(dirId) ?? [] : []) {
      merged.set(loan.id, loan);
    }
    return [...merged.values()];
  };

  const periodStart = new Date(`${period.period_start}T00:00:00Z`);
  const directory = directoryClient();
  const { data: clientRow } = await directory
    .from("clients")
    .select(
      "cut1_start, cut1_end, cut2_start, cut2_end, pay_frequency, statutory_schedule, wtax_schedule, include_cola, include_sea, include_ctpa"
    )
    .eq("id", period.client_id)
    .maybeSingle();
  const supplementalPolicy = {
    include_cola: Boolean(clientRow?.include_cola),
    include_sea: Boolean(clientRow?.include_sea),
    include_ctpa: Boolean(clientRow?.include_ctpa),
  };
  const statutoryFlags = statutoryThisCutoff(
    clientRow ?? {},
    String(period.period_start)
  );

  const dirPayeeById = new Map<
    string,
    {
      daily_rate: number | null;
      bank_name: string | null;
      bank_account_no: string | null;
      ecola: number | null;
      billing_daily_rate: number | null;
      position_id: string | null;
      status: string | null;
    }
  >();
  if (dirIds.length) {
    const { data: dirEmps } = await directory
      .from("employees")
      .select(
        "id, daily_rate, bank_name, bank_account_no, ecola, billing_daily_rate, position_id, status"
      )
      .in("id", dirIds);
    for (const row of dirEmps ?? []) {
      dirPayeeById.set(row.id as string, {
        daily_rate: (row.daily_rate as number | null) ?? null,
        bank_name: (row.bank_name as string | null) ?? null,
        bank_account_no: (row.bank_account_no as string | null) ?? null,
        ecola: (row.ecola as number | null) ?? null,
        billing_daily_rate: (row.billing_daily_rate as number | null) ?? null,
        position_id: (row.position_id as string | null) ?? null,
        status: (row.status as string | null) ?? null,
      });
    }
  }

  const positionIds = [
    ...new Set(
      [...dirPayeeById.values()]
        .map((row) => row.position_id)
        .filter(Boolean) as string[]
    ),
  ];
  const positionById = new Map<
    string,
    {
      ecola: number | null;
      sea: number | null;
      ctpa: number | null;
      billing_daily_rate: number | null;
    }
  >();
  if (positionIds.length) {
    const { data: positions } = await directory
      .from("positions")
      .select("id, ecola, sea, ctpa, billing_daily_rate")
      .in("id", positionIds);
    for (const row of positions ?? []) {
      positionById.set(row.id as string, {
        ecola: (row.ecola as number | null) ?? null,
        sea: (row.sea as number | null) ?? null,
        ctpa: (row.ctpa as number | null) ?? null,
        billing_daily_rate: (row.billing_daily_rate as number | null) ?? null,
      });
    }
  }

  const lines: BuiltRegisterLine[] = (hours ?? []).flatMap((row) => {
    const officeId = row.office_employee_id as string | null;
    const dirId = row.directory_employee_id as string | null;
    const officePayee = officeId ? payeeById.get(officeId) : null;
    const dirPayee = dirId ? dirPayeeById.get(dirId) : null;
    if (dirId && !isRegularCutoffStatus(dirPayee?.status ?? "")) {
      return [];
    }
    const position = dirPayee?.position_id
      ? positionById.get(dirPayee.position_id)
      : undefined;
    const adjustmentAmount = dirId ? catchupByDir.get(dirId) ?? 0 : 0;
    return [
      buildRegisterLine({
        hoursRow: row as CutoffHoursRow,
        payee: officePayee ??
          (dirPayee
            ? {
                id: dirId ?? "",
                daily_rate: dirPayee.daily_rate,
                bank_name: dirPayee.bank_name,
                bank_account_no: dirPayee.bank_account_no,
              }
            : null),
        loans: loansForRow(officeId, dirId),
        periodStart,
        statutory: statutoryFlags,
        adjustmentAmount,
        supplementalPolicy,
        supplementalRates: {
          employee_ecola: dirPayee?.ecola,
          employee_billing_daily_rate: dirPayee?.billing_daily_rate,
          position_ecola: position?.ecola,
          position_sea: position?.sea,
          position_ctpa: position?.ctpa,
          position_billing_daily_rate: position?.billing_daily_rate,
        },
      }),
    ];
  });

  const hoursDirIds = new Set(
    lines
      .map((line) => line.directory_employee_id)
      .filter(Boolean) as string[]
  );
  for (const [dirId, amount] of catchupByDir) {
    if (!dirId || hoursDirIds.has(dirId) || amount === 0) continue;
    const meta = catchupMetaByDir.get(dirId);
    const officeId = meta?.office_employee_id ?? null;
    const officePayee = officeId ? payeeById.get(officeId) : null;
    const dirPayee = dirPayeeById.get(dirId);
    if (!isRegularCutoffStatus(dirPayee?.status ?? "")) continue;
    lines.push(
      buildRegisterLine({
        hoursRow: {
          id: `catchup-${dirId}`,
          directory_employee_id: dirId,
          office_employee_id: officeId,
          employee_code: meta?.employee_code ?? null,
          last_name: meta?.last_name ?? null,
          first_name: meta?.first_name ?? null,
          daily_rate_payroll:
            officePayee?.daily_rate ?? dirPayee?.daily_rate ?? 0,
          actual_regular_hours: 0,
        },
        payee: officePayee ??
          (dirPayee
            ? {
                id: dirId,
                daily_rate: dirPayee.daily_rate,
                bank_name: dirPayee.bank_name,
                bank_account_no: dirPayee.bank_account_no,
              }
            : null),
        loans: loansForRow(officeId, dirId),
        periodStart,
        statutory: statutoryFlags,
        adjustmentAmount: amount,
        supplementalPolicy,
      })
    );
  }

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
      catchup_pending_count: catchupPending.length,
    },
  });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const lineId = request.nextUrl.searchParams.get("line_id")?.trim();
  const officeEmployeeId = request.nextUrl.searchParams
    .get("office_employee_id")
    ?.trim();
  const payFilterRaw = request.nextUrl.searchParams.get("pay_filter")?.trim();
  const payFilter =
    payFilterRaw === "deductions" ||
    payFilterRaw === "zero_deductions" ||
    payFilterRaw === "loans"
      ? payFilterRaw
      : "all";
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
    .order("last_name");

  if (lineId) {
    linesQuery = linesQuery.eq("id", lineId);
  } else if (officeEmployeeId) {
    linesQuery = linesQuery.eq("office_employee_id", officeEmployeeId);
  } else {
    if (q) {
      linesQuery = linesQuery.or(
        `last_name.ilike.%${q}%,first_name.ilike.%${q}%,employee_code.ilike.%${q}%`
      );
    }
    if (payFilter === "deductions") {
      linesQuery = linesQuery.gt("total_deductions", 0);
    } else if (payFilter === "zero_deductions") {
      linesQuery = linesQuery.eq("total_deductions", 0);
    } else if (payFilter === "loans") {
      linesQuery = linesQuery.gt("deductions->>loans", "0");
    }
    linesQuery = linesQuery.range(offset, offset + limit - 1);
  }

  const { data: lines, error: linesError, count } = await linesQuery;
  if (linesError) return jsonError(linesError.message, 500);

  return jsonOk({
    data: {
      run,
      lines: lines ?? [],
      count: count ?? lines?.length ?? 0,
      limit: lineId || officeEmployeeId ? lines?.length ?? 0 : limit,
      offset: lineId || officeEmployeeId ? 0 : offset,
      pay_filter: payFilter,
    },
  });
}
