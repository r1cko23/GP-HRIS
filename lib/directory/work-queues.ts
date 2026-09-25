/** Org-wide People hub work-queue badge counts (`directory.employee_work_counts`). */
export type EmployeeWorkCounts = {
  needs_review: number;
  missing_statutory: number;
  missing_documents: number;
  incomplete_201: number;
  for_verification: number;
};

export function mapEmployeeWorkCounts(
  row: Record<string, unknown> | null | undefined
): EmployeeWorkCounts {
  return {
    needs_review: Number(row?.needs_review ?? 0),
    missing_statutory: Number(row?.missing_statutory ?? 0),
    missing_documents: Number(row?.missing_documents ?? 0),
    incomplete_201: Number(row?.incomplete_201 ?? 0),
    for_verification: Number(row?.for_verification ?? 0),
  };
}
