import { EMPLOYEE_STATUSES, isEmployeeStatus } from "@/lib/directory/employees";

/** Fields Admin/HR may PATCH on directory.employees (no full GREENHRISMAIN clone). */
export const DIRECTORY_EMPLOYEE_PATCH_KEYS = [
  "status",
  "branch_id",
  "position_id",
  "email",
  "mobile",
  "address",
  "tin",
  "sss_number",
  "philhealth_number",
  "pagibig_number",
  "tax_status",
  "bank_name",
  "bank_account_no",
  "gcash",
  "pay_through",
  "daily_rate",
  "billing_daily_rate",
  "ecola",
] as const;

export type DirectoryEmployeePatchKey =
  (typeof DIRECTORY_EMPLOYEE_PATCH_KEYS)[number];

export function pickDirectoryEmployeePatch(
  body: Record<string, unknown>
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const patch: Record<string, unknown> = {};
  for (const key of DIRECTORY_EMPLOYEE_PATCH_KEYS) {
    if (!(key in body)) continue;
    const value = body[key];
    if (key === "status") {
      if (value === null || value === undefined || value === "") {
        return { ok: false, error: "status is required" };
      }
      if (typeof value !== "string" || !isEmployeeStatus(value)) {
        return {
          ok: false,
          error: `Invalid status. Allowed: ${EMPLOYEE_STATUSES.join(", ")}`,
        };
      }
      patch.status = value;
      continue;
    }
    if (key === "branch_id" || key === "position_id") {
      if (value === null || value === "") {
        patch[key] = null;
      } else if (typeof value === "string") {
        patch[key] = value;
      } else {
        return { ok: false, error: `${key} must be a uuid string or null` };
      }
      continue;
    }
    if (
      key === "daily_rate" ||
      key === "billing_daily_rate" ||
      key === "ecola"
    ) {
      if (value === null || value === "") {
        patch[key] = null;
      } else {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          return { ok: false, error: `${key} must be a number` };
        }
        patch[key] = n;
      }
      continue;
    }
    if (value === null || value === "") {
      patch[key] = null;
    } else if (typeof value === "string") {
      patch[key] = value.trim() || null;
    } else {
      return { ok: false, error: `${key} must be a string or null` };
    }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No allowed fields to update" };
  }
  return { ok: true, patch };
}
