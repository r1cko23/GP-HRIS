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
      "May still appear on one last payroll. Not a duplicate; do not create a new 201.",
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
    short: "Blocked from deployment / payroll.",
    payroll: "Exclude from payroll until cleared.",
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

export function directoryStatusMeta(status: string) {
  if (isEmployeeStatus(status)) return EMPLOYEE_STATUS_META[status];
  return {
    label: status.replaceAll("_", " "),
    short: "",
    payroll: "",
    badge: "secondary" as const,
  };
}

/** Statuses that may still be paid on a cutoff (person master, current engagement). */
export function isPayrollEligibleStatus(status: string): boolean {
  return status === "active" || status === "for_release";
}
