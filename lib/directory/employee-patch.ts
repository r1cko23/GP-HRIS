import { EMPLOYEE_STATUSES, isEmployeeStatus } from "@/lib/directory/employees";
import { normalizeProseTextOrNull } from "@/lib/prose-text";
import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";

const RAW_STRING_KEYS = new Set([
  "email",
  "mobile",
  "tin",
  "sss_number",
  "philhealth_number",
  "pagibig_number",
  "gcash",
  "bank_account_no",
  "sex",
  "profile_picture_url",
]);

const DATE_KEYS = new Set(["birth_date", "hire_date"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const REQUIRED_NAME_KEYS = new Set(["last_name", "first_name"]);

/** Fields Admin/HR may PATCH on directory.employees (no full GREENHRISMAIN clone). */
export const DIRECTORY_EMPLOYEE_PATCH_KEYS = [
  "last_name",
  "first_name",
  "middle_name",
  "sex",
  "birth_date",
  "hire_date",
  "status",
  "branch_id",
  "department_id",
  "position_id",
  "email",
  "mobile",
  "address",
  "profile_picture_url",
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
    if (REQUIRED_NAME_KEYS.has(key)) {
      if (value === null || value === undefined || value === "") {
        return { ok: false, error: `${key} is required` };
      }
      if (typeof value !== "string") {
        return { ok: false, error: `${key} must be a string` };
      }
      const normalized = normalizeProseTextOrNull(value);
      if (!normalized) {
        return { ok: false, error: `${key} is required` };
      }
      patch[key] = normalized;
      continue;
    }
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
    if (DATE_KEYS.has(key)) {
      if (value === null || value === "") {
        patch[key] = null;
      } else if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
          patch[key] = null;
        } else if (!ISO_DATE.test(trimmed)) {
          return { ok: false, error: `${key} must be YYYY-MM-DD` };
        } else {
          patch[key] = trimmed;
        }
      } else {
        return { ok: false, error: `${key} must be a date string or null` };
      }
      continue;
    }
    if (key === "branch_id" || key === "department_id" || key === "position_id") {
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
        // Keep up to 4dp for daily rates (UI displays 2dp). ECOLA is money → 2dp via DB.
        patch[key] =
          key === "ecola" ? Math.round(n * 100) / 100 : roundDailyRate4(n);
      }
      continue;
    }
    if (value === null || value === "") {
      patch[key] = null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        patch[key] = null;
      } else if (RAW_STRING_KEYS.has(key)) {
        patch[key] = trimmed;
      } else {
        patch[key] = normalizeProseTextOrNull(trimmed);
      }
    } else {
      return { ok: false, error: `${key} must be a string or null` };
    }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No allowed fields to update" };
  }
  return { ok: true, patch };
}
