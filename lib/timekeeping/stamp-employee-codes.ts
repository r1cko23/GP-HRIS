/**
 * Deployed ingest identifies people by directory_employee_id.
 * GP-Client often omits employee_code; Directory remains SoT for the printable ID.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CutoffHoursIngestRow } from "./cutoff-types";

export type DirectoryEmployeeIdentity = {
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
};

export type DirectoryEmployeeCodeMap = Map<string, DirectoryEmployeeIdentity>;

function blank(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === "";
}

export function stampEmployeeCodesOntoHours(
  hours: CutoffHoursIngestRow[],
  directory: DirectoryEmployeeCodeMap
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
    return next;
  });
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
    .select("id, employee_code, last_name, first_name")
    .in("id", unique);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    map.set(String(row.id), {
      employee_code: (row.employee_code as string | null) ?? null,
      last_name: (row.last_name as string | null) ?? null,
      first_name: (row.first_name as string | null) ?? null,
    });
  }
  return map;
}
