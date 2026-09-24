/**
 * Unlink CSM Draft / AM Verified rows whose Directory 201 has not passed
 * GREENHRISMAIN verification (Pending), or Directory status is already
 * for_verification.
 */

export type DirectoryPersonForUnlink = {
  id: string;
  legacy_id: number | null;
  status: string;
  last_name?: string | null;
  first_name?: string | null;
  employee_code?: string | null;
};

export type CsmLinkedRow = {
  id: string;
  directory_employee_id: string | null;
  employee_name?: string | null;
  employment_status?: string | null;
  is_current?: boolean | null;
};

export type UnlinkTarget = {
  table: "csm_employees_verified" | "csm_employees_draft";
  rowId: string;
  directoryEmployeeId: string;
  employeeName: string;
  directoryStatus: string;
  legacyId: number | null;
  reason: "main_pending_verification" | "directory_for_verification";
};

function foldStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Plan CSM Directory unlinks for Pending MAIN 201s and Directory
 * for_verification people who are still linked on Draft / AM Verified.
 */
export function planUnlinkUnverifiedAmVerified(input: {
  pendingLegacyIds: ReadonlySet<number>;
  directoryById: Map<string, DirectoryPersonForUnlink>;
  verified: CsmLinkedRow[];
  draft: CsmLinkedRow[];
}): UnlinkTarget[] {
  const out: UnlinkTarget[] = [];
  const seen = new Set<string>();

  const consider = (
    table: UnlinkTarget["table"],
    row: CsmLinkedRow
  ) => {
    const directoryEmployeeId = row.directory_employee_id?.trim() || "";
    if (!directoryEmployeeId) return;
    if (table === "csm_employees_verified" && row.is_current === false) return;

    const person = input.directoryById.get(directoryEmployeeId);
    if (!person) return;

    const status = foldStatus(person.status);
    let reason: UnlinkTarget["reason"] | null = null;

    if (
      person.legacy_id != null &&
      input.pendingLegacyIds.has(person.legacy_id)
    ) {
      reason = "main_pending_verification";
    } else if (status === "for_verification") {
      reason = "directory_for_verification";
    }

    if (!reason) return;

    const key = `${table}:${row.id}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      table,
      rowId: row.id,
      directoryEmployeeId,
      employeeName:
        row.employee_name?.trim() ||
        [person.last_name, person.first_name].filter(Boolean).join(", ") ||
        directoryEmployeeId,
      directoryStatus: person.status,
      legacyId: person.legacy_id,
      reason,
    });
  };

  for (const row of input.verified) consider("csm_employees_verified", row);
  for (const row of input.draft) consider("csm_employees_draft", row);
  return out;
}
