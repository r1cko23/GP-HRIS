import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  CUTOFF_PERIOD_STATUSES,
  type CreateCutoffPeriodBody,
  type CutoffPeriodStatus,
} from "@/lib/timekeeping/cutoff-types";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
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

  return jsonOk({ data, count, limit, offset });
}

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as CreateCutoffPeriodBody;
  if (!body.client_id || !body.period_start || !body.period_end) {
    return jsonError("client_id, period_start, and period_end are required", 400);
  }

  if (body.status && !CUTOFF_PERIOD_STATUSES.includes(body.status)) {
    return jsonError("Invalid status", 400);
  }

  const { data: client, error: clientError } = await auth.supabase
    .from("clients")
    .select("id, organization_id")
    .eq("id", body.client_id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found in organization", 404);

  const publicDb = publicDbClient();
  const { data, error } = await publicDb
    .from("cutoff_periods")
    .insert({
      organization_id: orgId,
      client_id: body.client_id,
      period_start: body.period_start,
      period_end: body.period_end,
      payroll_date: body.payroll_date ?? null,
      pay_frequency: body.pay_frequency ?? null,
      source_app: body.source_app ?? "gp-hris-organic",
      status: body.status ?? "draft",
      legacy_idtimekeep: body.legacy_idtimekeep ?? null,
      notes: body.notes ?? null,
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
