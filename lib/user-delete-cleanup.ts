import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

/** PostgREST / Postgres errors for missing tables or columns in this project. */
function isSkippableSchemaError(error: { message?: string; code?: string }) {
  const msg = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the") ||
    msg.includes("schema cache")
  );
}

/** Nullable FK columns pointing at public.users — cleared before user row delete. */
const NULLIFY_USER_REFS: Array<{ table: string; column: string }> = [
  { table: "overtime_groups", column: "approver_id" },
  { table: "overtime_groups", column: "viewer_id" },
  { table: "employees", column: "overtime_approver_id" },
  { table: "employees", column: "overtime_viewer_id" },
  { table: "employees", column: "created_by" },
  { table: "employees", column: "updated_by" },
  { table: "employee_location_assignments", column: "updated_by" },
  { table: "leave_requests", column: "account_manager_id" },
  { table: "leave_requests", column: "hr_approved_by" },
  { table: "leave_requests", column: "rejected_by" },
  { table: "failure_to_log", column: "account_manager_id" },
  { table: "failure_to_log", column: "approved_by" },
  { table: "overtime_requests", column: "account_manager_id" },
  { table: "overtime_requests", column: "approved_by" },
  { table: "weekly_attendance", column: "finalized_by" },
  { table: "weekly_attendance", column: "created_by" },
  { table: "employee_week_schedules", column: "updated_by" },
  { table: "cutoff_allowances_deductions", column: "created_by" },
  { table: "employee_loans", column: "created_by" },
  { table: "employee_loans", column: "updated_by" },
  { table: "payslips", column: "created_by" },
  { table: "holidays", column: "created_by" },
  { table: "employee_deductions", column: "created_by" },
  { table: "employee_deductions", column: "updated_by" },
  { table: "time_clock_entries", column: "approved_by" },
  { table: "audit_logs", column: "user_id" },
];

export interface UserDeleteCleanupResult {
  reassignedPayrollUploads: number;
  clearedReferences: Array<{ table: string; column: string }>;
  warnings: string[];
}

export interface RemainingUserReference {
  table: string;
  column: string;
  count: number;
}

/** Check whether any known FK columns still point at this user. */
export async function findRemainingUserReferences(
  supabase: AdminClient,
  userId: string
): Promise<RemainingUserReference[]> {
  const remaining: RemainingUserReference[] = [];

  const { count: uploadCount } = await supabase
    .from("payroll_summary_uploads")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by", userId);
  if ((uploadCount ?? 0) > 0) {
    remaining.push({
      table: "payroll_summary_uploads",
      column: "uploaded_by",
      count: uploadCount ?? 0,
    });
  }

  for (const { table, column } of NULLIFY_USER_REFS) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, userId);

    if (error) {
      if (isSkippableSchemaError(error)) {
        continue;
      }
      throw new Error(
        `Could not verify ${table}.${column}: ${error.message || error.code || "unknown error"}`
      );
    }

    if ((count ?? 0) > 0) {
      remaining.push({ table, column, count: count ?? 0 });
    }
  }

  return remaining;
}

/**
 * Detach a user from FK references so the public.users row can be removed.
 * Payroll uploads (ON DELETE RESTRICT) are reassigned to `fallbackUserId`.
 */
export async function cleanupUserReferences(
  supabase: AdminClient,
  userId: string,
  fallbackUserId: string
): Promise<UserDeleteCleanupResult> {
  const clearedReferences: UserDeleteCleanupResult["clearedReferences"] = [];
  const warnings: string[] = [];

  const { count: uploadCount, error: uploadCountErr } = await supabase
    .from("payroll_summary_uploads")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by", userId);

  if (uploadCountErr) {
    throw new Error(
      `Could not check payroll uploads: ${uploadCountErr.message}`
    );
  }

  let reassignedPayrollUploads = 0;
  if ((uploadCount ?? 0) > 0) {
    if (fallbackUserId === userId) {
      throw new Error(
        "Cannot delete this user: they uploaded payroll registers and there is no other admin to reassign them to."
      );
    }
    const { error: reassignErr } = await supabase
      .from("payroll_summary_uploads")
      .update({ uploaded_by: fallbackUserId })
      .eq("uploaded_by", userId);

    if (reassignErr) {
      throw new Error(
        `Could not reassign payroll uploads: ${reassignErr.message}`
      );
    }
    reassignedPayrollUploads = uploadCount ?? 0;
  }

  for (const { table, column } of NULLIFY_USER_REFS) {
    const { error } = await supabase
      .from(table)
      .update({ [column]: null })
      .eq(column, userId);

    if (error) {
      if (isSkippableSchemaError(error)) {
        warnings.push(`Skipped ${table}.${column}: ${error.message || error.code}`);
        continue;
      }
      throw new Error(
        `Could not clear ${table}.${column}: ${error.message || error.code || "unknown error"}`
      );
    }
    clearedReferences.push({ table, column });
  }

  // Legacy/alternate time entry tables (may not exist in all environments).
  for (const table of ["time_entries"]) {
    for (const column of ["approved_by", "reviewed_by"]) {
      const { error } = await supabase
        .from(table)
        .update({ [column]: null })
        .eq(column, userId);
      if (!error) {
        clearedReferences.push({ table, column });
      } else {
        if (!isSkippableSchemaError(error)) {
          warnings.push(`Skipped ${table}.${column}: ${error.message || error.code}`);
        }
      }
    }
  }

  return { reassignedPayrollUploads, clearedReferences, warnings };
}
