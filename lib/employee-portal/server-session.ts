import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const EMPLOYEE_SESSION_COOKIE = "gp_employee_session";

export function employeePortalAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Employee portal service is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireEmployeePortalSession(): Promise<
  | { ok: true; employeeId: string; admin: ReturnType<typeof employeePortalAdmin> }
  | { ok: false; status: 401; error: string }
> {
  const token = cookies().get(EMPLOYEE_SESSION_COOKIE)?.value;
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };
  const admin = employeePortalAdmin();
  const { data, error } = await admin.rpc("assert_employee_portal_session", {
    p_session_token: token,
    p_expected_employee_id: null,
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result?.is_valid || !result.employee_id) {
    return { ok: false, status: 401, error: "Session expired" };
  }
  return { ok: true, employeeId: String(result.employee_id), admin };
}
