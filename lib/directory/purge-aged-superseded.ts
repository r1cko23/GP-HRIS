/**
 * Classify parked (superseded) 201s that are past the BIR-style 5-year retention
 * floor for a purge dry-run. Does not delete — reports eligible vs blocked.
 */

export const DEFAULT_RETENTION_YEARS = 5;

export type AgedSupersededRow = {
  id: string;
  organization_id: string;
  superseded_by: string | null;
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  status: string;
  hire_date: string | null;
  resign_date: string | null;
  last_payroll_end: string | null;
  created_at: string | null;
};

export type SoftRefCounts = {
  cutoff_hours: number;
  cutoff_dtr_punches: number;
  payroll_register_lines: number;
  payroll_main_accrual_openings: number;
  payroll_catchup_corrections: number;
  billing_lines: number;
  employee_loans: number;
  public_employees: number;
  employment_tenures: number;
  employee_code_aliases_as_source: number;
};

export type PurgeCandidate = {
  id: string;
  organization_id: string;
  superseded_by: string | null;
  employee_code: string | null;
  name: string;
  status: string;
  last_entry: string;
  years_since_last_entry: number;
  eligible: boolean;
  block_reasons: string[];
  refs: SoftRefCounts;
};

function dateKey(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

function realDate(value: string | null | undefined): string {
  const key = dateKey(value);
  if (!key) return "";
  const year = Number(key.slice(0, 4));
  if (!Number.isFinite(year) || year < 1990 || year > 2100) return "";
  return key;
}

/**
 * Last meaningful entry for retention: last payroll → resign → hire → created_at.
 */
export function lastEntryDate(row: {
  last_payroll_end?: string | null;
  resign_date?: string | null;
  hire_date?: string | null;
  created_at?: string | null;
}): string | null {
  return (
    realDate(row.last_payroll_end) ||
    realDate(row.resign_date) ||
    realDate(row.hire_date) ||
    realDate(row.created_at) ||
    null
  );
}

export function yearsBetween(fromIsoDate: string, asOf: Date): number {
  const from = new Date(`${fromIsoDate}T00:00:00.000Z`);
  const ms = asOf.getTime() - from.getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

export function emptySoftRefs(): SoftRefCounts {
  return {
    cutoff_hours: 0,
    cutoff_dtr_punches: 0,
    payroll_register_lines: 0,
    payroll_main_accrual_openings: 0,
    payroll_catchup_corrections: 0,
    billing_lines: 0,
    employee_loans: 0,
    public_employees: 0,
    employment_tenures: 0,
    employee_code_aliases_as_source: 0,
  };
}

export function softRefBlockReasons(refs: SoftRefCounts): string[] {
  const reasons: string[] = [];
  if (refs.cutoff_hours > 0) reasons.push(`cutoff_hours:${refs.cutoff_hours}`);
  if (refs.cutoff_dtr_punches > 0) {
    reasons.push(`cutoff_dtr_punches:${refs.cutoff_dtr_punches}`);
  }
  if (refs.payroll_register_lines > 0) {
    reasons.push(`payroll_register_lines:${refs.payroll_register_lines}`);
  }
  if (refs.payroll_main_accrual_openings > 0) {
    reasons.push(
      `payroll_main_accrual_openings:${refs.payroll_main_accrual_openings}`
    );
  }
  if (refs.payroll_catchup_corrections > 0) {
    reasons.push(
      `payroll_catchup_corrections:${refs.payroll_catchup_corrections}`
    );
  }
  if (refs.billing_lines > 0) reasons.push(`billing_lines:${refs.billing_lines}`);
  if (refs.employee_loans > 0) reasons.push(`employee_loans:${refs.employee_loans}`);
  if (refs.public_employees > 0) {
    reasons.push(`public_employees:${refs.public_employees}`);
  }
  // Tenures / aliases on the extra are remappable — report but do not hard-block
  // eligibility for the dry-run "safe after remap" list; they go in soft_remap.
  return reasons;
}

export function softRemapNotes(refs: SoftRefCounts): string[] {
  const notes: string[] = [];
  if (refs.employment_tenures > 0) {
    notes.push(`employment_tenures:${refs.employment_tenures}`);
  }
  if (refs.employee_code_aliases_as_source > 0) {
    notes.push(
      `employee_code_aliases_as_source:${refs.employee_code_aliases_as_source}`
    );
  }
  return notes;
}

export function classifyAgedSuperseded(
  rows: AgedSupersededRow[],
  refsById: Map<string, SoftRefCounts>,
  options?: { asOf?: Date; retentionYears?: number }
): {
  retention_years: number;
  as_of: string;
  aged: PurgeCandidate[];
  eligible: PurgeCandidate[];
  blocked: PurgeCandidate[];
  too_recent: number;
  missing_master: number;
} {
  const asOf = options?.asOf ?? new Date();
  const retentionYears = options?.retentionYears ?? DEFAULT_RETENTION_YEARS;
  const aged: PurgeCandidate[] = [];
  let too_recent = 0;
  let missing_master = 0;

  for (const row of rows) {
    const last = lastEntryDate(row);
    if (!last) {
      too_recent += 1;
      continue;
    }
    const years = yearsBetween(last, asOf);
    if (years < retentionYears) {
      too_recent += 1;
      continue;
    }

    const refs = refsById.get(row.id) ?? emptySoftRefs();
    const hardBlocks = softRefBlockReasons(refs);
    if (!row.superseded_by) {
      hardBlocks.push("missing_superseded_by");
      missing_master += 1;
    }
    const remap = softRemapNotes(refs);
    const candidate: PurgeCandidate = {
      id: row.id,
      organization_id: row.organization_id,
      superseded_by: row.superseded_by,
      employee_code: row.employee_code ?? null,
      name: `${row.last_name ?? ""}, ${row.first_name ?? ""}`.trim(),
      status: row.status,
      last_entry: last,
      years_since_last_entry: Math.floor(years * 10) / 10,
      eligible: hardBlocks.length === 0,
      block_reasons: [...hardBlocks, ...remap.map((n) => `remap:${n}`)],
      refs,
    };
    aged.push(candidate);
  }

  return {
    retention_years: retentionYears,
    as_of: asOf.toISOString().slice(0, 10),
    aged,
    eligible: aged.filter((row) => row.eligible),
    blocked: aged.filter((row) => !row.eligible),
    too_recent,
    missing_master,
  };
}
