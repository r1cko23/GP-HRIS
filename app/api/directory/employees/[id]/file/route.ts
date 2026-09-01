import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  STALE_FALLBACK_DAYS,
  computeLifecycleSignals,
} from "@/lib/directory/lifecycle";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const CHILD_TABLES = [
  "employee_contacts",
  "employee_dependents",
  "employee_education",
  "employee_job_history",
  "employee_licenses",
  "employee_medical",
  "employee_movements",
  "employee_skills",
] as const;

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const { data: employee, error } = await auth.supabase
    .from("employees")
    .select(
      `
      *,
      client:clients(id, name, status, pay_frequency),
      branch:client_branches(id, name, location),
      position:positions(id, job_title, department, payroll_daily_rate, billing_daily_rate)
    `
    )
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!employee) return jsonError("Employee not found", 404);

  const clientIdParam = request.nextUrl.searchParams.get("client_id");
  if (clientIdParam && employee.client_id !== clientIdParam) {
    return jsonError("Employee is not in this client view", 404);
  }

  const clientId = (employee.client_id as string | null) ?? null;
  let clientLatest: string | null = null;
  if (clientId) {
    const { data: latestRow } = await auth.supabase
      .from("employees")
      .select("last_payroll_end")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .eq("is_current_engagement", true)
      .not("last_payroll_end", "is", null)
      .gte("last_payroll_end", "2000-01-01")
      .order("last_payroll_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    clientLatest = (latestRow?.last_payroll_end as string | null) ?? null;
  }

  const children: Record<string, unknown[]> = {};
  try {
    await Promise.all(
      CHILD_TABLES.map(async (table) => {
        const { data, error: childError } = await auth.supabase
          .from(table)
          .select("*")
          .eq("organization_id", orgId)
          .eq("employee_id", params.id)
          .order("created_at", { ascending: false });
        if (childError) throw childError;
        children[table] = data ?? [];
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "201 file failed";
    return jsonError(message, 500);
  }

  const signals = computeLifecycleSignals({
    status: String(employee.status),
    last_payroll_end: (employee.last_payroll_end as string | null) ?? null,
    client_latest_payroll_end: clientLatest,
  });

  return jsonOk({
    data: {
      employee: {
        ...employee,
        ...signals,
        needs_review: signals.lifecycle_flag === "needs_review",
        client_latest_payroll_end: clientLatest,
      },
      contacts: children.employee_contacts,
      dependents: children.employee_dependents,
      education: children.employee_education,
      job_history: children.employee_job_history,
      licenses: children.employee_licenses,
      medical: children.employee_medical,
      movements: children.employee_movements,
      skills: children.employee_skills,
    },
    meta: {
      client_latest_payroll_end: clientLatest,
      stale_fallback_days: STALE_FALLBACK_DAYS,
    },
  });
}
