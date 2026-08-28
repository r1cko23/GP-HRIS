import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import {
  assertCutoffStatus,
  canTransitionCutoffStatus,
  cutoffStatusPatchFields,
} from "@/lib/timekeeping/cutoff-status";
import type { CutoffPeriodStatus } from "@/lib/timekeeping/cutoff-types";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type PatchBody = {
  status?: CutoffPeriodStatus;
  notes?: string | null;
  payroll_date?: string | null;
};

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
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

  if (include.includes("hours")) {
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
    const { data, error, count } = await hoursQuery;
    if (error) return jsonError(error.message, 500);
    hours = data ?? [];
    hoursPageCount = count ?? 0;
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

  return jsonOk({
    data: {
      period,
      summary: {
        hours_rows: hoursCount ?? 0,
        punch_rows: punchesCount ?? 0,
      },
      hours,
      punches,
      hours_pagination: include.includes("hours")
        ? { count: hoursPageCount ?? 0, limit: hoursLimit, offset: hoursOffset }
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
  const orgId = requireOrganizationId(auth);
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
