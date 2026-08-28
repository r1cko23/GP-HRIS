/**
 * Map GREENHRISMAIN Employee row → Directory status + legacy source fields.
 *
 * Legacy lists (see docs/architecture/DIRECTORY_STATUS_SCRUB.md):
 * - Active:     status = 'Active', not On Leave / Float
 * - For release: finalpaystatus IN ('Release', 'For Release') — exiting; final pay pending
 * - Inactive:   status = 'InActive', final pay not in release/claimed/barred
 * - Barred:     finalpaystatus = 'Barred' or dbo.barred
 * - Claimed:    final pay already claimed → treat as inactive
 *
 * IMPORTANT: "Unrelease" means NOT yet released — do NOT match substring "release".
 */

export type DirectoryStatus =
  | "active"
  | "inactive"
  | "barred"
  | "float"
  | "for_release"
  | "for_verification";

export type LegacyEmployeeFields = {
  Employee_id?: number | string | null;
  status?: string | null;
  employee_status?: string | null;
  verificationstatus?: string | null;
  verifiedforverification?: string | null;
  finalpaystatus?: string | null;
};

export type NormalizedLegacyEmployee = {
  status: DirectoryStatus;
  legacy_status: string | null;
  legacy_employee_status: string | null;
  legacy_final_pay_status: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function lower(value: string | null | undefined): string {
  return norm(value).toLowerCase();
}

/** Exact legacy for-release values only (usp_employeeforreleaselist). */
export function isLegacyForRelease(finalpaystatus: string | null | undefined): boolean {
  const fp = norm(finalpaystatus);
  return fp === "Release" || fp === "For Release";
}

export function mapLegacyEmployeeStatus(
  row: LegacyEmployeeFields,
  barredIds: ReadonlySet<number>
): NormalizedLegacyEmployee {
  const legacyStatus = norm(row.status as string) || null;
  const legacyEmployment = norm(row.employee_status as string) || null;
  const legacyFinalPay = norm(row.finalpaystatus as string) || null;

  const id =
    typeof row.Employee_id === "number"
      ? row.Employee_id
      : parseInt(String(row.Employee_id ?? ""), 10);

  if (Number.isFinite(id) && barredIds.has(id)) {
    return {
      status: "barred",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  const employment = lower(legacyEmployment);
  const status = lower(legacyStatus);
  const verification = lower(row.verificationstatus);
  const forReleaseVerified = lower(row.verifiedforverification).startsWith("y");

  if (legacyFinalPay === "Barred") {
    return {
      status: "barred",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  if (employment.includes("float")) {
    return {
      status: "float",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  if (
    verification &&
    verification !== "verified" &&
    forReleaseVerified
  ) {
    return {
      status: "for_verification",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  if (isLegacyForRelease(legacyFinalPay)) {
    return {
      status: "for_release",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  if (legacyFinalPay === "Claimed") {
    return {
      status: "inactive",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  if (
    status === "inactive" ||
    status === "in-active" ||
    status === "resigned"
  ) {
    return {
      status: "inactive",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  if (employment.includes("resign") || employment.includes("on leave")) {
    return {
      status: "inactive",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  if (status === "active" || status === "") {
    return {
      status: "active",
      legacy_status: legacyStatus,
      legacy_employee_status: legacyEmployment,
      legacy_final_pay_status: legacyFinalPay,
    };
  }

  return {
    status: "inactive",
    legacy_status: legacyStatus,
    legacy_employee_status: legacyEmployment,
    legacy_final_pay_status: legacyFinalPay,
  };
}

/** Strongest identity key for dedup / canonical person (same person, multiple 201 codes). */
export function buildPersonKey(row: {
  legacy_id?: number | null;
  sss_number?: string | null;
  tin?: string | null;
  birth_date?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
}): string {
  const digits = (value: string | null | undefined) => {
    if (!value) return null;
    const cleaned = value.replace(/\D/g, "");
    return cleaned.length ? cleaned : null;
  };

  const sss = digits(row.sss_number);
  const tin = digits(row.tin);
  const dob = row.birth_date ? String(row.birth_date).slice(0, 10) : null;

  if (sss && tin && dob) return `STB:${sss}|${tin}|${dob}`;
  if (sss) return `SSS:${sss}`;

  const last = norm(row.last_name).toUpperCase();
  const first = norm(row.first_name).toUpperCase();
  const middle = norm(row.middle_name).toUpperCase();
  if (dob && last && first) {
    return `ND:${last}|${first}|${middle}|${dob}`;
  }

  if (row.legacy_id != null) return `LEG:${row.legacy_id}`;
  return `UNK:${last}|${first}`;
}

const STATUS_RANK: Record<DirectoryStatus, number> = {
  active: 1,
  for_release: 2,
  for_verification: 3,
  float: 4,
  inactive: 5,
  barred: 6,
};

/** Pick the current engagement row within a person_key group (rehire chains). */
export function rankEngagement(row: {
  status: DirectoryStatus | string;
  hire_date?: string | null;
  legacy_id?: number | null;
  employee_code?: string | null;
}): number {
  const status = (row.status as DirectoryStatus) in STATUS_RANK
    ? STATUS_RANK[row.status as DirectoryStatus]
    : 99;
  const hire = row.hire_date ? Date.parse(String(row.hire_date)) : 0;
  const legacy = row.legacy_id ?? 0;
  // Lower sort key wins — encode as single number for stable sort in JS
  return status * 1e15 - hire * 10 - legacy;
}

export function compareEngagements(
  a: Parameters<typeof rankEngagement>[0],
  b: Parameters<typeof rankEngagement>[0]
): number {
  return rankEngagement(a) - rankEngagement(b);
}
