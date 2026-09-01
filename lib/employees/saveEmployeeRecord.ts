import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeFormData } from "./employeeFormState";
import type { EmployeeForForm } from "./employeeFormState";
import { buildOfficeEmployeePayload } from "./office-201-map";

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

export type SaveEmployeeResult = {
  id: string;
  employee_id?: string;
};

export async function saveEmployeeRecord({
  supabase,
  formData,
  locations,
  editingEmployee,
  isAdmin,
  isHR,
}: SaveEmployeeRecordParams): Promise<SaveEmployeeResult> {
  if (formData.locations.length === 0) {
    throw new Error("Please assign at least one location");
  }

  const code = (formData.employee_code || formData.employee_id).trim();
  if (editingEmployee && !code) {
    throw new Error("Employee code is required");
  }

  const locationMap = new Map<string, string>();
  locations.forEach((loc) => locationMap.set(loc.id, loc.name));

  const primaryLocationName =
    formData.locations.length > 0
      ? locationMap.get(formData.locations[0]) ||
        locations.find((loc) => loc.id === formData.locations[0])?.name ||
        null
      : null;

  const employeeData = {
    ...buildOfficeEmployeePayload(formData),
    assigned_hotel: primaryLocationName,
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
    return {
      id: editingEmployee.id,
      employee_id: code || editingEmployee.employee_id || undefined,
    };
  }

  throw new Error(
    "New office people must be hired in Directory, then enrolled for Bundy at /time/enrollment/new."
  );
}
