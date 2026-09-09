import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { todayYmdManila } from "@/lib/directory/client-pay-calendar";
import {
  computeBillingLine,
  registerIsBillable,
  resolveBillingDailyRate,
  wrapBillingSoa,
} from "@/lib/client-billing/compute";
import { mergeBillingFeesWithExpenses } from "@/lib/client-billing/expenses";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type RegisterLineRow = {
  id: string;
  directory_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  hours: Record<string, unknown> | null;
  earnings: Record<string, unknown> | null;
  deductions: Record<string, unknown> | null;
};

async function loadAllRegisterLines(
  publicDb: ReturnType<typeof publicDbClient>,
  runId: string
): Promise<RegisterLineRow[]> {
  const rows: RegisterLineRow[] = [];
  const page = 200;
  for (let offset = 0; ; offset += page) {
    const { data, error } = await publicDb
      .from("payroll_register_lines")
      .select(
        "id, directory_employee_id, employee_code, last_name, first_name, hours, earnings, deductions"
      )
      .eq("run_id", runId)
      .order("last_name")
      .range(offset, offset + page - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as RegisterLineRow[];
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const billed = request.nextUrl.searchParams.get("billed")?.trim();
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0);

  const publicDb = publicDbClient();
  const { data: run, error } = await publicDb
    .from("billing_runs")
    .select("*")
    .eq("cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .eq("status", "processed")
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!run) return jsonOk({ data: { run: null, lines: [], count: 0, limit, offset } });

  let linesQuery = publicDb
    .from("billing_lines")
    .select("*", { count: "exact" })
    .eq("run_id", run.id)
    .order("last_name")
    .range(offset, offset + limit - 1);

  if (q) {
    linesQuery = linesQuery.or(
      `last_name.ilike.%${q}%,first_name.ilike.%${q}%,employee_code.ilike.%${q}%`
    );
  }
  if (billed === "yes") linesQuery = linesQuery.gt("labor", 0);
  if (billed === "no") linesQuery = linesQuery.eq("labor", 0);

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

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = ((await request.json().catch(() => ({}))) ?? {}) as {
    billing_date?: string | null;
    notes?: string | null;
  };

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id, organization_id, client_id, period_start, period_end, status")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);
  if (period.status !== "posted") {
    return jsonError("Bill the client only after payroll is posted", 409);
  }

  const { data: existing } = await publicDb
    .from("billing_runs")
    .select("id")
    .eq("cutoff_period_id", params.id)
    .eq("status", "processed")
    .maybeSingle();
  if (existing) {
    return jsonError(
      "Billing already processed for this cutoff. Cancel it first to rebuild.",
      409
    );
  }

  const { data: payrollRun, error: payrollError } = await publicDb
    .from("payroll_register_runs")
    .select("id, status")
    .eq("cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (payrollError) return jsonError(payrollError.message, 500);
  if (!payrollRun || payrollRun.status !== "posted") {
    return jsonError("Posted payroll register not found", 409);
  }

  let registerLines: RegisterLineRow[];
  try {
    registerLines = await loadAllRegisterLines(publicDb, payrollRun.id as string);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to load register lines",
      500
    );
  }

  const directoryIds = [
    ...new Set(
      registerLines
        .map((line) => line.directory_employee_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const personById = new Map<
    string,
    { billing_daily_rate: number; position_id: string | null }
  >();
  const positionById = new Map<string, number>();
  if (directoryIds.length) {
    const { data: people, error: peopleError } = await auth.supabase
      .from("employees")
      .select("id, billing_daily_rate, position_id")
      .in("id", directoryIds);
    if (peopleError) return jsonError(peopleError.message, 500);
    const positionIds = [
      ...new Set(
        (people ?? [])
          .map((row) => (row.position_id as string | null)?.trim())
          .filter((id): id is string => Boolean(id))
      ),
    ];
    for (const row of people ?? []) {
      personById.set(row.id as string, {
        billing_daily_rate: n(row.billing_daily_rate),
        position_id: (row.position_id as string | null) ?? null,
      });
    }
    if (positionIds.length) {
      const { data: positions, error: positionError } = await auth.supabase
        .from("positions")
        .select("id, billing_daily_rate")
        .in("id", positionIds);
      if (positionError) return jsonError(positionError.message, 500);
      for (const row of positions ?? []) {
        positionById.set(row.id as string, n(row.billing_daily_rate));
      }
    }
  }

  const computed = registerLines.map((line) => {
    const person = line.directory_employee_id
      ? personById.get(line.directory_employee_id)
      : undefined;
    const billingDaily = resolveBillingDailyRate({
      register_billing_daily_rate: n(line.earnings?.billing_daily_rate),
      employee_billing_daily_rate: person?.billing_daily_rate,
      position_billing_daily_rate: person?.position_id
        ? positionById.get(person.position_id)
        : 0,
    });
    const result = computeBillingLine({
      hours: (line.hours ?? {}) as Record<string, unknown>,
      billing_daily_rate: billingDaily,
      allowance: n(line.earnings?.allowance),
      mandatories: {
        sss_er: n(line.deductions?.sss_er),
        philhealth_er: n(line.deductions?.philhealth_er),
        pagibig_er: n(line.deductions?.pagibig_er),
        sss_ecc: n(line.deductions?.sss_ecc),
      },
    });
    return { line, result };
  });

  if (!registerIsBillable(computed.map((row) => row.result))) {
    return jsonError(
      "No billing daily rates on this register. Set billing rates on Directory people or positions. Organic house payroll is not billed.",
      409
    );
  }

  const { data: client, error: clientError } = await auth.supabase
    .from("clients")
    .select("id, admin_fee, vat, ewt")
    .eq("id", period.client_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found", 404);

  const labor = computed.reduce((acc, row) => acc + row.result.labor, 0);
  const mandatories = computed.reduce((acc, row) => acc + row.result.mandatories, 0);
  const soa = wrapBillingSoa({
    labor,
    mandatories,
    admin_fee: client.admin_fee,
    vat: client.vat,
    ewt: client.ewt,
  });

  const billingDate = (body.billing_date || todayYmdManila()).slice(0, 10);
  const billingReference = `BILL-${String(period.period_start).slice(0, 10)}-${String(period.period_end).slice(0, 10)}`;

  const { data: created, error: createError } = await publicDb
    .from("billing_runs")
    .insert({
      cutoff_period_id: params.id,
      payroll_register_run_id: payrollRun.id,
      organization_id: orgId,
      client_id: period.client_id,
      status: "processed",
      billing_reference: billingReference,
      billing_date: billingDate,
      line_count: computed.length,
      fees: {
        admin_fee: soa.admin_fee_rate,
        vat: soa.vat_rate,
        ewt: soa.ewt_rate,
      },
      totals: soa,
      notes: body.notes ?? null,
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (createError) {
    if (createError.code === "23505") {
      return jsonError(
        "Billing already processed for this cutoff. Cancel it first to rebuild.",
        409
      );
    }
    return jsonError(createError.message, 400);
  }

  if (computed.length) {
    const { error: lineError } = await publicDb.from("billing_lines").insert(
      computed.map(({ line, result }) => ({
        run_id: created.id,
        cutoff_period_id: params.id,
        organization_id: orgId,
        client_id: period.client_id,
        source_register_line_id: line.id,
        directory_employee_id: line.directory_employee_id,
        employee_code: line.employee_code,
        last_name: line.last_name,
        first_name: line.first_name,
        billing_daily_rate: result.billing_daily_rate,
        billing_hourly_rate: result.billing_hourly_rate,
        hours: result.hours,
        amounts: result.amounts,
        labor: result.labor,
        mandatories: result.mandatories,
        billable: result.billable,
      }))
    );
    if (lineError) {
      await publicDb.from("billing_runs").delete().eq("id", created.id);
      return jsonError(lineError.message, 400);
    }
  }

  return jsonOk({ data: { run: created, totals: soa, line_count: computed.length } }, 201);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = ((await request.json().catch(() => ({}))) ?? {}) as {
    status?: string;
    expenses?: Array<{ particular?: unknown; amount?: unknown }>;
  };

  const publicDb = publicDbClient();

  if (Array.isArray(body.expenses)) {
    const { data: run, error } = await publicDb
      .from("billing_runs")
      .select("id, status, fees")
      .eq("cutoff_period_id", params.id)
      .eq("organization_id", orgId)
      .eq("status", "processed")
      .maybeSingle();
    if (error) return jsonError(error.message, 500);
    if (!run) return jsonError("No processed billing to update", 404);

    const fees = mergeBillingFeesWithExpenses(
      (run.fees ?? {}) as Record<string, unknown>,
      body.expenses
    );
    const { data: updated, error: updError } = await publicDb
      .from("billing_runs")
      .update({
        fees,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .select("*")
      .single();
    if (updError) return jsonError(updError.message, 400);
    return jsonOk({ data: { run: updated } });
  }

  if (body.status !== "cancelled") {
    return jsonError("Pass expenses=[]… or status=cancelled", 400);
  }

  const { data: run, error } = await publicDb
    .from("billing_runs")
    .select("id, status")
    .eq("cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .eq("status", "processed")
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!run) return jsonError("No processed billing to cancel", 404);

  const { data: updated, error: updError } = await publicDb
    .from("billing_runs")
    .update({
      status: "cancelled",
      cancelled_by: auth.userId,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select("*")
    .single();
  if (updError) return jsonError(updError.message, 400);

  return jsonOk({ data: { run: updated } });
}
