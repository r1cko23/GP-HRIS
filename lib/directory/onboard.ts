import { peopleEmployeeOnboardPath } from "@/lib/hubs";
import { compute201Completeness } from "./completeness";

/** Hire wizard only — paythrough is collected on Activate from for_verification. */
export const EMPLOYEE_ONBOARD_STEPS = [
  {
    id: "identity",
    number: 1,
    label: "Identity",
    description:
      "Client, site, position, name, birth date, sex, email, mobile, and address.",
  },
  {
    id: "assignment",
    number: 2,
    label: "Assignment",
    description: "Branch, approved position, hire date, and rates.",
  },
  {
    id: "government",
    number: 3,
    label: "Government IDs",
    description: "SSS, TIN, PhilHealth, Pag-IBIG numbers.",
  },
  {
    id: "documents",
    number: 4,
    label: "Documents",
    description: "Upload ID scans before finishing hire.",
  },
] as const;

export type EmployeeOnboardStepId =
  (typeof EMPLOYEE_ONBOARD_STEPS)[number]["id"];

export type EmployeeOnboardStepVisible = {
  id: EmployeeOnboardStepId;
  number: number;
  label: string;
  description: string;
};

/**
 * Hub Add employee folds placement into Identity, so the chrome is
 * Identity → Government IDs → Documents (Assignment stays only when
 * placement is still incomplete).
 */
export function employeeOnboardStepsVisible(opts: {
  placementComplete: boolean;
}): EmployeeOnboardStepVisible[] {
  const steps = opts.placementComplete
    ? EMPLOYEE_ONBOARD_STEPS.filter((step) => step.id !== "assignment")
    : EMPLOYEE_ONBOARD_STEPS;
  return steps.map((step, index) => ({
    id: step.id,
    number: index + 1,
    label: step.label,
    description: step.description,
  }));
}

export function employeePlacementComplete(employee: {
  hire_date?: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  client_id?: string | null;
}): boolean {
  return Boolean(
    employee.client_id &&
      employee.hire_date &&
      employee.branch_id &&
      employee.position_id
  );
}

const RESUME_ORDER: EmployeeOnboardStepId[] = [
  "identity",
  "assignment",
  "government",
];

export function firstIncompleteOnboardStep(employee: {
  last_name?: string | null;
  first_name?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  sex?: string | null;
  tin?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  client_id?: string | null;
  position_id?: string | null;
  daily_rate?: number | string | null;
  bank_account_no?: string | null;
  gcash?: string | null;
  pay_through?: string | null;
  mobile?: string | null;
}): EmployeeOnboardStepId | null {
  const report = compute201Completeness(employee);
  for (const step of RESUME_ORDER) {
    const group =
      step === "government"
        ? "government"
        : step === "assignment"
          ? "assignment"
          : "identity";
    if (report.items.some((item) => item.group === group && !item.ok)) {
      return step;
    }
  }
  return null;
}

/** After name/identity Continue, stay in the wizard — never dump HR on the 201. */
export function pathAfterEmployeeHireIdentity(
  clientId: string,
  employeeId: string,
  opts?: {
    placementSaved?: boolean;
    /** Snapshot from the hire form — keeps incomplete identity from being skipped. */
    identity?: {
      last_name?: string | null;
      first_name?: string | null;
      birth_date?: string | null;
      sex?: string | null;
      mobile?: string | null;
    };
  }
): string {
  if (opts?.identity && opts.placementSaved) {
    const next = firstIncompleteOnboardStep({
      ...opts.identity,
      hire_date: "set",
      client_id: "set",
      position_id: "set",
      daily_rate: 1,
    });
    if (next === "identity") {
      return peopleEmployeeOnboardPath(clientId, employeeId, "identity");
    }
    return peopleEmployeeOnboardPath(clientId, employeeId, "government");
  }
  const step = opts?.placementSaved ? "government" : "assignment";
  return peopleEmployeeOnboardPath(clientId, employeeId, step);
}
