import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CutoffDtrPunchIngestRow,
  CutoffHoursIngestRow,
} from "./cutoff-types";

export async function validateDirectoryEmployeesInClient(
  directory: SupabaseClient,
  organizationId: string,
  clientId: string,
  employeeIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const unique = [...new Set(employeeIds.filter(Boolean))];
  if (!unique.length) return { ok: true };

  const { data, error } = await directory
    .from("employees")
    .select("id, status, is_current_engagement")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("is_current_engagement", true)
    .in("id", unique);

  if (error) return { ok: false, message: error.message };

  const found = new Map(
    (data ?? []).map((row) => [row.id as string, row.status as string])
  );
  const missing = unique.filter((id) => !found.has(id));
  if (missing.length) {
    return {
      ok: false,
      message: `Directory employee(s) not in client (current engagement only): ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`,
    };
  }

  return { ok: true };
}

export function collectEmployeeIds(
  hours: CutoffHoursIngestRow[],
  punches: CutoffDtrPunchIngestRow[]
): string[] {
  return [
    ...hours.map((h) => h.directory_employee_id),
    ...punches.map((p) => p.directory_employee_id),
  ];
}
