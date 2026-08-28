import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeHoursRow, type CutoffHoursIngestRow } from "./cutoff-types";

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

function isSunday(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.getUTCDay() === 0;
}

export type AggregateOfficeClockResult = {
  hours_upserted: number;
  punches_upserted: number;
  employees_skipped: number;
};

/**
 * Aggregate office bundy punches into cutoff_hours (+ optional punches).
 * Enriches with holidays, Sunday rest-day, approved OT, and approved leave (PTO).
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

  const { data: officeEmployees, error: empError } = await publicDb
    .from("employees")
    .select(
      "id, employee_code, employee_id, first_name, last_name, daily_rate, per_day, directory_employee_id, directory_client_id"
    )
    .not("directory_employee_id", "is", null)
    .eq("directory_client_id", period.client_id);

  if (empError) throw new Error(empError.message);

  const linked = (officeEmployees ?? []) as OfficeEmployeeRow[];
  if (!linked.length) {
    return { hours_upserted: 0, punches_upserted: 0, employees_skipped: 0 };
  }

  const officeIds = linked.map((e) => e.id);
  const { data: entries, error: clockError } = await publicDb
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

  const { data: holidays } = await publicDb
    .from("holidays")
    .select("holiday_date, holiday_type")
    .eq("is_active", true)
    .gte("holiday_date", period.period_start)
    .lte("holiday_date", period.period_end);

  const holidayByDate = new Map<string, HolidayRow>();
  for (const row of (holidays ?? []) as HolidayRow[]) {
    holidayByDate.set(String(row.holiday_date).slice(0, 10), row);
  }

  const otByEmployee = new Map<string, number>();
  try {
    const { data: otRows } = await publicDb
      .from("overtime_requests")
      .select("employee_id, total_hours, status, ot_date")
      .in("employee_id", officeIds)
      .eq("status", "approved");
    for (const row of otRows ?? []) {
      const workDate = String((row as { ot_date?: string }).ot_date ?? "").slice(
        0,
        10
      );
      if (
        workDate &&
        (workDate < period.period_start || workDate > period.period_end)
      ) {
        continue;
      }
      const empId = (row as { employee_id: string }).employee_id;
      otByEmployee.set(
        empId,
        (otByEmployee.get(empId) ?? 0) +
          num((row as { total_hours?: number }).total_hours)
      );
    }
  } catch {
    /* OT enrichment optional */
  }

  const ptoByEmployee = new Map<string, number>();
  try {
    const { data: leaveRows } = await publicDb
      .from("leave_requests")
      .select("employee_id, start_date, end_date, status, half_day")
      .in("employee_id", officeIds)
      .in("status", ["approved", "auto_approved"]);
    for (const row of leaveRows ?? []) {
      const start = String((row as { start_date: string }).start_date).slice(
        0,
        10
      );
      const end = String(
        (row as { end_date?: string }).end_date ?? start
      ).slice(0, 10);
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
      const half = Boolean((row as { half_day?: boolean }).half_day);
      const hours = Math.max(0, days) * (half ? 4 : 8);
      const empId = (row as { employee_id: string }).employee_id;
      ptoByEmployee.set(empId, (ptoByEmployee.get(empId) ?? 0) + hours);
    }
  } catch {
    /* Leave enrichment optional */
  }

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
  let employeesSkipped = 0;

  for (const emp of linked) {
    const dirId = emp.directory_employee_id;
    if (!dirId) {
      employeesSkipped += 1;
      continue;
    }

    const empEntries = byEmployee.get(emp.id) ?? [];
    const dailyRate = emp.daily_rate ?? emp.per_day ?? null;
    const ptoHours = ptoByEmployee.get(emp.id) ?? 0;
    const approvedOtExtra = otByEmployee.get(emp.id) ?? 0;
    if (!empEntries.length && ptoHours <= 0 && approvedOtExtra <= 0) {
      employeesSkipped += 1;
      continue;
    }

    let regular = 0;
    let overtime = 0;
    let nightDiff = 0;
    let hoursWork = 0;
    let legalHoliday = 0;
    let legalHolidayOt = 0;
    let specialHoliday = 0;
    let specialHolidayOt = 0;
    let restDay = 0;
    let restDayOt = 0;

    for (const entry of empEntries) {
      const workDate = dateOnly(entry.clock_in_time);
      const reg = num(entry.regular_hours);
      const ot = num(entry.overtime_hours);
      const nd = num(entry.total_night_diff_hours);
      const total = num(entry.total_hours) || reg + ot;
      hoursWork += total;
      nightDiff += nd;

      const holiday = holidayByDate.get(workDate);
      if (holiday?.holiday_type === "regular") {
        legalHoliday += reg;
        legalHolidayOt += ot;
      } else if (
        holiday?.holiday_type === "non-working" ||
        holiday?.holiday_type === "special"
      ) {
        specialHoliday += reg;
        specialHolidayOt += ot;
      } else if (isSunday(workDate)) {
        restDay += reg;
        restDayOt += ot;
      } else {
        regular += reg;
        overtime += ot;
      }
    }

    if (approvedOtExtra > overtime) {
      overtime += approvedOtExtra - overtime;
    }

    const ingest: CutoffHoursIngestRow = {
      directory_employee_id: dirId,
      office_employee_id: emp.id,
      employee_code: emp.employee_code ?? emp.employee_id,
      last_name: emp.last_name,
      first_name: emp.first_name,
      actual_regular_hours: regular,
      hours_work: hoursWork,
      overtime_hours: overtime,
      night_diff_hours: nightDiff,
      legal_holiday_hours: legalHoliday,
      legal_holiday_ot_hours: legalHolidayOt,
      special_holiday_hours: specialHoliday,
      special_holiday_ot_hours: specialHolidayOt,
      rest_day_hours: restDay,
      rest_day_ot_hours: restDayOt,
      pto_hours: ptoHours,
      daily_rate_payroll: dailyRate,
      source_of_data: "office_time_clock_entries",
      tk_status: "aggregated",
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
        directory_employee_id: dirId,
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

  void directoryDb;

  return {
    hours_upserted: hourRows.length,
    punches_upserted: punchRows.length,
    employees_skipped: employeesSkipped,
  };
}
