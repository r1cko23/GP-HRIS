/**
 * Live Directory employee_code is YYYYMM-##### (first hire month).
 * GREENHRISMAIN Employee_id / EMP_code stay as aliases, never as the live ID.
 */

export const DIRECTORY_EMPLOYEE_CODE_RE = /^[0-9]{6}-[0-9]{5}$/;

export function isAllocatedDirectoryCode(
  code: string | null | undefined
): boolean {
  return DIRECTORY_EMPLOYEE_CODE_RE.test((code ?? "").trim());
}

export type ImportedEmployeeIdentity = {
  /** YYYYMM-##### already on the source row; null means allocate. */
  liveCode: string | null;
  aliasCodes: string[];
};

export function planImportedEmployeeIdentity(input: {
  empCode?: string | null;
  legacyId?: number | null;
}): ImportedEmployeeIdentity {
  const emp = (input.empCode ?? "").trim();
  const legacy =
    input.legacyId != null &&
    Number.isFinite(input.legacyId) &&
    input.legacyId > 0
      ? String(Math.trunc(input.legacyId))
      : "";

  if (isAllocatedDirectoryCode(emp)) {
    return {
      liveCode: emp,
      aliasCodes: legacy && legacy !== emp ? [legacy] : [],
    };
  }

  const aliases: string[] = [];
  if (emp) aliases.push(emp);
  if (legacy && legacy !== emp) aliases.push(legacy);
  return { liveCode: null, aliasCodes: aliases };
}
