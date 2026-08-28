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

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();
  const tkStatus = searchParams.get("tk_status");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

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
      "Payroll register is available only after cutoff approval",
      409
    );
  }

  let hoursQuery = publicDb
    .from("cutoff_hours")
    .select(
      "id, employee_code, last_name, first_name, actual_regular_hours, hours_work, overtime_hours, night_diff_hours, tardiness_hours, undertime_hours, absences_hours, daily_rate_payroll, allowance, tk_status, source_of_data, office_employee_id, directory_employee_id",
      { count: "exact" }
    )
    .eq("cutoff_period_id", params.id)
    .order("last_name")
    .order("first_name")
    .range(offset, offset + limit - 1);

  if (tkStatus) hoursQuery = hoursQuery.eq("tk_status", tkStatus);
  if (q) {
    hoursQuery = hoursQuery.or(
      `last_name.ilike.%${q}%,first_name.ilike.%${q}%,employee_code.ilike.%${q}%`
    );
  }

  const { data: hours, error: hoursError, count } = await hoursQuery;
  if (hoursError) return jsonError(hoursError.message, 500);

  const lines = (hours ?? []).map((row) => {
    const dailyRate =
      row.daily_rate_payroll != null ? Number(row.daily_rate_payroll) : null;
    const regHours = Number(row.actual_regular_hours ?? 0);
    const grossEstimate =
      dailyRate != null ? Math.round(dailyRate * regHours * 100) / 100 : null;

    return {
      employee_code: row.employee_code,
      name: [row.last_name, row.first_name].filter(Boolean).join(", "),
      actual_regular_hours: row.actual_regular_hours,
      hours_work: row.hours_work,
      overtime_hours: row.overtime_hours,
      night_diff_hours: row.night_diff_hours,
      tardiness_hours: row.tardiness_hours,
      undertime_hours: row.undertime_hours,
      absences_hours: row.absences_hours,
      daily_rate_payroll: row.daily_rate_payroll,
      allowance: row.allowance,
      gross_estimate: grossEstimate,
      tk_status: row.tk_status,
      source_of_data: row.source_of_data,
      office_employee_id: row.office_employee_id,
      directory_employee_id: row.directory_employee_id,
    };
  });

  const totals = lines.reduce(
    (acc, line) => {
      acc.actual_regular_hours += Number(line.actual_regular_hours ?? 0);
      acc.hours_work += Number(line.hours_work ?? 0);
      acc.overtime_hours += Number(line.overtime_hours ?? 0);
      if (line.gross_estimate != null) acc.gross_estimate += line.gross_estimate;
      return acc;
    },
    {
      actual_regular_hours: 0,
      hours_work: 0,
      overtime_hours: 0,
      gross_estimate: 0,
    }
  );

  return jsonOk({
    data: {
      period,
      line_count: count ?? lines.length,
      page_line_count: lines.length,
      limit,
      offset,
      totals,
      lines,
    },
  });
}
