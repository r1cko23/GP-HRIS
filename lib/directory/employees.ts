export const EMPLOYEE_STATUSES = [
  "active",
  "inactive",
  "barred",
  "float",
  "for_release",
  "for_verification",
] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export function isEmployeeStatus(value: string): value is EmployeeStatus {
  return (EMPLOYEE_STATUSES as readonly string[]).includes(value);
}

/** Status copy for Directory UI + payroll consumers. */
export const EMPLOYEE_STATUS_META: Record<
  EmployeeStatus,
  {
    label: string;
    short: string;
    payroll: string;
    badge: "success" | "destructive" | "warning" | "secondary";
  }
> = {
  active: {
    label: "Active",
    short: "Currently employed and on the operational roster.",
    payroll: "Include in cutoff / payroll when scheduled.",
    badge: "success",
  },
  for_release: {
    label: "For release",
    short: "Leaving — final pay is in progress.",
    payroll:
      "Off the regular cutoff (GREENHRISMAIN for-release list). Final pay is a separate run — do not create a new 201.",
    badge: "warning",
  },
  inactive: {
    label: "Inactive",
    short: "Separated or no longer engaged.",
    payroll: "Do not include in new cutoffs. Use Rehire to return.",
    badge: "secondary",
  },
  barred: {
    label: "Barred",
    short:
      "Unclaimed final pay for more than 3 years (Rehire), or blocked from deployment (Activate).",
    payroll:
      "Exclude from payroll. Final-pay barred → Rehire on a new Tenure. Deployment barred → Activate on this Tenure.",
    badge: "destructive",
  },
  float: {
    label: "Float",
    short: "Between assignments / floating pool.",
    payroll: "Usually excluded until placed on a client.",
    badge: "secondary",
  },
  for_verification: {
    label: "For verification",
    short: "Pending HR verification before full activation.",
    payroll: "Do not pay until verified / activated.",
    badge: "warning",
  },
};

/** UI label for a status enum: sentence case, spaces instead of underscores. */
export function sentenceCaseStatusLabel(status: string): string {
  const spaced = status.replaceAll("_", " ").trim();
  if (!spaced) return status;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function directoryStatusMeta(status: string) {
  if (isEmployeeStatus(status)) return EMPLOYEE_STATUS_META[status];
  return {
    label: sentenceCaseStatusLabel(status),
    short: "",
    payroll: "",
    badge: "secondary" as const,
  };
}

/** Statuses that may still be paid: Active on the regular kinsena; for_release only on a dedicated final-pay run. */
export function isPayrollEligibleStatus(status: string): boolean {
  return status === "active" || status === "for_release";
}

/**
 * People Add employee default status. HR Activate after ID verification.
 * Explicit valid override kept for scripts / admin paths.
 */
export function resolveHireStatus(
  override?: string | null
): EmployeeStatus {
  if (override && isEmployeeStatus(override)) return override;
  return "for_verification";
}

/** Bundy auto-enroll only when Active — not on a for_verification hire. */
export function shouldAutoEnrollForStatus(status: string): boolean {
  return status === "active";
}
