import { normalizeProseTextOrNull } from "@/lib/prose-text";
import { foldLabel } from "@/lib/directory/site-label";

export type LegacyDepartmentRow = {
  iddepartment?: unknown;
  idclient?: unknown;
  Department_desc?: unknown;
  departmenttagdelete?: unknown;
  preparedbydepartment?: unknown;
};

export type DirectoryDepartmentPayload = {
  legacy_id: number;
  client_legacy_id: number;
  name: string;
  is_active: boolean;
  prepared_by: string | null;
};

export type MapLegacyDepartmentResult =
  | { ok: true; payload: DirectoryDepartmentPayload }
  | {
      ok: false;
      reason: "deleted" | "missing_name" | "missing_id" | "missing_client";
    };

export type DirectoryDepartmentRef = {
  id: string;
  client_id: string;
  name: string;
};

export type DepartmentLegacyRef = {
  id: string;
  client_id: string;
  legacy_id: number;
};

/** GREENHRISMAIN Employee.department_code → Directory department UUID on that client. */
export function planEmployeeDepartmentId(input: {
  departmentCode: unknown;
  employeeClientId: string | null;
  departmentsByLegacy: ReadonlyMap<number, DepartmentLegacyRef>;
}): string | null {
  const code = asInt(input.departmentCode);
  if (code === null) return null;
  const department = input.departmentsByLegacy.get(code);
  if (!department) return null;
  if (!input.employeeClientId) return null;
  if (department.client_id !== input.employeeClientId) return null;
  return department.id;
}

function asInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function isDeleted(tag: unknown): boolean {
  const text = String(tag ?? "").trim().toLowerCase();
  return text === "1" || text === "y" || text === "yes" || text === "true";
}

/** GREENHRISMAIN dbo.Department → Directory client_departments row (no UUID yet). */
export function mapLegacyDepartment(
  row: LegacyDepartmentRow
): MapLegacyDepartmentResult {
  if (isDeleted(row.departmenttagdelete)) {
    return { ok: false, reason: "deleted" };
  }
  const legacyId = asInt(row.iddepartment);
  if (legacyId === null) return { ok: false, reason: "missing_id" };
  const clientLegacyId = asInt(row.idclient);
  if (clientLegacyId === null) return { ok: false, reason: "missing_client" };
  const name = normalizeProseTextOrNull(String(row.Department_desc ?? ""));
  if (!name) return { ok: false, reason: "missing_name" };
  return {
    ok: true,
    payload: {
      legacy_id: legacyId,
      client_legacy_id: clientLegacyId,
      name,
      is_active: true,
      prepared_by: normalizeProseTextOrNull(
        String(row.preparedbydepartment ?? "")
      ),
    },
  };
}

/** UUIDs CSM stores on an outlet. Not directory_branch_id (payroll site). */
export function csmDirectoryDepartmentLink(department: {
  id: string;
  client_id: string;
}): {
  directory_department_id: string;
  directory_client_id: string;
} {
  return {
    directory_department_id: department.id,
    directory_client_id: department.client_id,
  };
}

function wordsContain(hayFold: string, needleFold: string): boolean {
  if (!needleFold) return false;
  return ` ${hayFold} `.includes(` ${needleFold} `);
}

/**
 * Bind a CSM outlet name to a unique Directory department under that client.
 * Skip when zero or many stores could claim the name.
 */
export function matchDirectoryDepartment(
  outletName: string,
  departments: DirectoryDepartmentRef[],
  options?: { clientId?: string }
): DirectoryDepartmentRef | null {
  const needle = foldLabel(outletName);
  if (!needle) return null;
  const scoped = options?.clientId
    ? departments.filter((row) => row.client_id === options.clientId)
    : departments;
  if (scoped.length === 0) return null;

  const exact = scoped.filter((row) => foldLabel(row.name) === needle);
  if (exact.length === 1) return exact[0] ?? null;
  if (exact.length > 1) return null;

  const contained = scoped.filter((row) => {
    const dept = foldLabel(row.name);
    return dept !== needle && wordsContain(needle, dept);
  });
  if (contained.length === 1) return contained[0] ?? null;
  if (contained.length > 1) {
    const longest = Math.max(
      ...contained.map((row) => foldLabel(row.name).length)
    );
    const winners = contained.filter(
      (row) => foldLabel(row.name).length === longest
    );
    return winners.length === 1 ? (winners[0] ?? null) : null;
  }
  return null;
}
