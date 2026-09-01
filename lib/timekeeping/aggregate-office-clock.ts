import type { SupabaseClient } from "@supabase/supabase-js";
import { isCutoffRosterRow } from "@/lib/directory/cutoff-roster";
import { normalizeHoursRow, type CutoffHoursIngestRow } from "./cutoff-types";
import {
  computeOfficeRegularHoursForCutoff,
  loadApprovedLeaveRows,
  loadApprovedOtByEmployee,
  loadEmployeeSchedules,
} from "./office-cutoff-hours-from-clock";

type DirectoryRosterRow = {
  id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  status: string;
  hire_date: string | null;
  resign_date: string | null;
  daily_rate: number | null;
  branch_id: string | null;
  position_id: string | null;
  is_current_engagement: boolean | null;
  position?: { job_title?: string | null } | Array<{ job_title?: string | null }> | null;
};

function positionTitle(
  position: DirectoryRosterRow["position"]
): string | null {
  if (!position) return null;
  if (Array.isArray(position)) return position[0]?.job_title ?? null;
  return position.job_title ?? null;
}

type OfficeEmployeeRow = {
  id: string;
  employee_code: string | null;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  daily_rate: number | null;
  per_day: number | null;
  directory_employee_id: string | null;
  directory_client_id: string | null;
  employee_type?: string | null;
  position?: string | null;
  job_level?: string | null;
  hire_date?: string | null;
  resign_date?: string | null;
};

type ClockEntryRow = {
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_night_diff_hours: number | null;
  status: string;
};

type HolidayRow = {
  holiday_date: string;
  holiday_type: "regular" | "non-working" | string;
};

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export type AggregateOfficeClockResult = {
  hours_upserted: number;
  punches_upserted: number;
  employees_skipped: number;
  roster_count: number;
  unenrolled: number;
};

/**
 * Aggregate Clock punches into cutoff hours for the Cutoff roster
 * (Engagements overlapping this period). Bundy is how they punch, not who is paid.
 */
export async function aggregateOfficeClockIntoCutoff(
  publicDb: SupabaseClient,
  directoryDb: SupabaseClient,
  period: {
    id: string;
    organization_id: string;
    client_id: string;
    period_start: string;
    period_end: string;
    status: string;
  },
  replaceExisting: boolean
): Promise<AggregateOfficeClockResult> {
  if (period.status !== "draft" && period.status !== "pending_audit") {
    throw new Error(
      "Office clock aggregation is only allowed while the cutoff is draft or pending audit"
    );
  }

  const periodStart = `${period.period_start}T00:00:00.000Z`;
  const periodEndExclusive = new Date(`${period.period_end}T00:00:00.000Z`);
  periodEndExclusive.setUTCDate(periodEndExclusive.getUTCDate() + 1);
  const periodEndIso = periodEndExclusive.toISOString();

  const { data: directoryRows, error: rosterError } = await directoryDb
    .from("employees")
    .select(
      "id, employee_code, last_name, first_name, status, hire_date, resign_date, daily_rate, branch_id, position_id, is_current_engagement, position:positions(job_title)"
    )
    .eq("organization_id", period.organization_id)
    .eq("client_id", period.client_id)
    .eq("status", "active");

  if (rosterError) throw new Error(rosterError.message);

  const roster = ((directoryRows ?? []) as DirectoryRosterRow[]).filter((row) =>
    isCutoffRosterRow(row, period.period_start, period.period_end)
  );
  if (!roster.length) {
    return {
      hours_upserted: 0,
      punches_upserted: 0,
      employees_skipped: 0,
      roster_count: 0,
      unenrolled: 0,
    };
  }

  const rosterIds = roster.map((row) => row.id);
  const { data: officeEmployees, error: empError } = await publicDb
    .from("employees")
    .select(
      "id, employee_code, employee_id, first_name, last_name, daily_rate, per_day, directory_employee_id, directory_client_id, employee_type, position, job_level, hire_date, resign_date"
    )
    .in("directory_employee_id", rosterIds);

  if (empError) throw new Error(empError.message);

  const officeByDirectory = new Map<string, OfficeEmployeeRow>();
  for (const emp of (officeEmployees ?? []) as OfficeEmployeeRow[]) {
    const dirId = emp.directory_employee_id;
    if (!dirId) continue;
    if (!officeByDirectory.has(dirId)) officeByDirectory.set(dirId, emp);
  }

  const linked = [...officeByDirectory.values()];
  const officeIds = linked.map((e) => e.id);
  const unenrolled = roster.filter((row) => !officeByDirectory.has(row.id)).length;

  let entries: ClockEntryRow[] = [];
  if (officeIds.length) {
    const { data: clockRows, error: clockError } = await publicDb
      .from("time_clock_entries")
      .select(
        "employee_id, clock_in_time, clock_out_time, total_hours, regular_hours, overtime_hours, total_night_diff_hours, status"
      )
      .in("employee_id", officeIds)
      .gte("clock_in_time", periodStart)
      .lt("clock_in_time", periodEndIso)
      .not("clock_out_time", "is", null)
      .in("status", ["clocked_out", "approved", "auto_approved"]);
    if (clockError) throw new Error(clockError.message);
    entries = (clockRows ?? []) as ClockEntryRow[];
  }

  const { data: holidays } = await publicDb
    .from("holidays")
    .select("holiday_date, holiday_type")
    .eq("is_active", true)
    .gte("holiday_date", period.period_start)
    .lte("holiday_date", period.period_end);

  const otByEmployee = await loadApprovedOtByEmployee(
    publicDb,
    officeIds,
    period.period_start,
    period.period_end
  );

  const leaveByEmployee = await loadApprovedLeaveRows(
    publicDb,
    officeIds,
    period.period_start,
    period.period_end
  );

  const schedulesByEmployee = await loadEmployeeSchedules(
    publicDb,
    officeIds,
    period.period_start,
    period.period_end
  );

  const ptoByEmployee = new Map<string, number>();
  for (const [empId, leaves] of leaveByEmployee) {
    let pto = 0;
    for (const leave of leaves) {
      const start = String(leave.start_date).slice(0, 10);
      const end = String(leave.end_date ?? start).slice(0, 10);
      if (end < period.period_start || start > period.period_end) continue;
      const overlapStart =
        start < period.period_start ? period.period_start : start;
      const overlapEnd = end > period.period_end ? period.period_end : end;
      const days =
        Math.floor(
          (new Date(`${overlapEnd}T00:00:00Z`).getTime() -
            new Date(`${overlapStart}T00:00:00Z`).getTime()) /
            (24 * 60 * 60 * 1000)
        ) + 1;
      const half = Boolean(leave.half_day_dates?.length);
      pto += Math.max(0, days) * (half ? 4 : 8);
    }
    if (pto > 0) ptoByEmployee.set(empId, pto);
  }

  const periodStartDate = new Date(`${period.period_start}T00:00:00.000Z`);
  const periodEndDate = new Date(`${period.period_end}T00:00:00.000Z`);

  const byEmployee = new Map<string, ClockEntryRow[]>();
  for (const row of (entries ?? []) as ClockEntryRow[]) {
    const list = byEmployee.get(row.employee_id) ?? [];
    list.push(row);
    byEmployee.set(row.employee_id, list);
  }

  if (replaceExisting) {
    await publicDb
      .from("cutoff_dtr_punches")
      .delete()
      .eq("cutoff_period_id", period.id);
    await publicDb.from("cutoff_hours").delete().eq("cutoff_period_id", period.id);
  }

  const hourRows: Record<string, unknown>[] = [];
  const punchRows: Record<string, unknown>[] = [];

  for (const person of roster) {
    const emp = officeByDirectory.get(person.id) ?? null;
    const empEntries = emp ? byEmployee.get(emp.id) ?? [] : [];
    const dailyRate =
      emp?.daily_rate ?? emp?.per_day ?? person.daily_rate ?? null;
    const ptoHours = emp ? ptoByEmployee.get(emp.id) ?? 0 : 0;
    const jobTitle = emp?.position ?? positionTitle(person.position);
    const isClientBased = emp?.employee_type === "client-based";
    const isAccountSupervisor =
      jobTitle?.toUpperCase().includes("ACCOUNT SUPERVISOR") ?? false;

    const hourTotals = computeOfficeRegularHoursForCutoff({
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      clockEntries: empEntries,
      holidays: (holidays ?? []) as HolidayRow[],
      restDays: emp ? schedulesByEmployee.get(emp.id) : undefined,
      leaveRows: emp ? leaveByEmployee.get(emp.id) ?? [] : [],
      isClientBased,
      isAccountSupervisor,
      jobLevel: emp?.job_level,
      hireDate: emp?.hire_date ?? person.hire_date,
      terminationDate: emp?.resign_date ?? person.resign_date,
      approvedOtByDate: emp ? otByEmployee.get(emp.id) : undefined,
    });

    const ingest: CutoffHoursIngestRow = {
      directory_employee_id: person.id,
      office_employee_id: emp?.id ?? null,
      branch_id: person.branch_id,
      position_id: person.position_id,
      employee_code: person.employee_code ?? emp?.employee_code ?? emp?.employee_id,
      last_name: person.last_name ?? emp?.last_name,
      first_name: person.first_name ?? emp?.first_name,
      actual_regular_hours: hourTotals.actual_regular_hours,
      hours_work: hourTotals.hours_work,
      overtime_hours: hourTotals.overtime_hours,
      night_diff_hours: hourTotals.night_diff_hours,
      legal_holiday_hours: hourTotals.legal_holiday_hours,
      legal_holiday_ot_hours: hourTotals.legal_holiday_ot_hours,
      special_holiday_hours: hourTotals.special_holiday_hours,
      special_holiday_ot_hours: hourTotals.special_holiday_ot_hours,
      rest_day_hours: hourTotals.rest_day_hours,
      rest_day_ot_hours: hourTotals.rest_day_ot_hours,
      pto_hours: ptoHours,
      daily_rate_payroll: dailyRate,
      source_of_data: emp
        ? "office_time_clock_entries"
        : "roster_unenrolled",
      tk_status: emp ? "aggregated" : "unenrolled",
    };

    hourRows.push({
      cutoff_period_id: period.id,
      organization_id: period.organization_id,
      client_id: period.client_id,
      ...normalizeHoursRow(ingest),
    });

    for (const entry of empEntries) {
      punchRows.push({
        cutoff_period_id: period.id,
        organization_id: period.organization_id,
        client_id: period.client_id,
        directory_employee_id: person.id,
        work_date: dateOnly(entry.clock_in_time),
        clock_in: entry.clock_in_time,
        clock_out: entry.clock_out_time,
        source: "office_time_clock_entries",
      });
    }
  }

  if (hourRows.length) {
    // Collapse duplicate directory_employee_id links (multiple office rows → one 201).
    const byDir = new Map<string, Record<string, unknown>>();
    for (const row of hourRows) {
      const dirId = String(row.directory_employee_id);
      const prev = byDir.get(dirId);
      if (!prev) {
        byDir.set(dirId, { ...row });
        continue;
      }
      const hourKeys = [
        "actual_regular_hours",
        "hours_work",
        "overtime_hours",
        "night_diff_hours",
        "legal_holiday_hours",
        "legal_holiday_ot_hours",
        "special_holiday_hours",
        "special_holiday_ot_hours",
        "rest_day_hours",
        "rest_day_ot_hours",
        "pto_hours",
      ] as const;
      for (const key of hourKeys) {
        prev[key] = num(prev[key]) + num(row[key]);
      }
    }
    const deduped = [...byDir.values()];
    const { error } = await publicDb.from("cutoff_hours").upsert(deduped, {
      onConflict: "cutoff_period_id,directory_employee_id",
    });
    if (error) throw new Error(error.message);
    hourRows.length = 0;
    hourRows.push(...deduped);
  }

  if (punchRows.length) {
    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of punchRows) {
      const key = `${row.directory_employee_id}|${row.work_date}`;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, { ...row });
        continue;
      }
      // Same calendar day: keep earliest in / latest out.
      if (
        String(row.clock_in) < String(prev.clock_in ?? "") ||
        prev.clock_in == null
      ) {
        prev.clock_in = row.clock_in;
      }
      if (
        row.clock_out &&
        (prev.clock_out == null ||
          String(row.clock_out) > String(prev.clock_out))
      ) {
        prev.clock_out = row.clock_out;
      }
    }
    const dedupedPunches = [...byKey.values()];
    const { error } = await publicDb
      .from("cutoff_dtr_punches")
      .insert(dedupedPunches);
    if (error) throw new Error(error.message);
    punchRows.length = 0;
    punchRows.push(...dedupedPunches);
  }

  return {
    hours_upserted: hourRows.length,
    punches_upserted: punchRows.length,
    employees_skipped: unenrolled,
    roster_count: roster.length,
    unenrolled,
  };
}
