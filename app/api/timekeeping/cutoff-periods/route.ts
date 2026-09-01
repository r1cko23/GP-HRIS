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
  type CreateCutoffPeriodBody,
  type CutoffPeriodStatus,
} from "@/lib/timekeeping/cutoff-types";
import { publicDbClient } from "@/lib/timekeeping/public-db";

const CLIENT_CALENDAR_SELECT =
  "id, name, cut1_start, cut1_end, cut2_start, cut2_end, pay_frequency, statutory_schedule, wtax_schedule";

async function proposeNextCutoff(
  directory: SupabaseClient,
  publicDb: SupabaseClient,
  orgId: string,
  clientId: string
) {
  const { data: client, error } = await directory
    .from("clients")
    .select(CLIENT_CALENDAR_SELECT)
    .eq("id", clientId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!client) return { client: null, next: null };

  const { data: existing, error: existingError } = await publicDb
    .from("cutoff_periods")
    .select("period_start, period_end")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .neq("status", "cancelled");
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
  const status = params.get("status");
  const q = params.get("q")?.trim();
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);

  if (status && !CUTOFF_PERIOD_STATUSES.includes(status as CutoffPeriodStatus)) {
    return jsonError("Invalid status", 400);
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
      "id, organization_id, client_id, period_start, period_end, payroll_date, pay_frequency, source_app, status, legacy_idtimekeep, notes, approved_at, audited_at, created_at, updated_at",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .order("period_start", { ascending: false })
    .range(offset, offset + limit - 1);

  if (clientId) query = query.eq("client_id", clientId);
  if (status) query = query.eq("status", status);
  if (clientIdsForSearch) query = query.in("client_id", clientIdsForSearch);

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);

  let next = null;
  if (clientId) {
    try {
      const proposed = await proposeNextCutoff(
        auth.supabase,
        publicDb,
        orgId,
        clientId
      );
      next = proposed.next;
    } catch (err) {
      return jsonError(
        err instanceof Error ? err.message : "Failed to propose next cutoff",
        500
      );
    }
  }

  return jsonOk({ data, count, limit, offset, next });
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

  const publicDb = publicDbClient();
  const fromCalendar =
    Boolean(body.from_calendar) || !body.period_start || !body.period_end;

  let periodStart = body.period_start?.slice(0, 10) ?? "";
  let periodEnd = body.period_end?.slice(0, 10) ?? "";
  let payrollDate = body.payroll_date ?? null;
  let payFrequency = body.pay_frequency ?? null;
  let notes = body.notes ?? null;

  if (fromCalendar) {
    let proposed;
    try {
      proposed = await proposeNextCutoff(
        auth.supabase,
        publicDb,
        orgId,
        body.client_id
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

  const { data, error } = await publicDb
    .from("cutoff_periods")
    .insert({
      organization_id: orgId,
      client_id: body.client_id,
      period_start: periodStart,
      period_end: periodEnd,
      payroll_date: payrollDate,
      pay_frequency: payFrequency,
      source_app: body.source_app ?? "gp-hris-organic",
      status: body.status ?? "draft",
      legacy_idtimekeep: body.legacy_idtimekeep ?? null,
      notes,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError(
        "Cutoff period already exists for this client and date range",
        409
      );
    }
    return jsonError(error.message, 400);
  }

  return jsonOk({ data }, 201);
}
