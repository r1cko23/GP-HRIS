/**
 * Statutory ID gaps on payroll: warn and remind — do not exclude register lines.
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
  /** Distinct cutoffs this person already has hours on while IDs are still blank. */
  cutoffs_without_ids: number;
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
      cutoffs_without_ids: 0,
    });
  }
  return blocked;
}

export function attachCutoffsWithoutIds(
  warnings: StatutoryPayrollBlock[],
  cutoffsByDirectoryId: Map<string, number>
): StatutoryPayrollBlock[] {
  return warnings.map((row) => ({
    ...row,
    cutoffs_without_ids: Math.max(
      0,
      Number(cutoffsByDirectoryId.get(row.directory_employee_id) ?? 0) || 0
    ),
  }));
}

function personLabel(row: StatutoryPayrollBlock): string {
  const name = [row.last_name, row.first_name].filter(Boolean).join(", ");
  if (name) return name;
  return row.employee_code?.trim() || row.directory_employee_id;
}

/**
 * Memo text stored on the register run / shown in the hub so HR is reminded
 * to collect missing IDs (and how long the gap has run).
 */
export function formatStatutoryIdReminderMemo(
  warnings: StatutoryPayrollBlock[]
): string {
  if (!warnings.length) return "";
  const lines = warnings.map((row) => {
    const cutoffs = row.cutoffs_without_ids;
    const cutoffPhrase =
      cutoffs <= 0
        ? "first cutoff with missing IDs"
        : cutoffs === 1
          ? "1 cutoff so far without complete IDs"
          : `${cutoffs} cutoffs so far without complete IDs`;
    return `- ${personLabel(row)} · missing ${row.missing.join(", ")} · ${cutoffPhrase} — remind to get the ID`;
  });
  return [
    "MEMO · Missing statutory IDs (lines still built — warning only)",
    ...lines,
  ].join("\n");
}

const PAYROLL_OMITTED_STATUSES = new Set([
  "inactive",
  "barred",
  "for_verification",
]);

/** Inactive, barred, and for-verification 201s do not get a payroll line. */
export function directoryStatusOmitsPayroll(
  status: string | null | undefined
): boolean {
  return PAYROLL_OMITTED_STATUSES.has((status ?? "").trim().toLowerCase());
}

export type StatusPayrollWarning = {
  directory_employee_id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  status: string;
};

export function formatStatusPayrollWarningMemo(
  warnings: StatusPayrollWarning[]
): string {
  if (!warnings.length) return "";
  const lines = warnings.map((row) => {
    const name =
      [row.last_name, row.first_name].filter(Boolean).join(", ") ||
      row.employee_code ||
      row.directory_employee_id;
    return `- ${name} · status ${row.status} (left off the register)`;
  });
  return ["MEMO · Not paid on this register", ...lines].join("\n");
}
