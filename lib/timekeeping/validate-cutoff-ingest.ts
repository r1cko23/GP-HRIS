import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CutoffDtrPunchIngestRow,
  CutoffHoursIngestRow,
} from "./cutoff-types";

/**
 * Ingest eligibility is the Directory **employer** (Client) current Engagement.
 * Mid-cutoff Transfer between sister Branches keeps the same client_id — do not
 * require the live branch_id to match the cutoff period site. The Period / cutoff
 * already carries branch_id for payroll and billing per site.
 *
 * Distinct legal employers (e.g. SM Prime Pico vs Pico Beach Club) stay separate
 * Clients; those need Transfer across client_id, not branch-only.
 */
export function directoryIngestEmployeeFilters(opts: {
  organizationId: string;
  clientId: string;
  branchId?: string | null;
}): {
  organization_id: string;
  client_id: string;
  is_current_engagement: true;
} {
  void opts.branchId;
  return {
    organization_id: opts.organizationId,
    client_id: opts.clientId,
    is_current_engagement: true,
  };
}

export function missingIngestEmployeeIds(
  employeeIds: string[],
  found: Array<{ id: string; status?: string | null }>
): string[] {
  const unique = [...new Set(employeeIds.filter(Boolean))];
  const foundIds = new Set(found.map((row) => row.id));
  return unique.filter((id) => !foundIds.has(id));
}

export async function validateDirectoryEmployeesInClient(
  directory: SupabaseClient,
  organizationId: string,
  clientId: string,
  employeeIds: string[],
  branchId?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const unique = [...new Set(employeeIds.filter(Boolean))];
  if (!unique.length) return { ok: true };

  const filters = directoryIngestEmployeeFilters({
    organizationId,
    clientId,
    branchId,
  });

  const { data, error } = await directory
    .from("employees")
    .select("id, status, is_current_engagement")
    .eq("organization_id", filters.organization_id)
    .eq("client_id", filters.client_id)
    .eq("is_current_engagement", filters.is_current_engagement)
    .in("id", unique);

  if (error) return { ok: false, message: error.message };

  const missing = missingIngestEmployeeIds(unique, data ?? []);
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
