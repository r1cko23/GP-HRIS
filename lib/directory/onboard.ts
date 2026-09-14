import { peopleEmployeeOnboardPath } from "@/lib/hubs";
import { compute201Completeness } from "./completeness";

export const EMPLOYEE_ONBOARD_STEPS = [
  {
    id: "identity",
    number: 1,
    label: "Identity",
    description: "Birth date, sex, mobile, and address.",
  },
  {
    id: "assignment",
    number: 2,
    label: "Assignment",
    description: "Branch, position, hire date, and rates.",
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
    description: "Upload ID scans. Skip if you will backfill later.",
  },
  {
    id: "pay",
    number: 5,
    label: "Pay channel",
    description: "Bank account or GCash.",
  },
] as const;

export type EmployeeOnboardStepId =
  (typeof EMPLOYEE_ONBOARD_STEPS)[number]["id"];

const RESUME_ORDER: EmployeeOnboardStepId[] = [
  "identity",
  "assignment",
  "government",
  "pay",
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
        : step === "pay"
          ? "pay"
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
  employeeId: string
): string {
  return peopleEmployeeOnboardPath(clientId, employeeId, "assignment");
}
