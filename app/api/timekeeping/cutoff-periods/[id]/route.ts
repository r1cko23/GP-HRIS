import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import {
  assertCutoffStatus,
  canTransitionCutoffStatus,
  cutoffStatusPatchFields,
} from "@/lib/timekeeping/cutoff-status";
import type { CutoffPeriodStatus } from "@/lib/timekeeping/cutoff-types";
import { hoursRowNeedsAttention } from "@/lib/payroll-register/organic-cutoff-workflow";
import { remittanceFilesThisCutoff } from "@/lib/payroll-register/cutoff-report-pack";
import { statutoryThisCutoff } from "@/lib/ph-payroll/statutory-schedule";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type PatchBody = {
  status?: CutoffPeriodStatus;
  notes?: string | null;
  payroll_date?: string | null;
};

type HoursIssueFilter = "missing_rate" | "zero_hours" | "needs_attention";

function parseHoursIssue(
  value: string | null
): HoursIssueFilter | null {
  if (
    value === "missing_rate" ||
    value === "zero_hours" ||
    value === "needs_attention"
  ) {
    return value;
  }
  return null;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const publicDb = publicDbClient();
  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  const include =
    request.nextUrl.searchParams.get("include")?.split(",") ?? [];
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const hoursIssue = parseHoursIssue(
    request.nextUrl.searchParams.get("hours_issue")
  );
  const hoursLimit = Math.min(
    Number(request.nextUrl.searchParams.get("hours_limit") ?? 50),
    200
  );
  const hoursOffset = Math.max(
    Number(request.nextUrl.searchParams.get("hours_offset") ?? 0),
    0
  );
  const punchesLimit = Math.min(
    Number(request.nextUrl.searchParams.get("punches_limit") ?? 50),
    200
  );
  const punchesOffset = Math.max(
    Number(request.nextUrl.searchParams.get("punches_offset") ?? 0),
    0
  );

  let hours: unknown[] | undefined;
  let punches: unknown[] | undefined;
  let hoursPageCount: number | undefined;
  let punchesPageCount: number | undefined;

  const { data: readinessRows } = await publicDb
    .from("cutoff_hours")
    .select(
      "id, daily_rate_payroll, actual_regular_hours, overtime_hours, night_diff_hours, legal_holiday_hours, special_holiday_hours, rest_day_hours, pto_hours"
    )
    .eq("cutoff_period_id", params.id);

  let missing_rate = 0;
  let zero_hours = 0;
  const missingRateIds: string[] = [];
  const zeroHourIds: string[] = [];
  for (const row of readinessRows ?? []) {
    const flags = hoursRowNeedsAttention(row);
    if (flags.missingRate) {
      missing_rate += 1;
      if (row.id) missingRateIds.push(String(row.id));
    }
    if (flags.zeroHours) {
      zero_hours += 1;
      if (row.id) zeroHourIds.push(String(row.id));
    }
  }

  if (include.includes("hours")) {
    let issueIds: string[] | null = null;
    if (hoursIssue === "missing_rate") issueIds = missingRateIds;
    else if (hoursIssue === "zero_hours") issueIds = zeroHourIds;
    else if (hoursIssue === "needs_attention") {
      issueIds = Array.from(new Set([...missingRateIds, ...zeroHourIds]));
    }

    if (issueIds && issueIds.length === 0) {
      hours = [];
      hoursPageCount = 0;
    } else {
      let hoursQuery = publicDb
        .from("cutoff_hours")
        .select("*", { count: "exact" })
        .eq("cutoff_period_id", params.id)
        .order("last_name")
        .order("first_name")
        .range(hoursOffset, hoursOffset + hoursLimit - 1);
      if (q) {
        hoursQuery = hoursQuery.or(
          `last_name.ilike.%${q}%,first_name.ilike.%${q}%,employee_code.ilike.%${q}%`
        );
      }
      if (issueIds) {
        hoursQuery = hoursQuery.in("id", issueIds);
      }
      const { data, error, count } = await hoursQuery;
      if (error) return jsonError(error.message, 500);
      hours = data ?? [];
      hoursPageCount = count ?? 0;
    }
  }

  if (include.includes("punches")) {
    let punchesQuery = publicDb
      .from("cutoff_dtr_punches")
      .select("*", { count: "exact" })
      .eq("cutoff_period_id", params.id)
      .order("work_date")
      .range(punchesOffset, punchesOffset + punchesLimit - 1);
    if (q) {
      punchesQuery = punchesQuery.ilike("work_date", `%${q}%`);
    }
    const { data, error, count } = await punchesQuery;
    if (error) return jsonError(error.message, 500);
    punches = data ?? [];
    punchesPageCount = count ?? 0;
  }

  const { count: hoursCount } = await publicDb
    .from("cutoff_hours")
    .select("id", { count: "exact", head: true })
    .eq("cutoff_period_id", params.id);

  const { count: punchesCount } = await publicDb
    .from("cutoff_dtr_punches")
    .select("id", { count: "exact", head: true })
    .eq("cutoff_period_id", params.id);

  const directory = directoryClient();
  const { data: clientRow } = await directory
    .from("clients")
    .select(
      "cut1_start, cut1_end, cut2_start, cut2_end, pay_frequency, statutory_schedule, wtax_schedule"
    )
    .eq("id", period.client_id)
    .maybeSingle();
  const statutory = statutoryThisCutoff(
    clientRow ?? {},
    String(period.period_start)
  );

  return jsonOk({
    data: {
      period,
      statutory,
      remittance_files: remittanceFilesThisCutoff(statutory),
      summary: {
        hours_rows: hoursCount ?? 0,
        punch_rows: punchesCount ?? 0,
        missing_rate,
        zero_hours,
      },
      hours,
      punches,
      hours_pagination: include.includes("hours")
        ? {
            count: hoursPageCount ?? 0,
            limit: hoursLimit,
            offset: hoursOffset,
            issue: hoursIssue,
          }
        : undefined,
      punches_pagination: include.includes("punches")
        ? {
            count: punchesPageCount ?? 0,
            limit: punchesLimit,
            offset: punchesOffset,
          }
        : undefined,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as PatchBody;
  const publicDb = publicDbClient();

  const { data: existing, error: loadError } = await publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (loadError) return jsonError(loadError.message, 500);
  if (!existing) return jsonError("Cutoff period not found", 404);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.payroll_date !== undefined) patch.payroll_date = body.payroll_date;

  if (body.status !== undefined) {
    const next = assertCutoffStatus(body.status);
    if (!next) return jsonError("Invalid status", 400);

    const current = assertCutoffStatus(existing.status);
    if (!current) return jsonError("Stored cutoff status is invalid", 500);

    if (
      next !== current &&
      !canTransitionCutoffStatus(current, next)
    ) {
      return jsonError(
        `Cannot transition cutoff from ${current} to ${next}`,
        409
      );
    }

    Object.assign(
      patch,
      cutoffStatusPatchFields(next, auth.userId)
    );
  }

  if (Object.keys(patch).length <= 1) {
    return jsonError("No cutoff fields to update", 400);
  }

  const { data, error } = await publicDb
    .from("cutoff_periods")
    .update(patch)
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return jsonOk({ data });
}
