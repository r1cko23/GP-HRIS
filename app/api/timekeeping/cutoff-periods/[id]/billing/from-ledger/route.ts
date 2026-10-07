import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { todayYmdManila } from "@/lib/directory/client-pay-calendar";
import { wrapBillingSoa } from "@/lib/client-billing/compute";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const organizationId = await requireAuthorizedOrganization(auth);
  if (typeof organizationId !== "string") return organizationId;
  const body = (await request.json().catch(() => ({}))) as {
    billing_date?: string;
    notes?: string;
  };
  const db = publicDbClient();

  const { data: period, error: periodError } = await db
    .from("cutoff_periods")
    .select("id,client_id,period_start,period_end,status")
    .eq("id", params.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);
  if (period.status !== "posted") {
    return jsonError("Payroll must be posted before invoice release", 409);
  }
  const { data: existing } = await db
    .from("billing_runs")
    .select("id")
    .eq("cutoff_period_id", params.id)
    .eq("status", "processed")
    .maybeSingle();
  if (existing) return jsonError("Billing is already processed", 409);

  const [{ data: payrollRun }, { data: snapshot }] = await Promise.all([
    db
      .from("payroll_register_runs")
      .select("id,status")
      .eq("cutoff_period_id", params.id)
      .eq("status", "posted")
      .maybeSingle(),
    db
      .from("approved_work_snapshots")
      .select("id")
      .eq("cutoff_period_id", params.id)
      .eq("organization_id", organizationId)
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!payrollRun) return jsonError("Posted payroll register not found", 409);
  if (!snapshot) return jsonError("Approved Work snapshot not found", 409);

  const { data: batch, error: batchError } = await db
    .from("billable_charge_batches")
    .select("id,status")
    .eq("approved_work_snapshot_id", snapshot.id)
    .in("status", ["draft", "approved"])
    .order("batch_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (batchError) return jsonError(batchError.message, 500);
  if (!batch) return jsonError("Billable charge batch not found", 409);

  const { data: chargeLines, error: chargeError } = await db
    .from("billable_charge_lines")
    .select(
      "id,approved_work_line_id,directory_employee_id,employee_code,last_name,first_name,quantity,rate,total_amount"
    )
    .eq("batch_id", batch.id)
    .order("last_name");
  if (chargeError) return jsonError(chargeError.message, 500);
  if (!chargeLines?.length) return jsonError("No billable charges to invoice", 409);

  const workIds = chargeLines.map((line) => line.approved_work_line_id);
  const { data: workLines, error: workError } = await db
    .from("approved_work_lines")
    .select("id,approved_hours")
    .in("id", workIds);
  if (workError) return jsonError(workError.message, 500);
  const hoursById = new Map(
    (workLines ?? []).map((line) => [String(line.id), line.approved_hours])
  );

  const { data: client, error: clientError } = await auth.supabase
    .from("clients")
    .select("admin_fee,vat,ewt")
    .eq("id", period.client_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found", 404);

  const labor = chargeLines.reduce(
    (sum, line) => sum + Number(line.total_amount ?? 0),
    0
  );
  const soa = wrapBillingSoa({
    labor,
    mandatories: 0,
    admin_fee: client.admin_fee,
    vat: client.vat,
    ewt: client.ewt,
  });
  const billingDate = (body.billing_date || todayYmdManila()).slice(0, 10);
  const reference = `BILL-${String(period.period_start).slice(0, 10)}-${String(period.period_end).slice(0, 10)}`;

  const { data: created, error: createError } = await db
    .from("billing_runs")
    .insert({
      cutoff_period_id: params.id,
      payroll_register_run_id: payrollRun.id,
      billable_charge_batch_id: batch.id,
      organization_id: organizationId,
      client_id: period.client_id,
      status: "processed",
      billing_reference: reference,
      billing_date: billingDate,
      line_count: chargeLines.length,
      fees: {
        admin_fee: soa.admin_fee_rate,
        vat: soa.vat_rate,
        ewt: soa.ewt_rate,
      },
      totals: soa,
      notes: body.notes?.trim() || null,
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (createError) return jsonError(createError.message, 400);

  const { error: lineError } = await db.from("billing_lines").insert(
    chargeLines.map((line) => ({
      run_id: created.id,
      cutoff_period_id: params.id,
      organization_id: organizationId,
      client_id: period.client_id,
      source_billable_charge_line_id: line.id,
      directory_employee_id: line.directory_employee_id,
      employee_code: line.employee_code,
      last_name: line.last_name,
      first_name: line.first_name,
      billing_daily_rate: Number(line.rate ?? 0) * 8,
      billing_hourly_rate: Number(line.rate ?? 0),
      hours: hoursById.get(String(line.approved_work_line_id)) ?? {},
      amounts: { labor: Number(line.total_amount ?? 0) },
      labor: Number(line.total_amount ?? 0),
      mandatories: 0,
      billable: Number(line.total_amount ?? 0),
    }))
  );
  if (lineError) {
    await db.from("billing_runs").delete().eq("id", created.id);
    return jsonError(lineError.message, 400);
  }

  const { error: postError } = await db
    .from("billable_charge_batches")
    .update({
      status: "posted",
      posted_by: auth.userId,
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch.id)
    .in("status", ["draft", "approved"]);
  if (postError) {
    await db.from("billing_runs").delete().eq("id", created.id);
    return jsonError(postError.message, 500);
  }

  return jsonOk(
    { data: { run: created, totals: soa, line_count: chargeLines.length } },
    201
  );
}
