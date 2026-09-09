/**
 * GREENHRISMAIN loan header keys to a Directory person.
 * Deployed people often have no Bundy (public.employees) row.
 */

export type LoanImportPersonPlan =
  | { action: "skip"; reason: "no_directory_person" }
  | {
      action: "import";
      directory_employee_id: string;
      employee_id: string | null;
    };

export function planLoanImportPerson(input: {
  directoryEmployeeId: string | null | undefined;
  officeEmployeeId: string | null | undefined;
}): LoanImportPersonPlan {
  const directoryId = (input.directoryEmployeeId ?? "").trim();
  if (!directoryId) return { action: "skip", reason: "no_directory_person" };
  const officeId = (input.officeEmployeeId ?? "").trim();
  return {
    action: "import",
    directory_employee_id: directoryId,
    employee_id: officeId || null,
  };
}
