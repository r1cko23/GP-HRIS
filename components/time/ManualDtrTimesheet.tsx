"use client";

import { useEffect, useMemo, useState } from "react";
import { format, getDay, parseISO, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { dbTableShell } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  buildManualDtrSave,
  computeOrganicDtrLine,
  MANUAL_DTR_REASON,
  manualDtrHolidayMark,
  manualDtrRateLabel,
  visibleDtrOt,
  manualDtrDateKeys,
  manualDtrIdsToReplace,
  manilaHm,
  organicDutyForDate,
  type ManualDtrRowInput,
} from "@/lib/timekeeping/manual-dtr";
import { manilaDateKey } from "@/lib/timekeeping/zkteco-attlog";
import type { Holiday } from "@/utils/holidays";
import type { ManualDtrLeaveTag } from "@/lib/timekeeping/manual-dtr";

type ClockRow = {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  is_manual_entry?: boolean | null;
  employee_notes?: string | null;
};

type OtRow = {
  id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  reason?: string | null;
};

type ScheduleRow = {
  start_time: string;
  end_time: string;
  day_off?: boolean;
};

type LeaveRow = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  selected_dates?: string[] | null;
};

type DraftRow = ManualDtrRowInput;

function hoursLabel(value: number): string {
  if (value <= 0) return "—";
  return value.toFixed(2);
}

function tagBlocksTime(tag: ManualDtrLeaveTag | undefined): boolean {
  return tag === "SIL" || tag === "LWOP";
}

function tagFromNotes(notes: string | null | undefined): ManualDtrLeaveTag | null {
  if (!notes) return null;
  if (notes.includes("WDO")) return "WDO";
  if (notes.endsWith("RD")) return "RD";
  return null;
}

function leaveCovers(request: LeaveRow, date: string): boolean {
  const selected = Array.isArray(request.selected_dates) ? request.selected_dates : [];
  if (selected.length > 0) {
    return selected.some((day) => String(day).slice(0, 10) === date);
  }
  return request.start_date.slice(0, 10) <= date && request.end_date.slice(0, 10) >= date;
}

function leaveTagFor(leaves: LeaveRow[], date: string): { tag: ManualDtrLeaveTag; locked: boolean } {
  const matches = leaves.filter(
    (request) =>
      (request.leave_type === "SIL" || request.leave_type === "LWOP") &&
      leaveCovers(request, date)
  );
  const own = matches.find((request) => request.reason === MANUAL_DTR_REASON);
  const filed = matches.find((request) => request.reason !== MANUAL_DTR_REASON);
  const chosen = own ?? filed;
  if (!chosen) return { tag: "", locked: false };
  return {
    tag: chosen.leave_type === "LWOP" ? "LWOP" : "SIL",
    locked: chosen.reason !== MANUAL_DTR_REASON,
  };
}

function hydrateRows(input: {
  start: Date;
  end: Date;
  clocks: ClockRow[];
  overtime: OtRow[];
  leaves: LeaveRow[];
  schedules: Map<string, ScheduleRow>;
}): DraftRow[] {
  return manualDtrDateKeys(input.start, input.end).map((date) => {
    const duty = organicDutyForDate(input.schedules.get(date));
    const clock = input.clocks.find(
      (entry) => Boolean(entry.clock_out_time) && manilaDateKey(entry.clock_in_time) === date
    );
    const locked = Boolean(clock && !clock.is_manual_entry);
    const timeIn = clock ? manilaHm(clock.clock_in_time) : "";
    const timeOut = clock?.clock_out_time ? manilaHm(clock.clock_out_time) : "";
    const dayOt = input.overtime.filter(
      (request) =>
        request.ot_date.slice(0, 10) === date && request.reason === MANUAL_DTR_REASON
    );
    const leave = leaveTagFor(input.leaves, date);
    const noted = tagFromNotes(clock?.employee_notes);
    const schedule = input.schedules.get(date);
    const tag: ManualDtrLeaveTag = leave.tag || noted || (schedule?.day_off ? "RD" : "");
    const blocksTime = tagBlocksTime(tag);
    return {
      date,
      timeIn: blocksTime && !locked ? "" : timeIn,
      timeOut: blocksTime && !locked ? "" : timeOut,
      dutyStart: duty.start,
      dutyEnd: duty.end,
      locked,
      leaveTag: locked ? "" : tag,
      leaveLocked: leave.locked,
      otInOk: blocksTime || locked ? false : dayOt.some((request) => request.start_time.slice(0, 5) === timeIn),
      otOutOk: blocksTime || locked ? false : dayOt.some((request) => request.end_time.slice(0, 5) === timeOut),
    };
  });
}

export function ManualDtrTimesheet({
  employeeId,
  rangeStart,
  rangeEnd,
  clocks,
  overtime,
  leaves,
  holidays,
  schedules,
  canEdit,
  onSaved,
}: {
  employeeId: string;
  rangeStart: Date;
  rangeEnd: Date;
  clocks: ClockRow[];
  overtime: OtRow[];
  leaves: LeaveRow[];
  holidays: Holiday[];
  schedules: Map<string, ScheduleRow>;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  const clockKey = clocks
    .map((entry) => `${entry.id}:${entry.clock_in_time}:${entry.clock_out_time ?? ""}`)
    .join("|");
  const otKey = overtime
    .map((request) => `${request.id}:${request.ot_date}:${request.start_time}:${request.end_time}`)
    .join("|");
  const scheduleKey = Array.from(schedules.entries())
    .map(([date, schedule]) => `${date}:${schedule.start_time}:${schedule.end_time}:${schedule.day_off ? 1 : 0}`)
    .join("|");
  const leaveKey = leaves
    .map((request) => `${request.id}:${request.leave_type}:${request.start_date}:${request.reason ?? ""}`)
    .join("|");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(
      hydrateRows({
        start: new Date(startMs),
        end: new Date(endMs),
        clocks,
        overtime,
        leaves,
        schedules,
      })
    );
    // Reset only when the server snapshot changes. A refetch that returns the
    // same punches must not wipe times HR has typed but not saved yet.
  }, [employeeId, startMs, endMs, clockKey, otKey, scheduleKey, leaveKey]);

  const totals = useMemo(() => {
    let regular = 0;
    let ot = 0;
    let days = 0;
    for (const row of rows) {
      if (row.leaveTag === "SIL") {
        days += 1;
        regular += 8;
        continue;
      }
      if (row.leaveTag === "LWOP") {
        days += 1;
        continue;
      }
      if (!row.timeIn || !row.timeOut) continue;
      const line = computeOrganicDtrLine(row);
      if (line.invalidOrder) continue;
      days += 1;
      regular += line.regularHours;
      ot += visibleDtrOt(line.otInHours, row.otInOk);
      ot += visibleDtrOt(line.otOutHours, row.otOutOk);
    }
    return {
      days,
      regular: Math.round(regular * 100) / 100,
      ot: Math.round(ot * 100) / 100,
    };
  }, [rows]);

  function patchRow(date: string, patch: Partial<DraftRow>) {
    setRows((current) =>
      current.map((row) => (row.date === date ? { ...row, ...patch } : row))
    );
  }

  async function save() {
    if (!canEdit || saving) return;
    const plan = buildManualDtrSave({
      employeeId,
      rows,
      editorLabel: "HR",
    });
    if ("error" in plan) {
      toast.error(plan.error);
      return;
    }
    const existing = manualDtrIdsToReplace({
      replaceDates: plan.replaceDates,
      clocks,
      overtime,
      leaves,
    });
    const dutyWrites = plan.dutyRows.filter((duty) => {
      const shown = organicDutyForDate(schedules.get(duty.date));
      return (
        shown.start !== duty.start_time.slice(0, 5) || shown.end !== duty.end_time.slice(0, 5)
      );
    });
    const clearsRestDay = rows.some(
      (row) => schedules.get(row.date)?.day_off && !plan.restDays.includes(row.date)
    );
    if (
      plan.clockRows.length === 0 &&
      plan.leaveRows.length === 0 &&
      plan.restDays.length === 0 &&
      dutyWrites.length === 0 &&
      !clearsRestDay &&
      existing.clockIds.length === 0 &&
      existing.overtimeIds.length === 0 &&
      existing.leaveIds.length === 0
    ) {
      toast.error("Enter time in and time out, or tag SIL, LWOP, rest day, or WDO");
      return;
    }

    setSaving(true);
    try {
      if (existing.clockIds.length > 0) {
        const { error } = await supabase
          .from("time_clock_entries")
          .delete()
          .in("id", existing.clockIds);
        if (error) throw error;
      }
      if (existing.overtimeIds.length > 0) {
        const { error } = await supabase
          .from("overtime_requests")
          .delete()
          .in("id", existing.overtimeIds);
        if (error) throw error;
      }
      if (existing.leaveIds.length > 0) {
        const { error } = await supabase.from("leave_requests").delete().in("id", existing.leaveIds);
        if (error) throw error;
      }
      if (plan.clockRows.length > 0) {
        const { error } = await supabase.from("time_clock_entries").insert(
          plan.clockRows.map((row) => ({
            ...row,
            clock_in_device: "DTR",
            clock_out_device: "DTR",
          }))
        );
        if (error) throw error;
      }
      if (plan.overtimeRows.length > 0) {
        const { error } = await supabase.from("overtime_requests").insert(plan.overtimeRows);
        if (error) throw error;
      }
      if (plan.leaveRows.length > 0) {
        const { error } = await supabase.from("leave_requests").insert(plan.leaveRows);
        if (error) throw error;
      }
      const restDaySet = new Set(plan.restDays);
      const clearedRestDays = rows
        .filter((row) => schedules.get(row.date)?.day_off && !restDaySet.has(row.date))
        .map((row) => row.date);
      const scheduleWrites = new Map<
        string,
        { dayOff: boolean; start: string | null; end: string | null }
      >();
      for (const duty of dutyWrites) {
        scheduleWrites.set(duty.date, {
          dayOff: false,
          start: duty.start_time,
          end: duty.end_time,
        });
      }
      for (const date of clearedRestDays) {
        const duty = plan.dutyRows.find((item) => item.date === date);
        scheduleWrites.set(date, {
          dayOff: false,
          start: duty?.start_time ?? null,
          end: duty?.end_time ?? null,
        });
      }
      for (const date of plan.restDays) {
        scheduleWrites.set(date, { dayOff: true, start: null, end: null });
      }
      if (scheduleWrites.size > 0) {
        const { error } = await supabase.from("employee_week_schedules").upsert(
          Array.from(scheduleWrites.entries()).map(([date, write]) => ({
            employee_id: employeeId,
            week_start: format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd"),
            schedule_date: date,
            start_time: write.start,
            end_time: write.end,
            day_off: write.dayOff,
          })),
          { onConflict: "employee_id,schedule_date" }
        );
        if (error) throw error;
      }
      toast.success(
        plan.warnings.length > 0 ? "Manual DTR saved, with days left out" : "Manual DTR saved",
        plan.warnings.length > 0 ? { description: plan.warnings.join(" ") } : undefined
      );
      onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Could not save this DTR. Your entries are still on screen — save again.");
    } finally {
      setSaving(false);
    }
  }

  function lineFor(row: DraftRow) {
    if (!row.timeIn || !row.timeOut) return null;
    const line = computeOrganicDtrLine(row);
    return line.invalidOrder ? null : line;
  }

  return (
    <CardSection>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Manual DTR</p>
          <p className="text-sm text-muted-foreground">
            13-day cutoff. Set the duty for each day, then enter time in and time out.
            Regular hours sit inside that duty. Time outside it is overtime after OT OK is checked.
            Tag SIL, LWOP, rest day, or WDO. Rest day and WDO show the pay rate. Holidays are marked the same way as the rest of Attendance.
          </p>
        </div>
        {canEdit ? (
          <Button type="button" className="min-h-10" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save DTR"}
          </Button>
        ) : null}
      </div>

      <DbMobileBlock>
        <div className="space-y-2">
          {rows.map((row) => (
            <DayFields
              key={row.date}
              row={row}
              line={lineFor(row)}
              holidays={holidays}
              canEdit={canEdit}
              saving={saving}
              onPatch={(patch) => patchRow(row.date, patch)}
            />
          ))}
        </div>
      </DbMobileBlock>

      <DbDesktopBlock className={dbTableShell}>
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                Day
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                Duty
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                Tag
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                Time in
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                Time out
              </th>
              <th className="w-[4.5rem] whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium tabular-nums text-muted-foreground">
                RH
              </th>
              <th className="w-[4.5rem] whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium tabular-nums text-muted-foreground">
                OT in
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                OK
              </th>
              <th className="w-[4.5rem] whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium tabular-nums text-muted-foreground">
                OT out
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                OK
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const line = lineFor(row);
              const weekend = getDay(parseISO(row.date)) === 0;
              return (
                <tr
                  key={row.date}
                  className={cn(
                    "border-b border-border/80",
                    weekend && "bg-primary/[0.03]"
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-center">
                    <div className="font-medium tabular-nums">
                      {format(parseISO(row.date), "MMM d")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(row.date), "EEE")}
                    </div>
                    <HolidayMark date={row.date} holidays={holidays} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <DutyFields
                      date={row.date}
                      start={row.dutyStart ?? ""}
                      end={row.dutyEnd ?? ""}
                      disabled={!canEdit || saving || row.locked}
                      onChange={(patch) => patchRow(row.date, patch)}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <LeaveTagSelect
                      date={row.date}
                      value={row.leaveTag ?? ""}
                      disabled={!canEdit || saving || row.locked || Boolean(row.leaveLocked)}
                      onChange={(leaveTag) =>
                        patchRow(row.date, tagBlocksTime(leaveTag)
                          ? { leaveTag, timeIn: "", timeOut: "", otInOk: false, otOutOk: false }
                          : { leaveTag })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <TimeField
                      label={`Time in ${row.date}`}
                      value={row.timeIn}
                      disabled={!canEdit || saving || row.locked || tagBlocksTime(row.leaveTag)}
                      onChange={(timeIn) => patchRow(row.date, { timeIn })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <TimeField
                      label={`Time out ${row.date}`}
                      value={row.timeOut}
                      disabled={!canEdit || saving || row.locked || tagBlocksTime(row.leaveTag)}
                      onChange={(timeOut) => patchRow(row.date, { timeOut })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {regularLabel(row, line)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {line ? hoursLabel(visibleDtrOt(line.otInHours, row.otInOk)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <OkBox
                      label={`OT in OK ${row.date}`}
                      checked={row.otInOk}
                      disabled={!canEdit || saving || row.locked || tagBlocksTime(row.leaveTag) || !line || line.otInHours <= 0}
                      onChange={(otInOk) => patchRow(row.date, { otInOk })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {line ? hoursLabel(visibleDtrOt(line.otOutHours, row.otOutOk)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <OkBox
                      label={`OT out OK ${row.date}`}
                      checked={row.otOutOk}
                      disabled={!canEdit || saving || row.locked || tagBlocksTime(row.leaveTag) || !line || line.otOutHours <= 0}
                      onChange={(otOutOk) => patchRow(row.date, { otOutOk })}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-border bg-muted/20 font-semibold">
              <td colSpan={5} className="px-3 py-3 text-sm">
                Days with time: {totals.days}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{totals.regular.toFixed(2)}</td>
              <td colSpan={2} />
              <td className="px-3 py-3 text-right tabular-nums">{totals.ot.toFixed(2)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </DbDesktopBlock>
      {canEdit ? (
        <div className="mt-3 flex justify-end">
          <Button type="button" className="min-h-10" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save DTR"}
          </Button>
        </div>
      ) : null}
    </CardSection>
  );
}

function regularLabel(row: DraftRow, line: ReturnType<typeof computeOrganicDtrLine> | null): string {
  if (row.leaveTag === "SIL") return "8.00";
  if (row.leaveTag === "LWOP") return "0.00";
  return line ? hoursLabel(line.regularHours) : "—";
}

function HolidayMark({ date, holidays }: { date: string; holidays: Holiday[] }) {
  const mark = manualDtrHolidayMark(date, holidays);
  if (!mark) return null;
  return (
    <div className="text-[11px] font-medium text-purple-800" title={mark.name}>
      {mark.code} · {mark.name}
    </div>
  );
}

function LeaveTagSelect({
  date,
  value,
  disabled,
  onChange,
}: {
  date: string;
  value: ManualDtrLeaveTag;
  disabled: boolean;
  onChange: (value: ManualDtrLeaveTag) => void;
}) {
  return (
    <select
      aria-label={`Tag ${date}`}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value as ManualDtrLeaveTag)}
      className="min-h-10 rounded-md border border-border bg-background px-2 text-center text-sm disabled:opacity-60"
    >
      <option value="">—</option>
      <option value="SIL">SIL</option>
      <option value="LWOP">LWOP</option>
      <option value="RD">{manualDtrRateLabel("RD")}</option>
      <option value="WDO">{manualDtrRateLabel("WDO")}</option>
    </select>
  );
}

function DutyFields({
  date,
  start,
  end,
  disabled,
  onChange,
}: {
  date: string;
  start: string;
  end: string;
  disabled: boolean;
  onChange: (patch: { dutyStart?: string; dutyEnd?: string }) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <label className="text-[11px] text-muted-foreground">
        Start
        <TimeField
          label={`Duty start ${date}`}
          value={start}
          disabled={disabled}
          onChange={(dutyStart) => onChange({ dutyStart })}
        />
      </label>
      <label className="text-[11px] text-muted-foreground">
        End
        <TimeField
          label={`Duty end ${date}`}
          value={end}
          disabled={disabled}
          onChange={(dutyEnd) => onChange({ dutyEnd })}
        />
      </label>
    </div>
  );
}

function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 w-[7.25rem] rounded-md border border-border bg-background px-2 text-center text-sm tabular-nums disabled:opacity-60"
    />
  );
}

function OkBox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 accent-primary disabled:opacity-40"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function DayFields({
  row,
  line,
  holidays,
  canEdit,
  saving,
  onPatch,
}: {
  row: DraftRow;
  line: ReturnType<typeof computeOrganicDtrLine> | null;
  holidays: Holiday[];
  canEdit: boolean;
  saving: boolean;
  onPatch: (patch: Partial<DraftRow>) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tabular-nums">
            {format(parseISO(row.date), "MMM d")}
          </p>
          <HolidayMark date={row.date} holidays={holidays} />
        </div>
        <p className="text-xs text-muted-foreground">{format(parseISO(row.date), "EEE")}</p>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-xs text-muted-foreground">Duty</p>
        <DutyFields
          date={row.date}
          start={row.dutyStart ?? ""}
          end={row.dutyEnd ?? ""}
          disabled={!canEdit || saving || row.locked}
          onChange={onPatch}
        />
      </div>
      <div className="mt-3">
        <LeaveTagSelect
          date={row.date}
          value={row.leaveTag ?? ""}
          disabled={!canEdit || saving || row.locked || Boolean(row.leaveLocked)}
          onChange={(leaveTag) =>
            onPatch(
              tagBlocksTime(leaveTag)
                ? { leaveTag, timeIn: "", timeOut: "", otInOk: false, otOutOk: false }
                : { leaveTag }
            )
          }
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Time in
          <TimeField
            label={`Time in ${row.date}`}
            value={row.timeIn}
            disabled={!canEdit || saving || row.locked || tagBlocksTime(row.leaveTag)}
            onChange={(timeIn) => onPatch({ timeIn })}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Time out
          <TimeField
            label={`Time out ${row.date}`}
            value={row.timeOut}
            disabled={!canEdit || saving || row.locked || tagBlocksTime(row.leaveTag)}
            onChange={(timeOut) => onPatch({ timeOut })}
          />
        </label>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <p>
          <span className="text-muted-foreground">RH </span>
          <span className="tabular-nums">{regularLabel(row, line)}</span>
        </p>
        <p className="flex items-center gap-2">
          <span className="text-muted-foreground">OT in </span>
          <span className="tabular-nums">{line ? hoursLabel(visibleDtrOt(line.otInHours, row.otInOk)) : "—"}</span>
          <OkBox
            label={`OT in OK ${row.date}`}
            checked={row.otInOk}
            disabled={!canEdit || saving || row.locked || tagBlocksTime(row.leaveTag) || !line || line.otInHours <= 0}
            onChange={(otInOk) => onPatch({ otInOk })}
          />
        </p>
        <p className="flex items-center gap-2">
          <span className="text-muted-foreground">OT out </span>
          <span className="tabular-nums">{line ? hoursLabel(visibleDtrOt(line.otOutHours, row.otOutOk)) : "—"}</span>
          <OkBox
            label={`OT out OK ${row.date}`}
            checked={row.otOutOk}
            disabled={!canEdit || saving || row.locked || tagBlocksTime(row.leaveTag) || !line || line.otOutHours <= 0}
            onChange={(otOutOk) => onPatch({ otOutOk })}
          />
        </p>
      </div>
    </div>
  );
}
