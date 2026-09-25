/**
 * Apply orphan biometric OUTs: punch events logged as clock_out + linked to an
 * entry, but time_clock_entries.clock_out_time still null.
 *
 * Dry-run: npx tsx scripts/repair-orphan-biometric-outs.ts
 * Apply:   npx tsx scripts/repair-orphan-biometric-outs.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import {
  planOrphanBiometricOutRepairs,
  type OrphanOutEntry,
  type OrphanOutPunch,
} from "../lib/timekeeping/repair-orphan-biometric-outs";

const APPLY = process.argv.includes("--apply");
const FROM_ISO =
  process.env.ORPHAN_OUT_FROM_ISO ?? "2026-09-01T00:00:00.000Z";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: events, error: evErr } = await admin
    .from("biometric_punch_events")
    .select("id, time_clock_entry_id, punched_at, action")
    .eq("action", "clock_out")
    .not("time_clock_entry_id", "is", null)
    .gte("punched_at", FROM_ISO)
    .order("punched_at", { ascending: true });
  if (evErr) throw evErr;

  const punches = (events ?? []).filter(
    (e): e is OrphanOutPunch =>
      Boolean(e.id && e.time_clock_entry_id && e.punched_at && e.action)
  ) as OrphanOutPunch[];

  const entryIds = [
    ...new Set(punches.map((p) => p.time_clock_entry_id).filter(Boolean)),
  ];
  if (entryIds.length === 0) {
    console.log("No clock_out punch events since", FROM_ISO);
    return;
  }

  const { data: entries, error: enErr } = await admin
    .from("time_clock_entries")
    .select(
      "id, clock_in_time, clock_out_time, clock_in_location, status, hr_notes, employee_id, clock_in_date_ph"
    )
    .in("id", entryIds)
    .is("clock_out_time", null);
  if (enErr) throw enErr;

  const openEntries = (entries ?? []) as (OrphanOutEntry & {
    employee_id?: string;
    clock_in_date_ph?: string;
  })[];

  const repairs = planOrphanBiometricOutRepairs(punches, openEntries);
  console.log(
    `${APPLY ? "APPLY" : "DRY-RUN"}: ${repairs.length} orphan OUT repair(s) since ${FROM_ISO}`
  );

  const empIds = [
    ...new Set(
      openEntries
        .filter((e) => repairs.some((r) => r.entryId === e.id))
        .map((e) => (e as { employee_id?: string }).employee_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: emps } = await admin
    .from("employees")
    .select("id, employee_code, last_name, first_name")
    .in("id", empIds.length ? empIds : ["00000000-0000-0000-0000-000000000000"]);
  const empById = new Map(
    (emps ?? []).map((e) => [
      e.id as string,
      `${e.last_name}, ${e.first_name} (${e.employee_code})`,
    ])
  );
  const entryMeta = new Map(
    openEntries.map((e) => [
      e.id,
      e as OrphanOutEntry & { employee_id?: string; clock_in_date_ph?: string },
    ])
  );

  let ok = 0;
  let fail = 0;
  for (const r of repairs) {
    const meta = entryMeta.get(r.entryId);
    const who = empById.get(meta?.employee_id ?? "") ?? meta?.employee_id ?? "?";
    const line = `${who} date=${meta?.clock_in_date_ph ?? "?"} out=${r.clockOutTime} entry=${r.entryId}`;
    if (!APPLY) {
      console.log(`  would-fix ${line}`);
      continue;
    }
    const { data, error } = await admin
      .from("time_clock_entries")
      .update(r.update)
      .eq("id", r.entryId)
      .is("clock_out_time", null)
      .select("id, clock_out_time, status, total_hours")
      .maybeSingle();
    if (error || !data?.id) {
      fail += 1;
      console.error(`  FAIL ${line}: ${error?.message ?? "0 rows"}`);
      continue;
    }
    ok += 1;
    console.log(
      `  fixed ${line} → status=${data.status} hours=${data.total_hours}`
    );
  }

  if (APPLY) {
    console.log(`Done: ${ok} fixed, ${fail} failed`);
  } else {
    console.log("Re-run with --apply to write.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
