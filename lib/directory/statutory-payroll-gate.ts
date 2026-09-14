/**
 * Organic Build refuses a cutoff line when statutory membership numbers are blank.
 * Scans do not block pay.
 */

function present(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

export const STATUTORY_PAYROLL_FIELDS = [
  { key: "sss_number", label: "SSS" },
  { key: "tin", label: "TIN" },
  { key: "philhealth_number", label: "PhilHealth" },
  { key: "pagibig_number", label: "Pag-IBIG" },
] as const;

export type StatutoryPayrollIds = {
  tin?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
};

export type StatutoryPayrollBlock = {
  directory_employee_id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  client_id: string | null;
  missing: string[];
};

export function missingStatutoryIdLabels(
  employee: StatutoryPayrollIds
): string[] {
  return STATUTORY_PAYROLL_FIELDS.filter(
    (field) => !present(employee[field.key])
  ).map((field) => field.label);
}

export function listStatutoryPayrollBlocks<
  T extends StatutoryPayrollIds & {
    id: string;
    employee_code?: string | null;
    last_name?: string | null;
    first_name?: string | null;
    client_id?: string | null;
  },
>(employees: T[]): StatutoryPayrollBlock[] {
  const blocked: StatutoryPayrollBlock[] = [];
  for (const row of employees) {
    const missing = missingStatutoryIdLabels(row);
    if (missing.length === 0) continue;
    blocked.push({
      directory_employee_id: row.id,
      employee_code: row.employee_code ?? null,
      last_name: row.last_name ?? null,
      first_name: row.first_name ?? null,
      client_id: row.client_id ?? null,
      missing,
    });
  }
  return blocked;
}
