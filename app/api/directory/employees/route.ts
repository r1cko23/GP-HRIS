import { NextRequest } from "next/server";
import {
  engagementDepsFromAuth,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { engagementHire } from "@/lib/directory/engagement";
import { isEmployeeStatus } from "@/lib/directory/employees";
import {
  STALE_FALLBACK_DAYS,
  computeLifecycleSignals,
} from "@/lib/directory/lifecycle";
import { normalizeProseTextOrNull } from "@/lib/prose-text";
import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";

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
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const lifecycle = params.get("lifecycle")?.trim() || null;
  const q = params.get("q")?.trim();
  const clientId = params.get("client_id");
  const statutoryFilter = params.get("statutory_filter")?.trim() || null;
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
      "id, employee_code, last_name, first_name, middle_name, status, mobile, hire_date, first_hire_date, last_payroll_end, resign_date, client_id, is_current_engagement, superseded_by, tin, sss_number, philhealth_number, pagibig_number, position:positions(job_title, department), branch:client_branches(name, location)",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .order("last_name")
    .range(offset, offset + limit - 1);

  if (!includeHistory) {
    query = query.eq("is_current_engagement", true);
  }
  if (clientId) query = query.eq("client_id", clientId);

  if (statutoryFilter === "missing") {
    query = query.or(
      "tin.is.null,sss_number.is.null,philhealth_number.is.null,pagibig_number.is.null,tin.eq.,sss_number.eq.,philhealth_number.eq.,pagibig_number.eq."
    );
  } else if (statutoryFilter === "complete") {
    query = query
      .not("tin", "is", null)
      .not("sss_number", "is", null)
      .not("philhealth_number", "is", null)
      .not("pagibig_number", "is", null)
      .neq("tin", "")
      .neq("sss_number", "")
      .neq("philhealth_number", "")
      .neq("pagibig_number", "");
  }

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
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const result = await engagementHire(engagementDepsFromAuth(auth, orgId), {
    last_name: normalizeProseTextOrNull(String(body.last_name ?? "")) ?? "",
    first_name: normalizeProseTextOrNull(String(body.first_name ?? "")) ?? "",
    middle_name:
      typeof body.middle_name === "string"
        ? normalizeProseTextOrNull(body.middle_name)
        : null,
    client_id: typeof body.client_id === "string" ? body.client_id : null,
    branch_id: typeof body.branch_id === "string" ? body.branch_id : null,
    position_id:
      typeof body.position_id === "string" ? body.position_id : null,
    employee_code:
      typeof body.employee_code === "string" ? body.employee_code : null,
    hire_date: typeof body.hire_date === "string" ? body.hire_date : null,
    status: typeof body.status === "string" ? body.status : undefined,
    daily_rate:
      body.daily_rate != null && body.daily_rate !== ""
        ? roundDailyRate4(Number(body.daily_rate))
        : null,
    billing_daily_rate:
      body.billing_daily_rate != null && body.billing_daily_rate !== ""
        ? roundDailyRate4(Number(body.billing_daily_rate))
        : null,
    sex: typeof body.sex === "string" ? body.sex : null,
    birth_date: typeof body.birth_date === "string" ? body.birth_date : null,
    tin: typeof body.tin === "string" ? body.tin : null,
    sss_number: typeof body.sss_number === "string" ? body.sss_number : null,
    philhealth_number:
      typeof body.philhealth_number === "string"
        ? body.philhealth_number
        : null,
    pagibig_number:
      typeof body.pagibig_number === "string" ? body.pagibig_number : null,
    email: typeof body.email === "string" ? body.email : null,
    mobile: typeof body.mobile === "string" ? body.mobile : null,
    address:
      typeof body.address === "string"
        ? normalizeProseTextOrNull(body.address)
        : null,
    bank_name:
      typeof body.bank_name === "string"
        ? normalizeProseTextOrNull(body.bank_name)
        : null,
    bank_account_no:
      typeof body.bank_account_no === "string" ? body.bank_account_no : null,
    gcash: typeof body.gcash === "string" ? body.gcash : null,
  });
  if (!result.ok) return jsonError(result.error, result.status);
  return jsonOk({ data: result.data, enrollment: result.enrollment }, 201);
}
