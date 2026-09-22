export type EmployeeOption = {
  id: string;
  employee_id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
};

const DEFAULT_LIMIT = 10;

export function matchEmployeeOption(
  query: string,
  emp: EmployeeOption
): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return Boolean(
    emp.full_name?.toLowerCase().includes(q) ||
      emp.last_name?.toLowerCase().includes(q) ||
      emp.first_name?.toLowerCase().includes(q) ||
      emp.employee_id.toLowerCase().includes(q)
  );
}

/** In-memory employee typeahead (≥1 char when query set, capped). */
export function suggestEmployeeOptions(
  employees: EmployeeOption[],
  query: string,
  opts?: { limit?: number; includeAllWhenEmpty?: boolean }
): EmployeeOption[] {
  const q = query.trim();
  const limit = Math.min(Math.max(opts?.limit ?? DEFAULT_LIMIT, 1), 20);
  if (!q) {
    if (!opts?.includeAllWhenEmpty) return [];
    return employees.slice(0, limit);
  }
  const hits: EmployeeOption[] = [];
  for (const emp of employees) {
    if (!matchEmployeeOption(q, emp)) continue;
    hits.push(emp);
    if (hits.length >= limit) break;
  }
  return hits;
}
