import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { emitDirectoryEvent } from "@/lib/directory/events";
import { isEmployeeStatus } from "@/lib/directory/employees";
import {
  STALE_FALLBACK_DAYS,
  computeLifecycleSignals,
} from "@/lib/directory/lifecycle";

export const dynamic = "force-dynamic";

const LIFECYCLE_FILTERS = new Set([
  "needs_review",
  "for_release",
  "inactive",
  "ok",
]);

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const lifecycle = params.get("lifecycle")?.trim() || null;
  const q = params.get("q")?.trim();
  const clientId = params.get("client_id");
  const includeHistory =
    params.get("include_history") === "1" ||
    params.get("include_history") === "true";
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);

  if (status && !isEmployeeStatus(status)) {
    return jsonError("Invalid status", 400);
  }
  if (lifecycle && !LIFECYCLE_FILTERS.has(lifecycle)) {
    return jsonError(
      "Invalid lifecycle. Allowed: needs_review, for_release, inactive, ok",
      400
    );
  }

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

  let query = auth.supabase
    .from("employees")
    .select(
      "id, employee_code, last_name, first_name, middle_name, status, mobile, hire_date, first_hire_date, last_payroll_end, resign_date, client_id, is_current_engagement, superseded_by, position:positions(job_title, department), branch:client_branches(name, location)",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .order("last_name")
    .range(offset, offset + limit - 1);

  if (!includeHistory) {
    query = query.eq("is_current_engagement", true);
  }
  if (clientId) query = query.eq("client_id", clientId);

  if (lifecycle === "needs_review") {
    query = query.eq("status", "active");
    if (clientLatest) {
      query = query.or(
        `last_payroll_end.is.null,last_payroll_end.lt.${clientLatest}`
      );
    } else {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - STALE_FALLBACK_DAYS);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      query = query.or(
        `last_payroll_end.is.null,last_payroll_end.lt.${cutoffStr}`
      );
    }
  } else if (lifecycle === "for_release") {
    query = query.eq("status", "for_release");
  } else if (lifecycle === "inactive") {
    query = query.eq("status", "inactive");
  } else if (lifecycle === "ok") {
    query = query.eq("status", "active");
    if (clientLatest) {
      query = query.eq("last_payroll_end", clientLatest);
    }
  } else if (status) {
    query = query.eq("status", status);
  }

  if (q) {
    const aliasQuery = auth.supabase
      .from("employee_code_aliases")
      .select("employee_id")
      .eq("organization_id", orgId)
      .ilike("alias_code", `%${q}%`)
      .limit(50);
    const { data: aliasHits } = await aliasQuery;
    const aliasIds = [
      ...new Set(
        (aliasHits ?? [])
          .map((row) => row.employee_id as string)
          .filter(Boolean)
      ),
    ];
    const orParts = [
      `last_name.ilike.%${q}%`,
      `first_name.ilike.%${q}%`,
      `employee_code.ilike.%${q}%`,
    ];
    if (aliasIds.length > 0) {
      orParts.push(`id.in.(${aliasIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);

  const enriched = (data ?? []).map((row) => {
    const signals = computeLifecycleSignals({
      status: String(row.status),
      last_payroll_end: (row.last_payroll_end as string | null) ?? null,
      client_latest_payroll_end: clientLatest,
    });
    return { ...row, ...signals };
  });

  return jsonOk({
    data: enriched,
    count,
    limit,
    offset,
    meta: {
      client_latest_payroll_end: clientLatest,
      stale_fallback_days: STALE_FALLBACK_DAYS,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  if (!body.last_name || !body.first_name) {
    return jsonError("last_name and first_name are required", 400);
  }
  if (body.status && typeof body.status === "string" && !isEmployeeStatus(body.status)) {
    return jsonError("Invalid status", 400);
  }

  const clientId =
    typeof body.client_id === "string" && body.client_id.trim()
      ? body.client_id.trim()
      : null;
  if (clientId) {
    const { data: client, error: clientError } = await auth.supabase
      .from("clients")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", clientId)
      .maybeSingle();
    if (clientError) return jsonError(clientError.message, 500);
    if (!client) return jsonError("Client not found in this organization", 400);
  }

  const hireDate =
    typeof body.hire_date === "string" && body.hire_date.trim()
      ? body.hire_date.trim()
      : null;

  let employeeCode =
    typeof body.employee_code === "string" && body.employee_code.trim()
      ? body.employee_code.trim()
      : null;
  let employeeCodeSource: "legacy" | "directory" = "legacy";

  if (!employeeCode) {
    const { data: allocated, error: allocError } = await auth.supabase.rpc(
      "allocate_employee_code",
      {
        p_org: orgId,
        p_hire_date: hireDate ?? new Date().toISOString().slice(0, 10),
      }
    );
    if (allocError) return jsonError(allocError.message, 500);
    if (typeof allocated !== "string" || !allocated) {
      return jsonError("Failed to allocate employee_code", 500);
    }
    employeeCode = allocated;
    employeeCodeSource = "directory";
  }

  const { data, error } = await auth.supabase
    .from("employees")
    .insert({
      organization_id: orgId,
      client_id: clientId,
      branch_id: body.branch_id ?? null,
      position_id: body.position_id ?? null,
      employee_code: employeeCode,
      employee_code_source: employeeCodeSource,
      last_name: body.last_name,
      first_name: body.first_name,
      middle_name: body.middle_name ?? null,
      sex: body.sex ?? null,
      birth_date: body.birth_date ?? null,
      hire_date: hireDate,
      first_hire_date: hireDate,
      status: body.status ?? "active",
      daily_rate: body.daily_rate ?? null,
      billing_daily_rate: body.billing_daily_rate ?? null,
      tin: body.tin ?? null,
      sss_number: body.sss_number ?? null,
      philhealth_number: body.philhealth_number ?? null,
      pagibig_number: body.pagibig_number ?? null,
      email: body.email ?? null,
      mobile: body.mobile ?? null,
      address: body.address ?? null,
      bank_name: body.bank_name ?? null,
      bank_account_no: body.bank_account_no ?? null,
      gcash: body.gcash ?? null,
      is_current_engagement: true,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  await emitDirectoryEvent("employee.upserted", {
    organization_id: orgId,
    employee: data,
  });
  return jsonOk({ data }, 201);
}
