/**
 * GREENHRISMAIN Employee encode fields → Directory 201.
 *
 * Legacy columns:
 * - employee_status → employment_type (Probationary / Regular / Contractual / …)
 * - typeofcontract → contract_type
 * - contractend → contract_end_date
 * - pstatus → civil_status
 * - dateregular → regular_date (already a Directory column)
 */

/** Hire-time employment types HR picks on Add employee / 201 edit. */
export const EMPLOYMENT_TYPE_OPTIONS = [
  "Probationary",
  "Regular",
  "Contractual",
  "Backup",
  "On-Call",
  "Fixed Term",
  "Regular Casual",
  "Project Based",
  "Trainee",
  "Reliever",
  "Seasonal",
] as const;

export type EmploymentTypeOption = (typeof EMPLOYMENT_TYPE_OPTIONS)[number];

export const CIVIL_STATUS_OPTIONS = [
  "Single",
  "Married",
  "Widowed",
  "Separated",
  "Annulled",
] as const;

export type CivilStatusOption = (typeof CIVIL_STATUS_OPTIONS)[number];

/** Common GREENHRISMAIN typeofcontract values; free text still allowed. */
export const CONTRACT_TYPE_OPTIONS = [
  "Regular",
  "Probationary",
  "Contractual",
  "Project Based",
  "Fixed Term",
  "Seasonal",
  "On-Call",
] as const;

function norm(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/** SQL Server empty / sentinel dates often arrive as 1900-01-01. */
export function legacyEncodeDate(
  value: string | Date | null | undefined
): string | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    // nvarchar dates like "2024-06-15" or "06/15/2024"
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const year = Number(raw.slice(0, 4));
      if (year < 1990 || year > 2100) return null;
      return raw;
    }
    return null;
  }
  const iso = d.toISOString().slice(0, 10);
  const year = Number(iso.slice(0, 4));
  if (year < 1990 || year > 2100) return null;
  return iso;
}

export type LegacyEmployeeEncodeSource = {
  employee_status?: string | null;
  typeofcontract?: string | null;
  contractend?: string | Date | null;
  pstatus?: string | null;
  dateregular?: string | Date | null;
};

export type DirectoryEmployeeEncodeFields = {
  employment_type: string | null;
  contract_type: string | null;
  contract_end_date: string | null;
  civil_status: string | null;
  regular_date: string | null;
};

/**
 * Map GREENHRISMAIN Employee encode columns onto Directory columns.
 * Preserves legacy spelling/casing (Probationary, On-Call, …).
 */
export function mapLegacyEmployeeEncodeFields(
  row: LegacyEmployeeEncodeSource
): DirectoryEmployeeEncodeFields {
  return {
    employment_type: norm(row.employee_status),
    contract_type: norm(row.typeofcontract),
    contract_end_date: legacyEncodeDate(row.contractend),
    civil_status: norm(row.pstatus),
    regular_date: legacyEncodeDate(row.dateregular),
  };
}

export function isEmploymentTypeOption(
  value: string
): value is EmploymentTypeOption {
  return (EMPLOYMENT_TYPE_OPTIONS as readonly string[]).includes(value);
}

const CONTRACT_END_TYPES = new Set([
  "Fixed Term",
  "Contractual",
  "Project Based",
  "Seasonal",
  "On-Call",
]);

const REGULAR_DATE_TYPES = new Set(["Regular", "Regular Casual"]);

/** Contract end is relevant for term / contingent employment types. */
export function employmentNeedsContractEnd(
  employmentType: string | null | undefined
): boolean {
  const type = norm(employmentType);
  return type ? CONTRACT_END_TYPES.has(type) : false;
}

/** Regularization date is relevant once the person is Regular*. */
export function employmentNeedsRegularDate(
  employmentType: string | null | undefined
): boolean {
  const type = norm(employmentType);
  return type ? REGULAR_DATE_TYPES.has(type) : false;
}

/**
 * Default typeofcontract when HR leaves it blank — mirrors common MAIN pairing.
 * Returns null when there is no sensible default (e.g. Backup, Reliever).
 */
export function defaultContractType(
  employmentType: string | null | undefined
): string | null {
  const type = norm(employmentType);
  if (!type) return null;
  if ((CONTRACT_TYPE_OPTIONS as readonly string[]).includes(type)) {
    return type;
  }
  if (type === "Regular Casual") return "Regular";
  if (type === "Trainee" || type === "Reliever" || type === "Backup") {
    return null;
  }
  return null;
}
