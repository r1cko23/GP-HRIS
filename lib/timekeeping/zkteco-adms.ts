import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ATTLOG_STAMP_FROM_2026,
  BIOMETRIC_FINGERPRINT,
  DEFAULT_MB10_SERIAL,
  GREEN_PASTURE_LOCATION_NAME,
  biometricDeviceLabel,
  decidePunchAction,
  isBiometricClockDevice,
  isStaleAttlogPunch,
  manilaDateKey,
  manilaLocalToIso,
  openBiometricPairsPunch,
  parseAttlogBody,
  planBiometricPunch,
  type ClockSlot,
  type PunchAction,
} from "@/lib/timekeeping/zkteco-attlog";
import { parseOperlogUsers } from "@/lib/timekeeping/zkteco-operlog";
import { UNMAPPED_SKIP_REASON } from "@/lib/timekeeping/biometric-unmapped";
import {
  backfillMapKey,
  selectMappedSkipsForBackfill,
  type SkippedPunchHint,
} from "@/lib/timekeeping/biometric-backfill";

export type ApplyAttlogResult = {
  ok: boolean;
  processed: number;
  clockIns: number;
  clockOuts: number;
  skipped: number;
  errors: string[];
};

type DeviceRow = {
  id: string;
  serial_number: string;
  office_location_name: string;
  is_active: boolean;
};

async function findOpenEntry(
  admin: SupabaseClient,
  employeeId: string
): Promise<ClockSlot | null> {
  const { data } = await admin
    .from("time_clock_entries")
    .select("id, clock_in_device, clock_out_time, clock_in_date_ph")
    .eq("employee_id", employeeId)
    .is("clock_out_time", null)
    .order("clock_in_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return null;
  return {
    id: data.id as string,
    device: (data.clock_in_device as string | null) ?? null,
    clockOutTime: (data.clock_out_time as string | null) ?? null,
    datePh: String(data.clock_in_date_ph ?? ""),
  };
}

async function findSameDayEntry(
  admin: SupabaseClient,
  employeeId: string,
  datePh: string
): Promise<ClockSlot | null> {
  const { data } = await admin
    .from("time_clock_entries")
    .select("id, clock_in_device, clock_out_time, clock_in_date_ph")
    .eq("employee_id", employeeId)
    .eq("clock_in_date_ph", datePh)
    .maybeSingle();
  if (!data?.id) return null;
  return {
    id: data.id as string,
    device: (data.clock_in_device as string | null) ?? null,
    clockOutTime: (data.clock_out_time as string | null) ?? null,
    datePh: String(data.clock_in_date_ph ?? datePh),
  };
}

async function employeeHasGreenPastureLocation(
  admin: SupabaseClient,
  employeeId: string,
  locationName: string
): Promise<boolean> {
  const { data: locs } = await admin
    .from("office_locations")
    .select("id")
    .ilike("name", locationName)
    .limit(5);

  const locationIds = (locs ?? []).map((l) => l.id as string);
  if (!locationIds.length) return false;

  const { data: assign } = await admin
    .from("employee_location_assignments")
    .select("id")
    .eq("employee_id", employeeId)
    .in("location_id", locationIds)
    .limit(1)
    .maybeSingle();

  if (assign?.id) return true;

  // Legacy: assigned_hotel name match
  const { data: emp } = await admin
    .from("employees")
    .select("assigned_hotel")
    .eq("id", employeeId)
    .maybeSingle();

  return (
    typeof emp?.assigned_hotel === "string" &&
    emp.assigned_hotel.toLowerCase() === locationName.toLowerCase()
  );
}

async function resolveEmployeeId(
  admin: SupabaseClient,
  deviceId: string,
  deviceUserId: string
): Promise<string | null> {
  const { data: mapped } = await admin
    .from("biometric_user_maps")
    .select("employee_id")
    .eq("device_id", deviceId)
    .eq("device_user_id", deviceUserId)
    .maybeSingle();

  if (mapped?.employee_id) return mapped.employee_id as string;

  // Fallback: public.employees.employee_id (badge/code) matches device PIN
  const { data: byCode } = await admin
    .from("employees")
    .select("id")
    .eq("employee_id", deviceUserId)
    .eq("is_active", true)
    .maybeSingle();

  return byCode?.id ? (byCode.id as string) : null;
}

async function alreadyProcessed(
  admin: SupabaseClient,
  deviceId: string,
  deviceUserId: string,
  punchedAtIso: string,
  statusCode: number | null
): Promise<boolean> {
  let q = admin
    .from("biometric_punch_events")
    .select("id")
    .eq("device_id", deviceId)
    .eq("device_user_id", deviceUserId)
    .eq("punched_at", punchedAtIso)
    .limit(1);

  if (statusCode === null) {
    q = q.is("status_code", null);
  } else {
    q = q.eq("status_code", statusCode);
  }

  const { data } = await q.maybeSingle();
  return Boolean(data?.id);
}

async function recordEvent(
  admin: SupabaseClient,
  row: {
    device_id: string;
    device_user_id: string;
    punched_at: string;
    status_code: number | null;
    raw_line: string;
    time_clock_entry_id: string | null;
    action: string;
    skip_reason: string | null;
  }
) {
  await admin.from("biometric_punch_events").insert(row);
}

async function officeLocationCoords(
  admin: SupabaseClient,
  locationName: string
): Promise<{ coords: string; name: string } | null> {
  const { data } = await admin
    .from("office_locations")
    .select("name, latitude, longitude")
    .eq("name", locationName)
    .eq("is_active", true)
    .maybeSingle();
  if (
    !data ||
    typeof data.latitude !== "number" ||
    typeof data.longitude !== "number"
  ) {
    return null;
  }
  return {
    name: data.name as string,
    coords: `${data.latitude},${data.longitude}`,
  };
}

async function applyOneAction(
  admin: SupabaseClient,
  opts: {
    employeeId: string;
    action: PunchAction;
    punchedAtIso: string;
    locationCoords: string;
    deviceLabel: string;
    open: ClockSlot | null;
  }
): Promise<{ entryId: string | null; error?: string }> {
  const { employeeId, action, punchedAtIso, locationCoords, deviceLabel, open } =
    opts;

  if (action === "ignore") {
    return { entryId: null };
  }

  const sameDay = await findSameDayEntry(
    admin,
    employeeId,
    manilaDateKey(punchedAtIso)
  );
  const plan = planBiometricPunch({
    action,
    punchDatePh: manilaDateKey(punchedAtIso),
    sameDay,
    open,
  });

  if (plan.kind === "skip") {
    return { entryId: null, error: plan.reason };
  }

  if (plan.kind === "replace_in") {
    const { data, error } = await admin
      .from("time_clock_entries")
      .update({
        clock_in_time: punchedAtIso,
        clock_in_location: locationCoords,
        clock_in_device: deviceLabel,
        clock_in_fingerprint: BIOMETRIC_FINGERPRINT,
        clock_out_time: null,
        clock_out_location: null,
        clock_out_device: null,
        clock_out_fingerprint: null,
        status: "clocked_in",
      })
      .eq("id", plan.entryId)
      .select("id")
      .maybeSingle();
    if (error) return { entryId: null, error: error.message };
    if (!data?.id) {
      return { entryId: null, error: `Replace-in updated 0 rows (${plan.entryId})` };
    }
    return { entryId: plan.entryId };
  }

  if (plan.kind === "insert") {
    const { data, error } = await admin
      .from("time_clock_entries")
      .insert({
        employee_id: employeeId,
        clock_in_time: punchedAtIso,
        clock_in_location: locationCoords,
        clock_in_device: deviceLabel,
        clock_in_fingerprint: BIOMETRIC_FINGERPRINT,
        status: "clocked_in",
        is_manual_entry: false,
      })
      .select("id")
      .single();

    if (error) return { entryId: null, error: error.message };
    return { entryId: data.id as string };
  }

  const { data, error } = await admin
    .from("time_clock_entries")
    .update({
      clock_out_time: punchedAtIso,
      clock_out_location: locationCoords,
      clock_out_device: deviceLabel,
      clock_out_fingerprint: BIOMETRIC_FINGERPRINT,
      status: "clocked_out",
    })
    .eq("id", plan.entryId)
    .select("id")
    .maybeSingle();

  if (error) return { entryId: null, error: error.message };
  if (!data?.id) {
    return { entryId: null, error: `Clock-out updated 0 rows (${plan.entryId})` };
  }
  return { entryId: plan.entryId };
}

export async function ensureDefaultDevice(
  admin: SupabaseClient,
  serial = DEFAULT_MB10_SERIAL
): Promise<DeviceRow | null> {
  const { data: existing } = await admin
    .from("biometric_devices")
    .select("id, serial_number, office_location_name, is_active")
    .eq("serial_number", serial)
    .maybeSingle();

  if (existing) return existing as DeviceRow;

  // Only auto-seed the known office MB10-VL — never invent devices for random SN
  if (serial !== DEFAULT_MB10_SERIAL) return null;

  const { data, error } = await admin
    .from("biometric_devices")
    .insert({
      serial_number: serial,
      name: "Green Pasture MB10-VL",
      office_location_name: GREEN_PASTURE_LOCATION_NAME,
      is_active: true,
    })
    .select("id, serial_number, office_location_name, is_active")
    .single();

  if (error) return null;
  return data as DeviceRow;
}

export async function touchDevice(
  admin: SupabaseClient,
  deviceId: string,
  attlogStamp?: string | null
) {
  const patch: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (attlogStamp !== undefined && attlogStamp !== null) {
    patch.attlog_stamp = attlogStamp;
  }
  await admin.from("biometric_devices").update(patch).eq("id", deviceId);
}

/** Upsert terminal PIN → name from OPERLOG / USERINFO. */
export async function upsertDeviceUsers(
  admin: SupabaseClient,
  deviceId: string,
  body: string
): Promise<{ upserted: number }> {
  const users = parseOperlogUsers(body);
  let upserted = 0;
  for (const u of users) {
    const { error } = await admin.from("biometric_device_users").upsert(
      {
        device_id: deviceId,
        device_user_id: u.deviceUserId,
        display_name: u.displayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,device_user_id" }
    );
    if (!error) upserted += 1;
  }
  return { upserted };
}

/** Queue DATA QUERY USERINFO so the next getrequest pulls names from the terminal. */
export async function requestUserInfoSync(
  admin: SupabaseClient,
  serialNumber = DEFAULT_MB10_SERIAL
): Promise<{ ok: boolean; error?: string }> {
  const device = await ensureDefaultDevice(admin, serialNumber);
  if (!device?.id) {
    return { ok: false, error: `Device ${serialNumber} not found` };
  }
  const { error } = await admin
    .from("biometric_devices")
    .update({
      pending_command: "DATA QUERY USERINFO",
      updated_at: new Date().toISOString(),
    })
    .eq("id", device.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Pop pending ADMS command for getrequest.
 * Returns plain command text (caller wraps as C:id:cmd) or null.
 */
export async function takePendingCommand(
  admin: SupabaseClient,
  deviceId: string
): Promise<string | null> {
  const { data } = await admin
    .from("biometric_devices")
    .select("pending_command")
    .eq("id", deviceId)
    .maybeSingle();
  const cmd = (data?.pending_command as string | null)?.trim();
  if (!cmd) return null;
  await admin
    .from("biometric_devices")
    .update({
      pending_command: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deviceId);
  return cmd;
}

export async function applyOperlogPush(
  admin: SupabaseClient,
  opts: { serialNumber: string; body: string; stamp?: string | null }
): Promise<{ upserted: number; ok: boolean }> {
  const { data: device } = await admin
    .from("biometric_devices")
    .select("id, is_active")
    .eq("serial_number", opts.serialNumber)
    .maybeSingle();

  if (!device?.id || !device.is_active) {
    return { upserted: 0, ok: false };
  }

  const { upserted } = await upsertDeviceUsers(admin, device.id as string, opts.body);
  const patch: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (opts.stamp) patch.operlog_stamp = opts.stamp;
  await admin.from("biometric_devices").update(patch).eq("id", device.id);
  return { upserted, ok: true };
}

export async function applyAttlogPush(
  admin: SupabaseClient,
  opts: { serialNumber: string; body: string; stamp?: string | null }
): Promise<ApplyAttlogResult> {
  const errors: string[] = [];
  let processed = 0;
  let clockIns = 0;
  let clockOuts = 0;
  let skipped = 0;

  const { data: device } = await admin
    .from("biometric_devices")
    .select("id, serial_number, office_location_name, is_active")
    .eq("serial_number", opts.serialNumber)
    .maybeSingle();

  if (!device || !device.is_active) {
    return {
      ok: false,
      processed: 0,
      clockIns: 0,
      clockOuts: 0,
      skipped: 0,
      errors: [`Unknown or inactive device SN=${opts.serialNumber}`],
    };
  }

  const locationName =
    (device.office_location_name as string) || GREEN_PASTURE_LOCATION_NAME;
  const deviceLabel = biometricDeviceLabel(String(device.serial_number));
  const office = await officeLocationCoords(admin, locationName);
  // Prefer GP lat,lng so Entries shows name + Burgundy address like GPS bundy.
  // Fall back to office name (also resolved by resolveLocationDetails).
  const locationCoords = office?.coords ?? locationName;
  const rows = parseAttlogBody(opts.body);

  for (const row of rows) {
    processed += 1;
    const punchedAtIso = manilaLocalToIso(row.punchedAtLocal);
    if (!punchedAtIso) {
      skipped += 1;
      errors.push(`Bad timestamp: ${row.rawLine}`);
      continue;
    }

    if (isStaleAttlogPunch(punchedAtIso)) {
      skipped += 1;
      if (
        !(await alreadyProcessed(
          admin,
          device.id,
          row.deviceUserId,
          punchedAtIso,
          row.statusCode
        ))
      ) {
        await recordEvent(admin, {
          device_id: device.id,
          device_user_id: row.deviceUserId,
          punched_at: punchedAtIso,
          status_code: row.statusCode,
          raw_line: row.rawLine,
          time_clock_entry_id: null,
          action: "skipped",
          skip_reason: "Pre-2026 or stale ATTLOG buffer (ignored)",
        });
      }
      continue;
    }

    if (
      await alreadyProcessed(
        admin,
        device.id,
        row.deviceUserId,
        punchedAtIso,
        row.statusCode
      )
    ) {
      skipped += 1;
      continue;
    }

    const employeeId = await resolveEmployeeId(
      admin,
      device.id,
      row.deviceUserId
    );
    if (!employeeId) {
      skipped += 1;
      await recordEvent(admin, {
        device_id: device.id,
        device_user_id: row.deviceUserId,
        punched_at: punchedAtIso,
        status_code: row.statusCode,
        raw_line: row.rawLine,
        time_clock_entry_id: null,
        action: "skipped",
        skip_reason: UNMAPPED_SKIP_REASON,
      });
      errors.push(`Unmapped PIN ${row.deviceUserId}`);
      continue;
    }

    const allowed = await employeeHasGreenPastureLocation(
      admin,
      employeeId,
      locationName
    );
    if (!allowed) {
      skipped += 1;
      await recordEvent(admin, {
        device_id: device.id,
        device_user_id: row.deviceUserId,
        punched_at: punchedAtIso,
        status_code: row.statusCode,
        raw_line: row.rawLine,
        time_clock_entry_id: null,
        action: "skipped",
        skip_reason: `Not assigned to ${locationName}`,
      });
      errors.push(`PIN ${row.deviceUserId} not at ${locationName}`);
      continue;
    }

    const { data: emp } = await admin
      .from("employees")
      .select("id, is_active")
      .eq("id", employeeId)
      .maybeSingle();

    if (!emp?.is_active) {
      skipped += 1;
      await recordEvent(admin, {
        device_id: device.id,
        device_user_id: row.deviceUserId,
        punched_at: punchedAtIso,
        status_code: row.statusCode,
        raw_line: row.rawLine,
        time_clock_entry_id: null,
        action: "skipped",
        skip_reason: "Employee inactive",
      });
      continue;
    }

    const open = await findOpenEntry(admin, employeeId);
    // Phone bundy left open must not turn the first biometric punch into an OUT.
    // Multi-day stale biometric opens must not either — only same day / overnight.
    const punchDatePh = manilaDateKey(punchedAtIso);
    const action = decidePunchAction(
      row.statusCode,
      openBiometricPairsPunch(open, punchDatePh)
    );

    const result = await applyOneAction(admin, {
      employeeId,
      action,
      punchedAtIso,
      locationCoords,
      deviceLabel,
      open,
    });

    if (result.error) {
      skipped += 1;
      await recordEvent(admin, {
        device_id: device.id,
        device_user_id: row.deviceUserId,
        punched_at: punchedAtIso,
        status_code: row.statusCode,
        raw_line: row.rawLine,
        time_clock_entry_id: null,
        action: "skipped",
        skip_reason: result.error,
      });
      errors.push(`${row.deviceUserId}: ${result.error}`);
      continue;
    }

    await recordEvent(admin, {
      device_id: device.id,
      device_user_id: row.deviceUserId,
      punched_at: punchedAtIso,
      status_code: row.statusCode,
      raw_line: row.rawLine,
      time_clock_entry_id: result.entryId,
      action,
      skip_reason: null,
    });

    if (action === "clock_in") clockIns += 1;
    if (action === "clock_out") clockOuts += 1;
  }

  // Only advance ATTLOGStamp when this batch included at least one 2026+ punch.
  // Otherwise keep the skip-to-2026 floor so the device stops replaying 2024/2025.
  const hadFresh = rows.some((row) => {
    const iso = manilaLocalToIso(row.punchedAtLocal);
    return iso ? !isStaleAttlogPunch(iso) : false;
  });
  if (hadFresh) {
    await touchDevice(admin, device.id, opts.stamp ?? null);
  } else {
    await touchDevice(admin, device.id, null);
  }

  return {
    ok: errors.length === 0 || clockIns + clockOuts > 0,
    processed,
    clockIns,
    clockOuts,
    skipped,
    errors,
  };
}

/** Queue name sync + tell device ATTLOG starts at 2026 (skip 2024/2025 replay). */
export async function skipAttlogBufferTo2026(
  admin: SupabaseClient,
  serialNumber = DEFAULT_MB10_SERIAL
): Promise<{ ok: boolean; error?: string }> {
  const device = await ensureDefaultDevice(admin, serialNumber);
  if (!device?.id) {
    return { ok: false, error: `Device ${serialNumber} not found` };
  }

  const { error } = await admin
    .from("biometric_devices")
    .update({
      attlog_stamp: ATTLOG_STAMP_FROM_2026,
      pending_command:
        "DATA QUERY ATTLOG StartTime=2026-01-01 00:00:00\tEndTime=2026-12-31 23:59:59",
      updated_at: new Date().toISOString(),
    })
    .eq("id", device.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function employeeUsesBiometricPunch(
  admin: SupabaseClient,
  employeeId: string
): Promise<boolean> {
  const { data } = await admin
    .from("biometric_user_maps")
    .select("id")
    .eq("employee_id", employeeId)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Re-apply skipped-unmapped ATTLOG rows from `fromIso` for PINs that now have maps.
 * Chronological; biometric overwrites same-day phone bundy (source of truth).
 */
export async function reprocessMappedAttlogFrom(
  admin: SupabaseClient,
  opts: { fromIso: string; serialNumber?: string }
): Promise<{
  ok: boolean;
  considered: number;
  clockIns: number;
  clockOuts: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let clockIns = 0;
  let clockOuts = 0;
  let skipped = 0;

  const serial = opts.serialNumber ?? DEFAULT_MB10_SERIAL;
  const device = await ensureDefaultDevice(admin, serial);
  if (!device?.id) {
    return {
      ok: false,
      considered: 0,
      clockIns: 0,
      clockOuts: 0,
      skipped: 0,
      errors: [`Device ${serial} not found`],
    };
  }

  const locationName =
    (device.office_location_name as string) || GREEN_PASTURE_LOCATION_NAME;
  const deviceLabel = biometricDeviceLabel(String(device.serial_number));
  const office = await officeLocationCoords(admin, locationName);
  const locationCoords = office?.coords ?? locationName;

  const { data: maps, error: mapsErr } = await admin
    .from("biometric_user_maps")
    .select("device_id, device_user_id")
    .eq("device_id", device.id);
  if (mapsErr) {
    return {
      ok: false,
      considered: 0,
      clockIns: 0,
      clockOuts: 0,
      skipped: 0,
      errors: [mapsErr.message],
    };
  }
  const mappedKeys = new Set(
    (maps ?? []).map((m) =>
      backfillMapKey(m.device_id as string, m.device_user_id as string)
    )
  );

  // Page through skipped unmapped events for this device
  const pageSize = 1000;
  let offset = 0;
  const allEvents: SkippedPunchHint[] = [];
  for (;;) {
    const { data: page, error: evErr } = await admin
      .from("biometric_punch_events")
      .select(
        "id, device_id, device_user_id, punched_at, status_code, raw_line, skip_reason"
      )
      .eq("device_id", device.id)
      .eq("skip_reason", UNMAPPED_SKIP_REASON)
      .gte("punched_at", opts.fromIso)
      .order("punched_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (evErr) {
      return {
        ok: false,
        considered: 0,
        clockIns: 0,
        clockOuts: 0,
        skipped: 0,
        errors: [evErr.message],
      };
    }
    const rows = (page ?? []) as SkippedPunchHint[];
    allEvents.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const selected = selectMappedSkipsForBackfill(
    allEvents,
    mappedKeys,
    opts.fromIso
  );

  for (const ev of selected) {
    const punchedAtIso = ev.punched_at;
    const employeeId = await resolveEmployeeId(
      admin,
      device.id,
      ev.device_user_id
    );
    if (!employeeId) {
      skipped += 1;
      continue;
    }

    const allowed = await employeeHasGreenPastureLocation(
      admin,
      employeeId,
      locationName
    );
    if (!allowed) {
      skipped += 1;
      errors.push(`PIN ${ev.device_user_id} not at ${locationName}`);
      await admin
        .from("biometric_punch_events")
        .update({
          skip_reason: `Not assigned to ${locationName}`,
        })
        .eq("id", ev.id);
      continue;
    }

    const { data: emp } = await admin
      .from("employees")
      .select("id, is_active")
      .eq("id", employeeId)
      .maybeSingle();
    if (!emp?.is_active) {
      skipped += 1;
      continue;
    }

    const open = await findOpenEntry(admin, employeeId);
    const punchDatePh = manilaDateKey(punchedAtIso);
    const action = decidePunchAction(
      ev.status_code,
      openBiometricPairsPunch(open, punchDatePh)
    );
    if (action === "ignore") {
      skipped += 1;
      continue;
    }

    const result = await applyOneAction(admin, {
      employeeId,
      action,
      punchedAtIso,
      locationCoords,
      deviceLabel,
      open,
    });

    if (result.error) {
      skipped += 1;
      errors.push(`${ev.device_user_id}: ${result.error}`);
      await admin
        .from("biometric_punch_events")
        .update({
          action: "skipped",
          skip_reason: result.error,
          time_clock_entry_id: null,
        })
        .eq("id", ev.id);
      continue;
    }

    await admin
      .from("biometric_punch_events")
      .update({
        action,
        skip_reason: null,
        time_clock_entry_id: result.entryId,
      })
      .eq("id", ev.id);

    if (action === "clock_in") clockIns += 1;
    if (action === "clock_out") clockOuts += 1;
  }

  return {
    ok: errors.length === 0 || clockIns + clockOuts > 0,
    considered: selected.length,
    clockIns,
    clockOuts,
    skipped,
    errors: errors.slice(0, 50),
  };
}
