import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildOfficePatchFromDirectory,
  DIRECTORY_EMPLOYEE_SYNC_SELECT,
  type DirectoryEmployeeForOfficeSync,
} from "@/lib/directory/office-from-directory-sync";
import { directoryClient } from "@/lib/directory/auth";

export type EnrollmentResult = {
  ok: boolean;
  action?: "created" | "updated" | "skipped";
  office_employee_id?: string;
  error?: string;
  warning?: string;
};

function publicDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function isClientBundyEnabled(
  directory: SupabaseClient,
  organizationId: string,
  clientId: string | null | undefined
): Promise<boolean> {
  if (!clientId) return false;
  const { data } = await directory
    .from("clients")
    .select("bundy_enabled")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();
  return Boolean((data as { bundy_enabled?: boolean } | null)?.bundy_enabled);
}

export type EnrollOptions = {
  directoryEmployeeId: string;
  organizationId: string;
  locationIds?: string[];
  overtimeGroupId?: string | null;
  portalPassword?: string | null;
  updatedBy?: string | null;
  /** When true, require at least one location (explicit Office enroll). */
  requireLocations?: boolean;
};

/**
 * Link or create public.employees from a Directory employee (Bundy enrollment).
 * Does not invent a new person — Directory employee must already exist.
 */
export async function enrollFromDirectory(
  options: EnrollOptions
): Promise<EnrollmentResult> {
  const db = publicDb();
  if (!db) {
    return { ok: false, error: "Supabase service role missing" };
  }

  if (options.requireLocations && (!options.locationIds || options.locationIds.length === 0)) {
    return { ok: false, error: "Please assign at least one location" };
  }

  const directory = directoryClient();
  const { data: dirEmp, error: dirError } = await directory
    .from("employees")
    .select(DIRECTORY_EMPLOYEE_SYNC_SELECT)
    .eq("organization_id", options.organizationId)
    .eq("id", options.directoryEmployeeId)
    .maybeSingle();

  if (dirError) return { ok: false, error: dirError.message };
  if (!dirEmp) {
    return { ok: false, error: "Directory employee not found in this organization" };
  }

  const row = dirEmp as DirectoryEmployeeForOfficeSync;
  if (!row.employee_code?.trim()) {
    return { ok: false, error: "Directory employee has no employee_code" };
  }

  const { data: existing } = await db
    .from("employees")
    .select("id, employee_id")
    .eq("directory_employee_id", options.directoryEmployeeId)
    .maybeSingle();

  const patch = buildOfficePatchFromDirectory(row, {
    organicClientId: row.client_id,
    organicOrgId: options.organizationId,
    adoptDirectoryEmployeeCode: true,
    updatedBy: options.updatedBy,
    mode: "overwrite",
  });

  const code = row.employee_code.trim();
  if (options.portalPassword) {
    patch.portal_password = options.portalPassword;
  }
  if (options.overtimeGroupId) {
    patch.overtime_group_id = options.overtimeGroupId;
  }

  if (existing?.id) {
    const { error: updateError } = await db
      .from("employees")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) return { ok: false, error: updateError.message };

    if (options.locationIds && options.locationIds.length > 0) {
      await db
        .from("employee_location_assignments")
        .delete()
        .eq("employee_id", existing.id);
      const { error: locError } = await db
        .from("employee_location_assignments")
        .insert(
          options.locationIds.map((location_id) => ({
            employee_id: existing.id,
            location_id,
          }))
        );
      if (locError) {
        return {
          ok: true,
          action: "updated",
          office_employee_id: existing.id,
          warning: `Office row updated but locations failed: ${locError.message}`,
        };
      }
    }

    return {
      ok: true,
      action: "updated",
      office_employee_id: existing.id,
    };
  }

  const insertRow = {
    ...patch,
    employee_id: code,
    employee_code: code,
    portal_password: options.portalPassword || code,
    organization_id: options.organizationId,
    directory_employee_id: options.directoryEmployeeId,
    directory_client_id: row.client_id,
    created_by: options.updatedBy ?? null,
    updated_by: options.updatedBy ?? null,
  };

  const { data: inserted, error: insertError } = await db
    .from("employees")
    .insert(insertRow)
    .select("id")
    .single();

  if (insertError) return { ok: false, error: insertError.message };
  if (!inserted?.id) return { ok: false, error: "No office employee id returned" };

  if (options.locationIds && options.locationIds.length > 0) {
    const { error: locError } = await db
      .from("employee_location_assignments")
      .insert(
        options.locationIds.map((location_id) => ({
          employee_id: inserted.id,
          location_id,
        }))
      );
    if (locError) {
      await db.from("employees").delete().eq("id", inserted.id);
      return { ok: false, error: `Failed to save locations: ${locError.message}` };
    }
  }

  return {
    ok: true,
    action: "created",
    office_employee_id: inserted.id,
  };
}

/**
 * Best-effort auto-enroll after Engagement hire/rehire when Client.bundy_enabled.
 * Engagement always commits; enrollment failure becomes a warning.
 */
export async function maybeAutoEnrollAfterEngagement(input: {
  directoryEmployeeId: string;
  organizationId: string;
  clientId: string | null;
  updatedBy?: string | null;
}): Promise<EnrollmentResult> {
  const directory = directoryClient();
  const enabled = await isClientBundyEnabled(
    directory,
    input.organizationId,
    input.clientId
  );
  if (!enabled) {
    return { ok: true, action: "skipped" };
  }

  return enrollFromDirectory({
    directoryEmployeeId: input.directoryEmployeeId,
    organizationId: input.organizationId,
    updatedBy: input.updatedBy,
    requireLocations: false,
  });
}
