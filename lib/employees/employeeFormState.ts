export interface EmployeeFormData {
  employee_code: string;
  employee_id: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  middle_initial: string;
  assigned_hotel: string;
  locations: string[];
  address: string;
  birth_date: string;
  sex: string;
  gender: string;
  status: string;
  hire_date: string;
  regular_date: string;
  resign_date: string;
  tin: string;
  tin_number: string;
  sss_number: string;
  philhealth_number: string;
  pagibig_number: string;
  tax_status: string;
  email: string;
  mobile: string;
  bank_name: string;
  bank_account_no: string;
  gcash: string;
  pay_through: string;
  hmo_provider: string;
  paternity_days: string;
  position: string;
  job_level: string;
  employee_type: string;
  monthly_rate: string;
  daily_rate: string;
  per_day: string;
  eligible_for_ot: boolean;
  overtime_group_id: string;
  transferred_from_employee_id: string;
  directory_employee_id: string;
  directory_client_id: string;
}

export interface EmployeeForForm {
  id: string;
  employee_id: string;
  employee_code?: string | null;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  middle_initial?: string | null;
  assigned_hotel?: string | null;
  address?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  regular_date?: string | null;
  resign_date?: string | null;
  tin?: string | null;
  tin_number?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  tax_status?: string | null;
  email?: string | null;
  mobile?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  gcash?: string | null;
  pay_through?: string | null;
  hmo_provider?: string | null;
  sex?: string | null;
  gender?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  position?: string | null;
  job_level?: string | null;
  employee_type?: string | null;
  monthly_rate?: number | null;
  daily_rate?: number | null;
  per_day?: number | null;
  eligible_for_ot?: boolean | null;
  overtime_group_id?: string | null;
  transferred_from_employee_id?: string | null;
  directory_employee_id?: string | null;
  directory_client_id?: string | null;
  employee_location_assignments?: {
    location_id: string;
    office_locations?: { id: string; name: string } | null;
  }[];
}

export function createEmptyEmployeeForm(): EmployeeFormData {
  return {
    employee_code: "",
    employee_id: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    middle_initial: "",
    assigned_hotel: "",
    locations: [],
    address: "",
    birth_date: "",
    sex: "",
    gender: "",
    status: "active",
    hire_date: "",
    regular_date: "",
    resign_date: "",
    tin: "",
    tin_number: "",
    sss_number: "",
    philhealth_number: "",
    pagibig_number: "",
    tax_status: "",
    email: "",
    mobile: "",
    bank_name: "",
    bank_account_no: "",
    gcash: "",
    pay_through: "",
    hmo_provider: "",
    paternity_days: "",
    position: "",
    job_level: "",
    employee_type: "office-based",
    monthly_rate: "",
    daily_rate: "",
    per_day: "",
    eligible_for_ot: false,
    overtime_group_id: "",
    transferred_from_employee_id: "",
    directory_employee_id: "",
    directory_client_id: "",
  };
}

export { employeeRecordToFormData201 as employeeRecordToFormData } from "./office-201-map";
