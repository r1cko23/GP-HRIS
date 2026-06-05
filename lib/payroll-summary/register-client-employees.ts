import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmployeeName } from "./normalize-name";
import type { PayrollSummaryMetrics } from "./types";

export async function upsertClientEmployeesFromRegister(
  supabase: SupabaseClient,
  companyId: string,
  metrics: PayrollSummaryMetrics,
  registerUploadId: string
) {
  const rows = metrics.employees.map((emp) => ({
    company_id: companyId,
    display_name: emp.name.trim(),
    normalized_name: normalizeEmployeeName(emp.name),
    daily_rate: null,
    position: null,
    hours_worked: emp.hoursWorked,
    gross_amount: emp.grossAmount,
    net_amount: emp.netAmount,
    sil_cutoff: emp.silCutoff,
    plantilla_upload_id: null,
    register_upload_id: registerUploadId,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("payroll_audit_client_employees")
    .upsert(rows, { onConflict: "company_id,normalized_name" })
    .select("*");

  if (error) throw error;
  return data ?? [];
}
