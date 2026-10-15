/**
 * Deployed ingest identifies people by directory_employee_id.
 * GP-Client often omits employee_code; Directory remains SoT for the printable ID.
 *
 * Also freezes payee economics onto the hours document once:
 *   daily_rate_payroll + rate_snapshot (pay_through / gcash / bank).
 * Never overwrite a non-null snapshot from a later profile edit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CutoffHoursIngestRow } from "./cutoff-types";

export type PayeeRateSnapshot = {
  daily_rate: number | null;
  pay_through: string | null;
  gcash: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  stamped_at: string;
};

export type DirectoryEmployeeIdentity = {
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  daily_rate?: number | null;
  pay_through?: string | null;
  gcash?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
};

export type DirectoryEmployeeCodeMap = Map<string, DirectoryEmployeeIdentity>;

function blank(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === "";
}

function hasRateSnapshot(
  value: Record<string, unknown> | null | undefined
): boolean {
  return value != null && typeof value === "object";
}

export function buildPayeeRateSnapshot(
  person: DirectoryEmployeeIdentity,
  stampedAt: string = new Date().toISOString()
): PayeeRateSnapshot {
  const daily =
    person.daily_rate != null && Number(person.daily_rate) > 0
      ? Number(person.daily_rate)
      : null;
  return {
    daily_rate: daily,
    pay_through: blank(person.pay_through) ? null : String(person.pay_through).trim(),
    gcash: blank(person.gcash) ? null : String(person.gcash).trim(),
    bank_name: blank(person.bank_name) ? null : String(person.bank_name).trim(),
    bank_account_no: blank(person.bank_account_no)
      ? null
      : String(person.bank_account_no).trim(),
    stamped_at: stampedAt,
  };
}

export function stampEmployeeCodesOntoHours(
  hours: CutoffHoursIngestRow[],
  directory: DirectoryEmployeeCodeMap,
  stampedAt: string = new Date().toISOString()
): CutoffHoursIngestRow[] {
  if (!hours.length) return [];
  return hours.map((row) => {
    const person = directory.get(row.directory_employee_id);
    if (!person) return row;

    const next: CutoffHoursIngestRow = { ...row };
    if (blank(next.employee_code) && !blank(person.employee_code)) {
      next.employee_code = person.employee_code;
    }
    if (blank(next.last_name) && !blank(person.last_name)) {
      next.last_name = person.last_name;
    }
    if (blank(next.first_name) && !blank(person.first_name)) {
      next.first_name = person.first_name;
    }
    if (
      (next.daily_rate_payroll == null ||
        Number(next.daily_rate_payroll) === 0) &&
      person.daily_rate != null &&
      Number(person.daily_rate) > 0
    ) {
      next.daily_rate_payroll = Number(person.daily_rate);
    }
    if (!hasRateSnapshot(next.rate_snapshot ?? null)) {
      next.rate_snapshot = buildPayeeRateSnapshot(person, stampedAt);
    }
    return next;
  });
}

/**
 * Keep existing hours freeze when re-ingest sends blank rate/snapshot.
 * Call before stamp + upsert so profile edits cannot wipe a prior freeze.
 */
export function preserveExistingPayeeFreeze(
  incoming: CutoffHoursIngestRow[],
  existingByDirId: Map<
    string,
    {
      daily_rate_payroll?: number | null;
      rate_snapshot?: Record<string, unknown> | null;
    }
  >
): CutoffHoursIngestRow[] {
  if (!incoming.length) return [];
  return incoming.map((row) => {
    const existing = existingByDirId.get(row.directory_employee_id);
    if (!existing) return row;
    const next: CutoffHoursIngestRow = { ...row };
    if (
      (next.daily_rate_payroll == null ||
        Number(next.daily_rate_payroll) === 0) &&
      existing.daily_rate_payroll != null &&
      Number(existing.daily_rate_payroll) > 0
    ) {
      next.daily_rate_payroll = Number(existing.daily_rate_payroll);
    }
    if (
      !hasRateSnapshot(next.rate_snapshot ?? null) &&
      hasRateSnapshot(existing.rate_snapshot ?? null)
    ) {
      next.rate_snapshot = existing.rate_snapshot ?? null;
    }
    return next;
  });
}

/** Prefer hours rate_snapshot over live Directory for register payee fields. */
export function payeeFieldsFromHoursSnapshot(
  snap: Record<string, unknown> | null | undefined,
  fallback?: DirectoryEmployeeIdentity | null
): {
  daily_rate: number | null;
  bank_name: string | null;
  bank_account_no: string | null;
  pay_through: string | null;
  gcash: string | null;
} {
  const snapRate =
    snap?.daily_rate != null && Number(snap.daily_rate) > 0
      ? Number(snap.daily_rate)
      : null;
  const textOr = (
    key: "pay_through" | "gcash" | "bank_name" | "bank_account_no"
  ): string | null => {
    if (snap && key in snap) {
      const v = snap[key];
      if (v == null) return null;
      const t = String(v).trim();
      return t.length ? t : null;
    }
    const fb = fallback?.[key];
    if (fb == null) return null;
    const t = String(fb).trim();
    return t.length ? t : null;
  };
  return {
    daily_rate:
      snapRate ??
      (fallback?.daily_rate != null && Number(fallback.daily_rate) > 0
        ? Number(fallback.daily_rate)
        : null),
    bank_name: textOr("bank_name"),
    bank_account_no: textOr("bank_account_no"),
    pay_through: textOr("pay_through"),
    gcash: textOr("gcash"),
  };
}

export async function loadDirectoryEmployeeIdentities(
  directory: SupabaseClient,
  employeeIds: string[]
): Promise<DirectoryEmployeeCodeMap> {
  const unique = [...new Set(employeeIds.filter(Boolean))];
  const map: DirectoryEmployeeCodeMap = new Map();
  if (!unique.length) return map;

  const { data, error } = await directory
    .from("employees")
    .select(
      "id, employee_code, last_name, first_name, daily_rate, pay_through, gcash, bank_name, bank_account_no"
    )
    .in("id", unique);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    map.set(String(row.id), {
      employee_code: (row.employee_code as string | null) ?? null,
      last_name: (row.last_name as string | null) ?? null,
      first_name: (row.first_name as string | null) ?? null,
      daily_rate: row.daily_rate == null ? null : Number(row.daily_rate),
      pay_through: (row.pay_through as string | null) ?? null,
      gcash: (row.gcash as string | null) ?? null,
      bank_name: (row.bank_name as string | null) ?? null,
      bank_account_no: (row.bank_account_no as string | null) ?? null,
    });
  }
  return map;
}
