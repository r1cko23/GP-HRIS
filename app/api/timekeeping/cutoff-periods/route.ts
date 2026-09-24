import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  nextCutoffFromCalendar,
  todayYmdManila,
  type ClientPayCalendar,
} from "@/lib/directory/client-pay-calendar";
import {
  CUTOFF_PERIOD_STATUSES,
  cutoffCreateRequiresBranch,
  cutoffSourceAppForOrganizationName,
  type CreateCutoffPeriodBody,
  type CutoffPeriodStatus,
} from "@/lib/timekeeping/cutoff-types";
import {
  isCutoffPeriodKind,
  parseCutoffPeriodKind,
} from "@/lib/timekeeping/cutoff-period-kind";
import {
  attachCutoffPeriodBranchIds,
  cutoffPeriodIdsCoveringBranch,
  findConflictingSiteClaims,
  insertCutoffPeriodSites,
  loadExistingSiteClaimsForDates,
  normalizeCutoffBranchIds,
  periodBranchIdForInsert,
  siteCoverageConflictMessage,
} from "@/lib/timekeeping/cutoff-period-sites";
import {
  attachCutoffRunBy,
  loadCutoffRunBySources,
} from "@/lib/payroll-register/cutoff-run-by";
import { publicDbClient } from "@/lib/timekeeping/public-db";

const CLIENT_CALENDAR_SELECT =
  "id, name, cut1_start, cut1_end, cut2_start, cut2_end, pay_frequency, statutory_schedule, wtax_schedule";

async function proposeNextCutoff(
  directory: SupabaseClient,
  publicDb: SupabaseClient,
  orgId: string,
  clientId: string,
  branchId?: string | null
) {
  const { data: client, error } = await directory
    .from("clients")
    .select(CLIENT_CALENDAR_SELECT)
    .eq("id", clientId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!client) return { client: null, next: null };

  let existingQuery = publicDb
    .from("cutoff_periods")
    .select("period_start, period_end")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .eq("period_kind", "regular")
    .neq("status", "cancelled");
  existingQuery = branchId
    ? existingQuery.eq("branch_id", branchId)
    : existingQuery.is("branch_id", null);
  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) throw new Error(existingError.message);

  const next = nextCutoffFromCalendar(
    client as ClientPayCalendar,
    existing ?? [],
    todayYmdManila()
  );
  return { client, next };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const clientId = params.get("client_id");
  const branchId = params.get("branch_id");
  const status = params.get("status");
  const periodKind = params.get("period_kind");
  const sourceCutoffId = params.get("source_cutoff_period_id");
  const q = params.get("q")?.trim();
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);

  if (status && !CUTOFF_PERIOD_STATUSES.includes(status as CutoffPeriodStatus)) {
    return jsonError("Invalid status", 400);
  }
  if (periodKind && !isCutoffPeriodKind(periodKind)) {
    return jsonError("Invalid period_kind", 400);
  }

  let clientIdsForSearch: string[] | null = null;
  if (q) {
    const { data: clients, error: clientSearchError } = await auth.supabase
      .from("clients")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", `%${q}%`);
    if (clientSearchError) return jsonError(clientSearchError.message, 500);
    clientIdsForSearch = (clients ?? []).map((row) => row.id as string);
    if (!clientIdsForSearch.length) {
      return jsonOk({ data: [], count: 0, limit, offset });
    }
  }

  const publicDb = publicDbClient();
  let query = publicDb
    .from("cutoff_periods")
    .select(
      "id, organization_id, client_id, branch_id, period_start, period_end, payroll_date, pay_frequency, source_app, status, period_kind, source_cutoff_period_id, legacy_idtimekeep, notes, approved_at, audited_at, created_at, updated_at",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .order("period_start", { ascending: false })
    .range(offset, offset + limit - 1);

  if (clientId) query = query.eq("client_id", clientId);
  if (branchId) {
    const covered = await cutoffPeriodIdsCoveringBranch(
      publicDb,
      orgId,
      branchId
    );
    if (covered.error) return jsonError(covered.error, 500);
    if (!covered.ids.length) {
      return jsonOk({ data: [], count: 0, limit, offset, next: null });
    }
    query = query.in("id", covered.ids);
  }
  if (status) query = query.eq("status", status);
  if (periodKind) query = query.eq("period_kind", periodKind);
  if (sourceCutoffId) {
    query = query.eq("source_cutoff_period_id", sourceCutoffId);
  }
  const periodStart = params.get("period_start")?.slice(0, 10);
  const periodEnd = params.get("period_end")?.slice(0, 10);
  if (periodStart) query = query.eq("period_start", periodStart);
  if (periodEnd) query = query.eq("period_end", periodEnd);
  if (clientIdsForSearch) query = query.in("client_id", clientIdsForSearch);

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);

  let rows = data ?? [];
  try {
    const { runs, users } = await loadCutoffRunBySources(
      publicDb,
      rows.map((row) => row.id as string)
    );
    rows = attachCutoffRunBy(rows, runs, users);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to load who ran payroll",
      500
    );
  }

  const withSites = await attachCutoffPeriodBranchIds(publicDb, rows);
  if (withSites.error) return jsonError(withSites.error, 500);
  rows = withSites.rows;

  let next = null;
  if (clientId) {
    try {
      const proposed = await proposeNextCutoff(
        auth.supabase,
        publicDb,
        orgId,
        clientId,
        branchId
      );
      next = proposed.next;
    } catch (err) {
      return jsonError(
        err instanceof Error ? err.message : "Failed to propose next cutoff",
        500
      );
    }
  }

  return jsonOk({ data: rows, count, limit, offset, next });
}

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as CreateCutoffPeriodBody;
  if (!body.client_id) {
    return jsonError("client_id is required", 400);
  }

  if (body.status && !CUTOFF_PERIOD_STATUSES.includes(body.status)) {
    return jsonError("Invalid status", 400);
  }

  const branchIds = normalizeCutoffBranchIds({
    branch_id: body.branch_id,
    branch_ids: body.branch_ids,
  });

  const { data: orgRow, error: orgError } = await auth.supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError) return jsonError(orgError.message, 500);
  const orgName = (orgRow as { name?: string } | null)?.name ?? null;
  if (cutoffCreateRequiresBranch(orgName) && branchIds.length === 0) {
    return jsonError("Select at least one site for Deployed cutoffs", 400);
  }

  const publicDb = publicDbClient();
  const fromCalendar =
    Boolean(body.from_calendar) || !body.period_start || !body.period_end;

  let periodStart = body.period_start?.slice(0, 10) ?? "";
  let periodEnd = body.period_end?.slice(0, 10) ?? "";
  let payrollDate = body.payroll_date ?? null;
  let payFrequency = body.pay_frequency ?? null;
  let notes = body.notes ?? null;

  const calendarBranchId =
    branchIds.length === 1 ? branchIds[0]! : branchIds[0] ?? null;

  if (fromCalendar) {
    let proposed;
    try {
      proposed = await proposeNextCutoff(
        auth.supabase,
        publicDb,
        orgId,
        body.client_id,
        calendarBranchId
      );
    } catch (err) {
      return jsonError(
        err instanceof Error ? err.message : "Failed to read client calendar",
        500
      );
    }
    if (!proposed.client) {
      return jsonError("Client not found in organization", 404);
    }
    if (!proposed.next) {
      return jsonError(
        "Client pay calendar has no next cutoff window",
        400
      );
    }
    periodStart = proposed.next.period_start;
    periodEnd = proposed.next.period_end;
    payrollDate = body.payroll_date || proposed.next.payroll_date;
    payFrequency = body.pay_frequency || proposed.next.pay_frequency;
    notes =
      notes ||
      `Opened from client pay calendar · ${proposed.next.window} window`;
  } else {
    const { data: client, error: clientError } = await auth.supabase
      .from("clients")
      .select("id")
      .eq("id", body.client_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (clientError) return jsonError(clientError.message, 500);
    if (!client) return jsonError("Client not found in organization", 404);
  }

  if (!periodStart || !periodEnd) {
    return jsonError("period_start and period_end are required", 400);
  }
  if (periodEnd < periodStart) {
    return jsonError("period_end must be on or after period_start", 400);
  }

  if (branchIds.length) {
    const { data: branches, error: branchError } = await auth.supabase
      .from("client_branches")
      .select("id, client_id")
      .eq("organization_id", orgId)
      .eq("client_id", body.client_id)
      .in("id", branchIds);
    if (branchError) return jsonError(branchError.message, 500);
    const found = new Set((branches ?? []).map((row) => row.id as string));
    const missing = branchIds.filter((id) => !found.has(id));
    if (missing.length) {
      return jsonError("Branch not found for this client", 400);
    }
  }

  const periodKind = parseCutoffPeriodKind(body.period_kind);
  let sourceCutoffPeriodId: string | null = null;
  if (periodKind === "adjustment") {
    const sourceId = body.source_cutoff_period_id?.trim();
    if (!sourceId) {
      return jsonError(
        "source_cutoff_period_id is required for adjustment cutoffs",
        400
      );
    }
    const { data: source, error: sourceError } = await publicDb
      .from("cutoff_periods")
      .select("id, client_id, status, period_kind")
      .eq("id", sourceId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (sourceError) return jsonError(sourceError.message, 500);
    if (!source) return jsonError("Source cutoff not found", 404);
    if (source.client_id !== body.client_id) {
      return jsonError("Source cutoff must belong to the same client", 400);
    }
    if (source.status !== "posted") {
      return jsonError("Source cutoff must be posted", 409);
    }
    if (parseCutoffPeriodKind(source.period_kind) === "adjustment") {
      return jsonError("Source cutoff must be a regular period", 400);
    }
    sourceCutoffPeriodId = source.id as string;
  }

  if (periodKind === "regular" && branchIds.length) {
    const { claims, error: claimsError } = await loadExistingSiteClaimsForDates(
      publicDb,
      {
        organizationId: orgId,
        clientId: body.client_id,
        periodStart,
        periodEnd,
      }
    );
    if (claimsError) return jsonError(claimsError, 500);
    const conflicts = findConflictingSiteClaims(branchIds, claims);
    if (conflicts.length) {
      return jsonError(siteCoverageConflictMessage(conflicts), 409);
    }
  }

  const periodBranchId = periodBranchIdForInsert(branchIds);

  const { data, error } = await publicDb
    .from("cutoff_periods")
    .insert({
      organization_id: orgId,
      client_id: body.client_id,
      branch_id: periodBranchId,
      period_start: periodStart,
      period_end: periodEnd,
      payroll_date: payrollDate,
      pay_frequency: payFrequency,
      source_app:
        body.source_app ?? cutoffSourceAppForOrganizationName(orgName),
      status: body.status ?? "draft",
      period_kind: periodKind,
      source_cutoff_period_id: sourceCutoffPeriodId,
      legacy_idtimekeep: body.legacy_idtimekeep ?? null,
      notes,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError(
        periodKind === "adjustment"
          ? "Adjustment cutoff already exists for this client and date range"
          : "Cutoff period already exists for this client, site, and date range",
        409
      );
    }
    return jsonError(error.message, 400);
  }

  if (branchIds.length) {
    const siteInsert = await insertCutoffPeriodSites(
      publicDb,
      data.id as string,
      branchIds
    );
    if (siteInsert.error) {
      await publicDb.from("cutoff_periods").delete().eq("id", data.id);
      return jsonError(siteInsert.error, 400);
    }
  }

  const withSites = await attachCutoffPeriodBranchIds(publicDb, [data]);
  if (withSites.error) return jsonError(withSites.error, 500);

  return jsonOk({ data: withSites.rows[0] ?? { ...data, branch_ids: branchIds } }, 201);
}
