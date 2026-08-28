import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  type CutoffIngestBody,
  normalizeHoursRow,
} from "@/lib/timekeeping/cutoff-types";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import {
  collectEmployeeIds,
  validateDirectoryEmployeesInClient,
} from "@/lib/timekeeping/validate-cutoff-ingest";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as CutoffIngestBody;
  const hours = body.hours ?? [];
  const punches = body.punches ?? [];

  if (!hours.length && !punches.length) {
    return jsonError("hours or punches array is required", 400);
  }

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id, organization_id, client_id, status")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  if (period.status === "posted") {
    return jsonError("Cannot ingest into a posted cutoff period", 409);
  }

  const employeeCheck = await validateDirectoryEmployeesInClient(
    auth.supabase,
    orgId,
    period.client_id as string,
    collectEmployeeIds(hours, punches)
  );
  if (!employeeCheck.ok) return jsonError(employeeCheck.message, 400);

  if (body.replace_existing) {
    if (hours.length) {
      const hourEmpIds = [...new Set(hours.map((h) => h.directory_employee_id))];
      const { error } = await publicDb
        .from("cutoff_hours")
        .delete()
        .eq("cutoff_period_id", period.id)
        .in("directory_employee_id", hourEmpIds);
      if (error) return jsonError(error.message, 400);
    }
    if (punches.length) {
      const punchEmpIds = [
        ...new Set(punches.map((p) => p.directory_employee_id)),
      ];
      const workDates = [...new Set(punches.map((p) => p.work_date))];
      const { error } = await publicDb
        .from("cutoff_dtr_punches")
        .delete()
        .eq("cutoff_period_id", period.id)
        .in("directory_employee_id", punchEmpIds)
        .in("work_date", workDates);
      if (error) return jsonError(error.message, 400);
    }
  }

  let hoursUpserted = 0;
  let punchesUpserted = 0;

  if (hours.length) {
    const rows = hours.map((row) => ({
      ...normalizeHoursRow(row),
      cutoff_period_id: period.id,
      organization_id: orgId,
      client_id: period.client_id,
    }));

    const { error } = await publicDb.from("cutoff_hours").upsert(rows, {
      onConflict: "cutoff_period_id,directory_employee_id",
    });
    if (error) return jsonError(error.message, 400);
    hoursUpserted = rows.length;
  }

  if (punches.length) {
    const rows = punches.map((row) => ({
      cutoff_period_id: period.id,
      organization_id: orgId,
      client_id: period.client_id,
      directory_employee_id: row.directory_employee_id,
      work_date: row.work_date,
      clock_in: row.clock_in ?? null,
      clock_out: row.clock_out ?? null,
      break_minutes: row.break_minutes ?? 0,
      source: row.source ?? "timekeeping_app",
      remarks: row.remarks ?? null,
      legacy_row_id: row.legacy_row_id ?? null,
    }));

    const { error } = await publicDb.from("cutoff_dtr_punches").upsert(rows, {
      onConflict: "cutoff_period_id,directory_employee_id,work_date",
    });
    if (error) return jsonError(error.message, 400);
    punchesUpserted = rows.length;
  }

  return jsonOk({
    data: {
      cutoff_period_id: period.id,
      hours_upserted: hoursUpserted,
      punches_upserted: punchesUpserted,
    },
  });
}
