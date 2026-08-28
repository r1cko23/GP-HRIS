import { createClient } from "@supabase/supabase-js";
import { calculateMonthlySalary } from "@/utils/ph-deductions";

type DirectoryRehireRow = {
  id: string;
  organization_id?: string | null;
  client_id: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  hire_date: string | null;
  daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
  position?:
    | { job_title?: string | null }
    | { job_title?: string | null }[]
    | null;
};

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function positionTitle(row: DirectoryRehireRow): string | null {
  const pos = row.position;
  const meta = Array.isArray(pos) ? pos[0] : pos;
  const title = meta?.job_title?.trim();
  return title || null;
}

/**
 * Mirror Directory rehire onto linked public.employees (office clock roster).
 * Safe no-op when service role env is missing or no linked office rows.
 */
export async function syncOfficeEmployeesAfterDirectoryRehire(
  directoryEmployee: DirectoryRehireRow,
  options?: { updatedBy?: string | null }
): Promise<{ updated: number; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { updated: 0, error: "Supabase service role missing" };
  }

  const publicDb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dailyRate = asNumber(directoryEmployee.daily_rate);
  const billingRate = asNumber(directoryEmployee.billing_daily_rate);
  const jobTitle = positionTitle(directoryEmployee);

  const patch: Record<string, unknown> = {
    status: "active",
    is_active: true,
    hire_date: directoryEmployee.hire_date,
    resign_date: null,
    organization_id: directoryEmployee.organization_id ?? undefined,
    directory_client_id: directoryEmployee.client_id,
    branch_id: directoryEmployee.branch_id ?? null,
    position_id: directoryEmployee.position_id ?? null,
    updated_at: new Date().toISOString(),
  };

  if (options?.updatedBy) patch.updated_by = options.updatedBy;
  if (jobTitle) patch.position = jobTitle;
  if (dailyRate != null && dailyRate > 0) {
    patch.daily_rate = dailyRate;
    patch.per_day = dailyRate;
    patch.monthly_rate = calculateMonthlySalary(dailyRate, 26);
  }
  if (billingRate != null && billingRate > 0) {
    patch.billing_daily_rate = billingRate;
  }

  // Drop undefined keys so we don't wipe organization_id accidentally
  for (const keyName of Object.keys(patch)) {
    if (patch[keyName] === undefined) delete patch[keyName];
  }

  const { data, error } = await publicDb
    .from("employees")
    .update(patch)
    .eq("directory_employee_id", directoryEmployee.id)
    .select("id");

  if (error) return { updated: 0, error: error.message };
  return { updated: data?.length ?? 0 };
}
