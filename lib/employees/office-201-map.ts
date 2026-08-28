import type { EmployeeFormData, EmployeeForForm } from "./employeeFormState";

const OFFICE_STATUSES = [
  "active",
  "inactive",
  "barred",
  "float",
  "for_release",
  "for_verification",
] as const;

export type OfficeEmployeeStatus = (typeof OFFICE_STATUSES)[number];

export function sexFromGender(gender: string | null | undefined): string {
  if (!gender) return "";
  const g = gender.toLowerCase();
  if (g.startsWith("m")) return "Male";
  if (g.startsWith("f")) return "Female";
  return gender;
}

export function genderFromSex(sex: string | null | undefined): string {
  if (!sex) return "";
  const s = sex.toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f")) return "female";
  return s;
}

export function employeeRecordToFormData201(employee: EmployeeForForm): EmployeeFormData {
  const base = {
    employee_code: employee.employee_code ?? employee.employee_id ?? "",
    employee_id: employee.employee_id ?? employee.employee_code ?? "",
    last_name: employee.last_name || "",
    first_name: employee.first_name || "",
    middle_name: employee.middle_name ?? employee.middle_initial ?? "",
    middle_initial: employee.middle_initial || "",
    assigned_hotel: employee.assigned_hotel || "",
    locations:
      employee.employee_location_assignments?.map((a) => a.location_id) || [],
    address: employee.address || "",
    birth_date: employee.birth_date
      ? new Date(employee.birth_date).toISOString().slice(0, 10)
      : "",
    sex: employee.sex || sexFromGender(employee.gender),
    gender: employee.gender || genderFromSex(employee.sex),
    status:
      employee.status ??
      (employee.is_active === false ? "inactive" : "active"),
    hire_date: employee.hire_date
      ? new Date(employee.hire_date).toISOString().slice(0, 10)
      : "",
    regular_date: employee.regular_date
      ? new Date(employee.regular_date).toISOString().slice(0, 10)
      : "",
    resign_date: employee.resign_date
      ? new Date(employee.resign_date).toISOString().slice(0, 10)
      : "",
    tin: employee.tin ?? employee.tin_number ?? "",
    tin_number: employee.tin_number ?? employee.tin ?? "",
    sss_number: employee.sss_number || "",
    philhealth_number: employee.philhealth_number || "",
    pagibig_number: employee.pagibig_number || "",
    tax_status: employee.tax_status || "",
    email: employee.email || "",
    mobile: employee.mobile || "",
    bank_name: employee.bank_name || "",
    bank_account_no: employee.bank_account_no || "",
    gcash: employee.gcash || "",
    pay_through: employee.pay_through || "",
    hmo_provider: employee.hmo_provider || "",
    paternity_days: "",
    position: employee.position || "",
    job_level: employee.job_level || "",
    employee_type: employee.employee_type || "office-based",
    daily_rate:
      employee.daily_rate != null
        ? String(employee.daily_rate)
        : employee.per_day != null
          ? String(employee.per_day)
          : "",
    per_day:
      employee.per_day != null
        ? String(employee.per_day)
        : employee.daily_rate != null
          ? String(employee.daily_rate)
          : "",
    monthly_rate: employee.monthly_rate?.toString() || "",
    eligible_for_ot: employee.eligible_for_ot || false,
    overtime_group_id: employee.overtime_group_id || "none",
    transferred_from_employee_id: employee.transferred_from_employee_id || "",
    directory_employee_id: employee.directory_employee_id ?? "",
    directory_client_id: employee.directory_client_id ?? "",
  };
  return base;
}

export function buildOfficeEmployeePayload(formData: EmployeeFormData) {
  const code = (formData.employee_code || formData.employee_id).trim();
  const middleName = formData.middle_name.trim();
  const middleInitial = middleName
    ? middleName.charAt(0).toUpperCase()
    : formData.middle_initial.trim().toUpperCase().slice(0, 1) || null;
  const middlePart = middleInitial ? ` ${middleInitial}.` : "";
  const full_name = `${formData.first_name}${middlePart} ${formData.last_name}`.trim();

  const sex = formData.sex.trim() || sexFromGender(formData.gender);
  const gender = genderFromSex(sex || formData.gender);
  const status = formData.status || "active";
  const dailyRate = formData.daily_rate
    ? parseFloat(formData.daily_rate)
    : formData.per_day
      ? parseFloat(formData.per_day)
      : null;
  const tin = formData.tin.trim() || formData.tin_number.trim() || null;

  return {
    employee_id: code,
    employee_code: code,
    full_name,
    last_name: formData.last_name,
    first_name: formData.first_name,
    middle_name: middleName || null,
    middle_initial: middleInitial,
    assigned_hotel: null as string | null,
    address: formData.address || null,
    birth_date: formData.birth_date || null,
    hire_date: formData.hire_date || null,
    regular_date: formData.regular_date || null,
    resign_date: formData.resign_date || null,
    sex: sex || null,
    gender: gender || null,
    status,
    is_active: status === "active",
    tin,
    tin_number: tin,
    sss_number: formData.sss_number || null,
    philhealth_number: formData.philhealth_number || null,
    pagibig_number: formData.pagibig_number || null,
    tax_status: formData.tax_status || null,
    email: formData.email || null,
    mobile: formData.mobile || null,
    bank_name: formData.bank_name || null,
    bank_account_no: formData.bank_account_no || null,
    gcash: formData.gcash || null,
    pay_through: formData.pay_through || null,
    hmo_provider: formData.hmo_provider || null,
    position: formData.position || null,
    job_level: formData.job_level || null,
    employee_type: formData.employee_type || "office-based",
    daily_rate: dailyRate,
    per_day: dailyRate,
    monthly_rate: formData.monthly_rate
      ? parseFloat(formData.monthly_rate)
      : dailyRate
        ? dailyRate * 26
        : null,
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
      gender === "male"
        ? parseFloat(formData.paternity_days || "0") || 0
        : 0,
  };
}

export { OFFICE_STATUSES };
