export interface EmployeeFormData {
  employee_id: string;
  last_name: string;
  first_name: string;
  middle_initial: string;
  assigned_hotel: string;
  locations: string[];
  address: string;
  birth_date: string;
  gender: string;
  hire_date: string;
  tin_number: string;
  sss_number: string;
  philhealth_number: string;
  pagibig_number: string;
  hmo_provider: string;
  paternity_days: string;
  position: string;
  job_level: string;
  employee_type: string;
  monthly_rate: string;
  per_day: string;
  eligible_for_ot: boolean;
  overtime_group_id: string;
  transferred_from_employee_id: string;
}

export interface EmployeeForForm {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  middle_initial?: string | null;
  assigned_hotel?: string | null;
  address?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  tin_number?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  hmo_provider?: string | null;
  gender?: string | null;
  position?: string | null;
  job_level?: string | null;
  employee_type?: string | null;
  monthly_rate?: number | null;
  per_day?: number | null;
  eligible_for_ot?: boolean | null;
  overtime_group_id?: string | null;
  transferred_from_employee_id?: string | null;
  employee_location_assignments?: {
    location_id: string;
    office_locations?: { id: string; name: string } | null;
  }[];
}

export function createEmptyEmployeeForm(): EmployeeFormData {
  return {
    employee_id: "",
    last_name: "",
    first_name: "",
    middle_initial: "",
    assigned_hotel: "",
    locations: [],
    address: "",
    birth_date: "",
    gender: "",
    hire_date: "",
    tin_number: "",
    sss_number: "",
    philhealth_number: "",
    pagibig_number: "",
    hmo_provider: "",
    paternity_days: "",
    position: "",
    job_level: "",
    employee_type: "office-based",
    monthly_rate: "",
    per_day: "",
    eligible_for_ot: false,
    overtime_group_id: "",
    transferred_from_employee_id: "",
  };
}

export function employeeRecordToFormData(employee: EmployeeForForm): EmployeeFormData {
  return {
    employee_id: employee.employee_id,
    last_name: employee.last_name || "",
    first_name: employee.first_name || "",
    middle_initial: employee.middle_initial || "",
    assigned_hotel: employee.assigned_hotel || "",
    locations:
      employee.employee_location_assignments?.map((a) => a.location_id) || [],
    address: employee.address || "",
    birth_date: employee.birth_date
      ? new Date(employee.birth_date).toISOString().slice(0, 10)
      : "",
    gender: employee.gender || "",
    hire_date: employee.hire_date
      ? new Date(employee.hire_date).toISOString().slice(0, 10)
      : "",
    tin_number: employee.tin_number || "",
    sss_number: employee.sss_number || "",
    philhealth_number: employee.philhealth_number || "",
    pagibig_number: employee.pagibig_number || "",
    hmo_provider: employee.hmo_provider || "",
    paternity_days: "",
    position: employee.position || "",
    job_level: employee.job_level || "",
    employee_type: employee.employee_type || "office-based",
    monthly_rate: employee.monthly_rate?.toString() || "",
    per_day: employee.per_day?.toString() || "",
    eligible_for_ot: employee.eligible_for_ot || false,
    overtime_group_id: employee.overtime_group_id || "none",
    transferred_from_employee_id: employee.transferred_from_employee_id || "",
  };
}
