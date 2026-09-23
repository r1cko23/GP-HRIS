/**
 * Repair Sep 22–23 Organic clock rows where a morning biometric punch closed a
 * multi-day stale open instead of creating that day's IN.
 *
 * Dry-run: npx tsx scripts/repair-biometric-stale-open-theft.ts
 * Apply:   npx tsx scripts/repair-biometric-stale-open-theft.ts --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BIOMETRIC_DEVICE_LABEL,
  BIOMETRIC_FINGERPRINT,
  manilaDateKey,
} from "../lib/timekeeping/zkteco-attlog";

const APPLY = process.argv.includes("--apply");
const FROM = "2026-09-22T00:00:00+08:00";
const TO = "2026-09-24T00:00:00+08:00";
const NOTE = "Repaired: morning biometric had closed a multi-day stale open (2026-09-23)";

type PunchRow = {
  id: string;
  device_user_id: string;
  punched_at: string;
  status_code: number | null;
  action: string;
  skip_reason: string | null;
  time_clock_entry_id: string | null;
  raw_line: string | null;
};

type EntryRow = {
  id: string;
  employee_id: string;
  clock_in_date_ph: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_device: string | null;
  clock_out_device: string | null;
  clock_in_location: string | null;
  status: string | null;
};

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms =
    Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000);
}

async function reopenStale(
  admin: SupabaseClient,
  entryId: string,
  dry: boolean
) {
  if (dry) return;
  const { error } = await admin
    .from("time_clock_entries")
    .update({
      clock_out_time: null,
      clock_out_location: null,
      clock_out_device: null,
      clock_out_fingerprint: null,
      status: "clocked_in",
      hr_notes: NOTE,
    })
    .eq("id", entryId);
  if (error) throw new Error(`reopen ${entryId}: ${error.message}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: maps, error: mapErr } = await admin
    .from("biometric_user_maps")
    .select("device_user_id, employee_id");
  if (mapErr) throw mapErr;
  const pinToEmp = new Map(
    (maps ?? []).map((m) => [String(m.device_user_id), String(m.employee_id)])
  );

  const { data: events, error: evErr } = await admin
    .from("biometric_punch_events")
    .select(
      "id, device_user_id, punched_at, status_code, action, skip_reason, time_clock_entry_id, raw_line"
    )
    .gte("punched_at", new Date(Date.parse(FROM)).toISOString())
    .lt("punched_at", new Date(Date.parse(TO)).toISOString())
    .order("punched_at", { ascending: true });
  if (evErr) throw evErr;

  const punches = (events ?? []) as PunchRow[];
  const entryIds = [
    ...new Set(
      punches
        .map((p) => p.time_clock_entry_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: linkedEntries, error: leErr } = await admin
    .from("time_clock_entries")
    .select(
      "id, employee_id, clock_in_date_ph, clock_in_time, clock_out_time, clock_in_device, clock_out_device, clock_in_location, status"
    )
    .in("id", entryIds.length ? entryIds : ["00000000-0000-0000-0000-000000000000"]);
  if (leErr) throw leErr;
  const entryById = new Map(
    ((linkedEntries ?? []) as EntryRow[]).map((e) => [e.id, e])
  );

  type DayPlan = {
    employeeId: string;
    pin: string;
    punchDate: string;
    morning: PunchRow;
    staleEntryIds: string[];
    evening: PunchRow | null;
    eveningWrongEntryId: string | null;
  };

  const plans = new Map<string, DayPlan>();

  for (const p of punches) {
    if (p.action !== "clock_out" || !p.time_clock_entry_id) continue;
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        hour12: false,
      }).format(new Date(p.punched_at))
    );
    if (hour >= 12) continue;

    const linked = entryById.get(p.time_clock_entry_id);
    if (!linked) continue;
    const punchDate = manilaDateKey(p.punched_at);
    const gap = daysBetween(linked.clock_in_date_ph, punchDate);
    // Overnight (gap === 1) is legitimate; only repair multi-day stale.
    if (gap <= 1) continue;

    const employeeId = pinToEmp.get(p.device_user_id) ?? linked.employee_id;
    const key = `${employeeId}|${punchDate}`;
    let plan = plans.get(key);
    if (!plan) {
      plan = {
        employeeId,
        pin: p.device_user_id,
        punchDate,
        morning: p,
        staleEntryIds: [],
        evening: null,
        eveningWrongEntryId: null,
      };
      plans.set(key, plan);
    }
    if (!plan.staleEntryIds.includes(p.time_clock_entry_id)) {
      plan.staleEntryIds.push(p.time_clock_entry_id);
    }
    // Keep earliest morning as the intended IN
    if (p.punched_at < plan.morning.punched_at) plan.morning = p;
  }

  // Attach evening punches (same pin/day, after morning)
  for (const plan of plans.values()) {
    const later = punches.filter(
      (p) =>
        p.device_user_id === plan.pin &&
        manilaDateKey(p.punched_at) === plan.punchDate &&
        p.punched_at > plan.morning.punched_at
    );

    const isStaleClose = (p: PunchRow) => {
      if (!p.time_clock_entry_id || p.action !== "clock_out") return false;
      const linked = entryById.get(p.time_clock_entry_id);
      if (!linked) return false;
      return daysBetween(linked.clock_in_date_ph, plan.punchDate) > 1;
    };

    const evening =
      later.find((p) => p.status_code === 1) ??
      later.find(
        (p) =>
          p.action === "skipped" &&
          (p.skip_reason === "No open clock-in for OUT" ||
            p.skip_reason === "Biometric already clocked out")
      ) ??
      later.find((p) => {
        if (p.action !== "clock_out" || !p.time_clock_entry_id) return false;
        if (isStaleClose(p)) return false;
        const linked = entryById.get(p.time_clock_entry_id);
        return linked?.clock_in_date_ph === plan.punchDate;
      }) ??
      later.find((p) => p.action === "clock_in") ??
      null;
    plan.evening = evening;
    if (evening?.time_clock_entry_id) {
      const linked = entryById.get(evening.time_clock_entry_id);
      if (
        linked &&
        linked.clock_in_date_ph !== plan.punchDate &&
        daysBetween(linked.clock_in_date_ph, plan.punchDate) > 1
      ) {
        plan.eveningWrongEntryId = evening.time_clock_entry_id;
      }
    }
  }

  const { data: empRows } = await admin
    .from("employees")
    .select("id, employee_code, last_name, first_name")
    .in(
      "id",
      [...plans.values()].map((p) => p.employeeId)
    );
  const empById = new Map(
    (empRows ?? []).map((e) => [
      String(e.id),
      `${e.employee_code} ${e.last_name}, ${e.first_name}`,
    ])
  );

  console.log(
    `${APPLY ? "APPLY" : "DRY-RUN"} — ${plans.size} employee-day(s) to repair\n`
  );

  let repaired = 0;
  for (const plan of plans.values()) {
    const label = empById.get(plan.employeeId) ?? plan.employeeId;
    const { data: dayRows, error: dayErr } = await admin
      .from("time_clock_entries")
      .select(
        "id, employee_id, clock_in_date_ph, clock_in_time, clock_out_time, clock_in_device, clock_out_device, clock_in_location, status"
      )
      .eq("employee_id", plan.employeeId)
      .eq("clock_in_date_ph", plan.punchDate)
      .maybeSingle();
    if (dayErr) throw dayErr;

    const eveningIso = plan.evening?.punched_at ?? null;
    const loc =
      (dayRows as EntryRow | null)?.clock_in_location ??
      entryById.get(plan.staleEntryIds[0]!)?.clock_in_location ??
      "Green Pasture";

    console.log(
      `- ${label} ${plan.punchDate}: IN ${plan.morning.punched_at}` +
        (eveningIso ? ` OUT ${eveningIso}` : " (no evening)") +
        (dayRows ? " [update day]" : " [insert day]") +
        ` stale=${plan.staleEntryIds.length}`
    );

    if (!APPLY) {
      repaired += 1;
      continue;
    }

    for (const staleId of plan.staleEntryIds) {
      await reopenStale(admin, staleId, false);
    }
    if (plan.eveningWrongEntryId) {
      await reopenStale(admin, plan.eveningWrongEntryId, false);
    }

    let dayId = (dayRows as EntryRow | null)?.id ?? null;
    if (dayId) {
      const { error } = await admin
        .from("time_clock_entries")
        .update({
          clock_in_time: plan.morning.punched_at,
          clock_in_device: BIOMETRIC_DEVICE_LABEL,
          clock_in_fingerprint: BIOMETRIC_FINGERPRINT,
          clock_in_location: loc,
          clock_out_time: eveningIso,
          clock_out_device: eveningIso ? BIOMETRIC_DEVICE_LABEL : null,
          clock_out_fingerprint: eveningIso ? BIOMETRIC_FINGERPRINT : null,
          clock_out_location: eveningIso ? loc : null,
          status: eveningIso ? "clocked_out" : "clocked_in",
          hr_notes: NOTE,
        })
        .eq("id", dayId);
      if (error) throw new Error(`update day ${dayId}: ${error.message}`);
    } else {
      const { data: inserted, error } = await admin
        .from("time_clock_entries")
        .insert({
          employee_id: plan.employeeId,
          clock_in_time: plan.morning.punched_at,
          clock_in_device: BIOMETRIC_DEVICE_LABEL,
          clock_in_fingerprint: BIOMETRIC_FINGERPRINT,
          clock_in_location: loc,
          clock_out_time: eveningIso,
          clock_out_device: eveningIso ? BIOMETRIC_DEVICE_LABEL : null,
          clock_out_fingerprint: eveningIso ? BIOMETRIC_FINGERPRINT : null,
          clock_out_location: eveningIso ? loc : null,
          status: eveningIso ? "clocked_out" : "clocked_in",
          is_manual_entry: false,
          hr_notes: NOTE,
        })
        .select("id")
        .single();
      if (error) throw new Error(`insert day: ${error.message}`);
      dayId = inserted.id as string;
    }

    // Relink punch events
    await admin
      .from("biometric_punch_events")
      .update({
        action: "clock_in",
        skip_reason: null,
        time_clock_entry_id: dayId,
      })
      .eq("id", plan.morning.id);

    // Extra morning stale-closes after the first IN → skipped
    for (const p of punches) {
      if (
        p.device_user_id === plan.pin &&
        manilaDateKey(p.punched_at) === plan.punchDate &&
        p.punched_at > plan.morning.punched_at &&
        p.id !== plan.evening?.id &&
        plan.staleEntryIds.includes(p.time_clock_entry_id ?? "")
      ) {
        await admin
          .from("biometric_punch_events")
          .update({
            action: "skipped",
            skip_reason: "Biometric already clocked in this day",
            time_clock_entry_id: null,
          })
          .eq("id", p.id);
      }
    }

    if (plan.evening) {
      await admin
        .from("biometric_punch_events")
        .update({
          action: "clock_out",
          skip_reason: null,
          time_clock_entry_id: dayId,
        })
        .eq("id", plan.evening.id);
    }

    // If a following-day punch closed this repaired day as OUT (e.g. Alberto
    // Sep 23 07:39 on a Sep 22 row that had no real evening), convert it to
    // that day's IN when the day already has an evening OUT.
    if (eveningIso && dayId) {
      const followUps = punches.filter(
        (p) =>
          p.device_user_id === plan.pin &&
          p.action === "clock_out" &&
          p.time_clock_entry_id === dayId &&
          manilaDateKey(p.punched_at) !== plan.punchDate &&
          p.punched_at > eveningIso
      );
      for (const fu of followUps) {
        const nextDate = manilaDateKey(fu.punched_at);
        const { data: nextDayRow } = await admin
          .from("time_clock_entries")
          .select("id")
          .eq("employee_id", plan.employeeId)
          .eq("clock_in_date_ph", nextDate)
          .maybeSingle();
        if (nextDayRow) continue;
        const { data: nextIns, error: nextErr } = await admin
          .from("time_clock_entries")
          .insert({
            employee_id: plan.employeeId,
            clock_in_time: fu.punched_at,
            clock_in_device: BIOMETRIC_DEVICE_LABEL,
            clock_in_fingerprint: BIOMETRIC_FINGERPRINT,
            clock_in_location: loc,
            status: "clocked_in",
            is_manual_entry: false,
            hr_notes: NOTE,
          })
          .select("id")
          .single();
        if (nextErr) throw new Error(`insert next day: ${nextErr.message}`);
        await admin
          .from("biometric_punch_events")
          .update({
            action: "clock_in",
            skip_reason: null,
            time_clock_entry_id: nextIns.id,
          })
          .eq("id", fu.id);
      }
    }

    repaired += 1;
  }

  console.log(`\nDone. ${repaired} plan(s) ${APPLY ? "applied" : "previewed"}.`);
  if (!APPLY) {
    console.log("Re-run with --apply to write changes.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
