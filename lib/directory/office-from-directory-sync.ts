import { calculateMonthlySalary } from "@/utils/ph-deductions";

export type DirectoryEmployeeForOfficeSync = {
  id: string;
  organization_id?: string | null;
  client_id: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  employee_code: string | null;
  status: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  sex: string | null;
  birth_date: string | null;
  hire_date: string | null;
  regular_date?: string | null;
  resign_date?: string | null;
  daily_rate: number | string | null;
  billing_daily_rate?: number | string | null;
  ecola?: number | string | null;
  tin: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  tax_status?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  gcash?: string | null;
  pay_through?: string | null;
  email?: string | null;
  mobile?: string | null;
  address: string | null;
  profile_picture_url: string | null;
  legacy_id?: number | null;
  position?:
    | {
        job_title?: string | null;
        payroll_daily_rate?: number | string | null;
        group_name?: string | null;
      }
    | {
        job_title?: string | null;
        payroll_daily_rate?: number | string | null;
        group_name?: string | null;
      }[]
    | null;
};

function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

function titleCaseWord(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function formatPersonName(
  first: string | null | undefined,
  middle: string | null | undefined,
  last: string | null | undefined
) {
  const firstName = titleCaseWord(first ?? "");
  const lastName = titleCaseWord(last ?? "");
  const middleName = middle?.trim() ? titleCaseWord(middle.trim()) : null;
  const middleInitial = middleName ? middleName.charAt(0).toUpperCase() : null;
  const middlePart = middleInitial ? ` ${middleInitial}.` : "";
  return {
    first_name: firstName || null,
    last_name: lastName || null,
    middle_name: middleName,
    middle_initial: middleInitial,
    full_name: `${firstName}${middlePart} ${lastName}`.trim(),
  };
}

function mapSexToGender(sex: string | null | undefined): string | null {
  const cleaned = cleanText(sex ?? null);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (lower.startsWith("m")) return "male";
  if (lower.startsWith("f")) return "female";
  return lower;
}

function normalizeJobLevel(value: string | null | undefined): string | null {
  const cleaned = cleanText(value)?.toUpperCase();
  if (!cleaned) return null;
  if (cleaned.includes("MANAG")) return "MANAGERIAL";
  if (cleaned.includes("SUPERV")) return "SUPERVISORY";
  if (cleaned.includes("RANK")) return "RANK AND FILE";
  return cleaned;
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function positionMeta(row: DirectoryEmployeeForOfficeSync) {
  const pos = row.position;
  if (Array.isArray(pos)) return pos[0] ?? null;
  return pos ?? null;
}

export type OfficeEmployeeForSync = {
  organization_id?: string | null;
  employee_id?: string | null;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_initial?: string | null;
  middle_name?: string | null;
  full_name?: string | null;
  gender?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  regular_date?: string | null;
  resign_date?: string | null;
  status?: string | null;
  position?: string | null;
  position_id?: string | null;
  branch_id?: string | null;
  job_level?: string | null;
  per_day?: number | string | null;
  daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
  ecola?: number | string | null;
  monthly_rate?: number | string | null;
  tin_number?: string | null;
  tin?: string | null;
  tax_status?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  gcash?: string | null;
  pay_through?: string | null;
  email?: string | null;
  mobile?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  address?: string | null;
  profile_picture_url?: string | null;
  employee_type?: string | null;
  is_active?: boolean | null;
  legacy_id?: number | null;
};

export const DIRECTORY_EMPLOYEE_SYNC_SELECT = `
  id, organization_id, client_id, branch_id, position_id,
  employee_code, status,
  first_name, last_name, middle_name, sex, birth_date, hire_date,
  regular_date, resign_date,
  daily_rate, billing_daily_rate, ecola,
  tin, sss_number, philhealth_number, pagibig_number,
  tax_status, bank_name, bank_account_no, gcash, pay_through,
  email, mobile, address, profile_picture_url, legacy_id,
  position:positions(job_title, payroll_daily_rate, group_name)
`;

function isBlankText(value: unknown): boolean {
  return value == null || String(value).trim() === "";
}

function isBlankNumber(value: unknown): boolean {
  if (value == null || value === "") return true;
  const num = typeof value === "number" ? value : Number(value);
  return !Number.isFinite(num) || num <= 0;
}

function isBlankDate(value: unknown): boolean {
  return value == null || String(value).trim() === "";
}

const FILL_MISSING_FIELD_CHECKS: Array<{
  key: string;
  empty: (office: OfficeEmployeeForSync) => boolean;
}> = [
  { key: "organization_id", empty: (o) => isBlankText(o.organization_id) },
  { key: "employee_code", empty: (o) => isBlankText(o.employee_code) && isBlankText(o.employee_id) },
  { key: "employee_id", empty: (o) => isBlankText(o.employee_id) && isBlankText(o.employee_code) },
  { key: "branch_id", empty: (o) => isBlankText(o.branch_id) },
  { key: "position_id", empty: (o) => isBlankText(o.position_id) },
  { key: "first_name", empty: (o) => isBlankText(o.first_name) },
  { key: "last_name", empty: (o) => isBlankText(o.last_name) },
  { key: "middle_name", empty: (o) => isBlankText(o.middle_name) && isBlankText(o.middle_initial) },
  { key: "middle_initial", empty: (o) => isBlankText(o.middle_initial) && isBlankText(o.middle_name) },
  { key: "full_name", empty: (o) => isBlankText(o.full_name) },
  { key: "sex", empty: (o) => isBlankText(o.sex) && isBlankText(o.gender) },
  { key: "gender", empty: (o) => isBlankText(o.gender) && isBlankText(o.sex) },
  { key: "birth_date", empty: (o) => isBlankDate(o.birth_date) },
  { key: "hire_date", empty: (o) => isBlankDate(o.hire_date) },
  { key: "regular_date", empty: (o) => isBlankDate(o.regular_date) },
  { key: "resign_date", empty: (o) => isBlankDate(o.resign_date) },
  { key: "status", empty: (o) => isBlankText(o.status) },
  { key: "position", empty: (o) => isBlankText(o.position) },
  { key: "job_level", empty: (o) => isBlankText(o.job_level) },
  { key: "daily_rate", empty: (o) => isBlankNumber(o.daily_rate) && isBlankNumber(o.per_day) },
  { key: "per_day", empty: (o) => isBlankNumber(o.per_day) && isBlankNumber(o.daily_rate) },
  { key: "billing_daily_rate", empty: (o) => isBlankNumber(o.billing_daily_rate) },
  { key: "ecola", empty: (o) => isBlankNumber(o.ecola) },
  { key: "monthly_rate", empty: (o) => isBlankNumber(o.monthly_rate) },
  { key: "tin", empty: (o) => isBlankText(o.tin) && isBlankText(o.tin_number) },
  { key: "tin_number", empty: (o) => isBlankText(o.tin_number) && isBlankText(o.tin) },
  { key: "tax_status", empty: (o) => isBlankText(o.tax_status) },
  { key: "bank_name", empty: (o) => isBlankText(o.bank_name) },
  { key: "bank_account_no", empty: (o) => isBlankText(o.bank_account_no) },
  { key: "gcash", empty: (o) => isBlankText(o.gcash) },
  { key: "pay_through", empty: (o) => isBlankText(o.pay_through) },
  { key: "email", empty: (o) => isBlankText(o.email) },
  { key: "mobile", empty: (o) => isBlankText(o.mobile) },
  { key: "sss_number", empty: (o) => isBlankText(o.sss_number) },
  { key: "philhealth_number", empty: (o) => isBlankText(o.philhealth_number) },
  { key: "pagibig_number", empty: (o) => isBlankText(o.pagibig_number) },
  { key: "address", empty: (o) => isBlankText(o.address) },
  { key: "profile_picture_url", empty: (o) => isBlankText(o.profile_picture_url) },
  { key: "employee_type", empty: (o) => isBlankText(o.employee_type) },
  { key: "legacy_id", empty: (o) => o.legacy_id == null },
  { key: "is_active", empty: (o) => o.is_active == null && isBlankText(o.status) },
];

/** Keep Directory values only where the office row is empty. */
export function filterPatchToMissingOfficeFields(
  patch: Record<string, unknown>,
  office: OfficeEmployeeForSync
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {
    directory_employee_id: patch.directory_employee_id,
    directory_client_id: patch.directory_client_id,
  };

  for (const { key, empty } of FILL_MISSING_FIELD_CHECKS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    if (empty(office)) filtered[key] = patch[key];
  }
  if (patch.updated_by) filtered.updated_by = patch.updated_by;

  return filtered;
}

/** Map Directory 201 fields onto public.employees (201-aligned + legacy mirror via DB trigger). */
export function buildOfficePatchFromDirectory(
  dirEmp: DirectoryEmployeeForOfficeSync,
  options: {
    organicClientId: string | null;
    organicOrgId?: string | null;
    adoptDirectoryEmployeeCode?: boolean;
    currentOfficeEmployeeId?: string | null;
    updatedBy?: string | null;
    mode?: "overwrite" | "fill_missing";
    office?: OfficeEmployeeForSync | null;
  }
): Record<string, unknown> {
  const pos = positionMeta(dirEmp);
  const names = formatPersonName(
    dirEmp.first_name,
    dirEmp.middle_name,
    dirEmp.last_name
  );

  const patch: Record<string, unknown> = {
    directory_employee_id: dirEmp.id,
    directory_client_id: dirEmp.client_id ?? options.organicClientId,
    organization_id: dirEmp.organization_id ?? options.organicOrgId ?? null,
    branch_id: dirEmp.branch_id ?? null,
    position_id: dirEmp.position_id ?? null,
    employee_type: "office-based",
  };

  if (options.updatedBy) {
    patch.updated_by = options.updatedBy;
  }

  const code = dirEmp.employee_code?.trim() ?? null;
  if (
    options.adoptDirectoryEmployeeCode !== false &&
    code &&
    code !== options.currentOfficeEmployeeId
  ) {
    patch.employee_code = code;
    patch.employee_id = code;
  } else if (code) {
    patch.employee_code = code;
  }

  if (names.first_name) patch.first_name = names.first_name;
  if (names.last_name) patch.last_name = names.last_name;
  if (names.middle_name) patch.middle_name = names.middle_name;
  if (names.middle_initial) patch.middle_initial = names.middle_initial;
  if (names.full_name) patch.full_name = names.full_name;

  const sex = cleanText(dirEmp.sex);
  if (sex) {
    patch.sex = sex;
    patch.gender = mapSexToGender(sex);
  }

  if (dirEmp.birth_date) patch.birth_date = dirEmp.birth_date;
  if (dirEmp.hire_date) patch.hire_date = dirEmp.hire_date;
  if (dirEmp.regular_date) patch.regular_date = dirEmp.regular_date;
  if (dirEmp.resign_date) patch.resign_date = dirEmp.resign_date;

  if (dirEmp.status) {
    patch.status = dirEmp.status;
    patch.is_active = String(dirEmp.status).toLowerCase() === "active";
  }

  const jobTitle = cleanText(pos?.job_title ?? null);
  if (jobTitle) patch.position = jobTitle;

  const jobLevel = normalizeJobLevel(pos?.group_name ?? null);
  if (jobLevel) patch.job_level = jobLevel;

  const dailyRate =
    asNumber(dirEmp.daily_rate) ?? asNumber(pos?.payroll_daily_rate ?? null);
  if (dailyRate != null && dailyRate > 0) {
    patch.daily_rate = dailyRate;
    patch.per_day = dailyRate;
    patch.monthly_rate = calculateMonthlySalary(dailyRate, 26);
  }

  const billingRate = asNumber(dirEmp.billing_daily_rate);
  if (billingRate != null && billingRate > 0) {
    patch.billing_daily_rate = billingRate;
  }

  const ecola = asNumber(dirEmp.ecola);
  if (ecola != null && ecola > 0) patch.ecola = ecola;

  const tin = cleanText(dirEmp.tin);
  if (tin) {
    patch.tin = tin;
    patch.tin_number = tin;
  }

  const taxStatus = cleanText(dirEmp.tax_status);
  if (taxStatus) patch.tax_status = taxStatus;

  const bankName = cleanText(dirEmp.bank_name);
  if (bankName) patch.bank_name = bankName;

  const bankAccount = cleanText(dirEmp.bank_account_no);
  if (bankAccount) patch.bank_account_no = bankAccount;

  const gcash = cleanText(dirEmp.gcash);
  if (gcash) patch.gcash = gcash;

  const payThrough = cleanText(dirEmp.pay_through);
  if (payThrough) patch.pay_through = payThrough;

  const email = cleanText(dirEmp.email);
  if (email) patch.email = email;

  const mobile = cleanText(dirEmp.mobile);
  if (mobile) patch.mobile = mobile;

  const sss = cleanText(dirEmp.sss_number);
  if (sss) patch.sss_number = sss;

  const philhealth = cleanText(dirEmp.philhealth_number);
  if (philhealth) patch.philhealth_number = philhealth;

  const pagibig = cleanText(dirEmp.pagibig_number);
  if (pagibig) patch.pagibig_number = pagibig;

  const address = cleanText(dirEmp.address);
  if (address) patch.address = address;

  const photo = cleanText(dirEmp.profile_picture_url);
  if (photo) patch.profile_picture_url = photo;

  if (dirEmp.legacy_id != null) patch.legacy_id = dirEmp.legacy_id;

  if (options.mode === "fill_missing" && options.office) {
    return filterPatchToMissingOfficeFields(patch, options.office);
  }

  return patch;
}

export function patchFieldNames(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter(
    (key) =>
      key !== "updated_by" &&
      key !== "directory_employee_id" &&
      key !== "directory_client_id"
  );
}
