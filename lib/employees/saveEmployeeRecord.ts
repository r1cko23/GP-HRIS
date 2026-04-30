import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeFormData } from "./employeeFormState";
import type { EmployeeForForm } from "./employeeFormState";

export interface OfficeLocation {
  id: string;
  name: string;
}

export async function saveEmployeeLocations(
  supabase: SupabaseClient,
  employeeId: string,
  locationIds: string[]
) {
  const { error: deleteError } = await supabase
    .from("employee_location_assignments")
    .delete()
    .eq("employee_id", employeeId);

  if (deleteError) throw deleteError;

  if (locationIds.length === 0) {
    return;
  }

  const inserts = locationIds.map((location_id) => ({
    employee_id: employeeId,
    location_id,
  }));

  const { error: insertError } = await (
    supabase.from("employee_location_assignments") as any
  ).insert(inserts);

  if (insertError) throw insertError;
}

export interface SaveEmployeeRecordParams {
  supabase: SupabaseClient;
  formData: EmployeeFormData;
  locations: OfficeLocation[];
  editingEmployee: EmployeeForForm | null;
  isAdmin: boolean;
  isHR: boolean;
}

export async function saveEmployeeRecord({
  supabase,
  formData,
  locations,
  editingEmployee,
  isAdmin,
  isHR,
}: SaveEmployeeRecordParams): Promise<string | undefined> {
  if (formData.locations.length === 0) {
    throw new Error("Please assign at least one location");
  }

  const locationMap = new Map<string, string>();
  locations.forEach((loc) => locationMap.set(loc.id, loc.name));

  const middleInitial = formData.middle_initial
    ? ` ${formData.middle_initial}.`
    : "";
  const full_name = `${formData.first_name}${middleInitial} ${formData.last_name}`;

  const primaryLocationName =
    formData.locations.length > 0
      ? locationMap.get(formData.locations[0]) ||
        locations.find((loc) => loc.id === formData.locations[0])?.name ||
        null
      : null;

  const employeeData = {
    employee_id: formData.employee_id,
    full_name: full_name.trim(),
    last_name: formData.last_name,
    first_name: formData.first_name,
    middle_initial: formData.middle_initial || null,
    assigned_hotel: primaryLocationName,
    address: formData.address || null,
    birth_date: formData.birth_date || null,
    hire_date: formData.hire_date || null,
    tin_number: formData.tin_number || null,
    sss_number: formData.sss_number || null,
    philhealth_number: formData.philhealth_number || null,
    pagibig_number: formData.pagibig_number || null,
    hmo_provider: formData.hmo_provider || null,
    gender: formData.gender || null,
    position: formData.position || null,
    job_level: formData.job_level || null,
    employee_type: formData.employee_type || "office-based",
    monthly_rate: formData.monthly_rate
      ? parseFloat(formData.monthly_rate)
      : null,
    per_day: formData.per_day ? parseFloat(formData.per_day) : null,
    eligible_for_ot: formData.eligible_for_ot,
    overtime_group_id:
      formData.overtime_group_id && formData.overtime_group_id !== "none"
        ? formData.overtime_group_id
        : null,
    transferred_from_employee_id:
      formData.transferred_from_employee_id &&
      formData.transferred_from_employee_id !== "none"
        ? formData.transferred_from_employee_id
        : null,
    paternity_credits:
      formData.gender === "male"
        ? parseFloat(formData.paternity_days || "0") || 0
        : 0,
  };

  if (editingEmployee) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      throw new Error("Authentication error. Please log in again.");
    }

    const updateData: Record<string, unknown> = {
      ...employeeData,
      updated_by: authUser.id,
    };

    if (!isAdmin && isHR) {
      delete updateData.hire_date;
    }

    const { error } = await (supabase.from("employees") as any)
      .update(updateData)
      .eq("id", editingEmployee.id)
      .select();

    if (error) throw error;
    await saveEmployeeLocations(supabase, editingEmployee.id, formData.locations);
    return editingEmployee.id;
  } else {
    // Create via server API to avoid client-side RLS issues and to keep
    // employee + location assignments consistent (best-effort rollback).
    const res = await fetch("/api/employees/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee: {
          ...employeeData,
          portal_password: formData.employee_id,
        },
        locationIds: formData.locations,
      }),
    });

    const payload = (await res.json().catch(() => null)) as
      | { id?: string; error?: string; details?: string }
      | null;

    if (!res.ok) {
      const message =
        payload?.error ||
        payload?.details ||
        `Failed to create employee (HTTP ${res.status})`;
      throw new Error(message);
    }

    const employeeId = payload?.id || "";
    return employeeId || undefined;
  }
}
