import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { emitDirectoryEvent } from "@/lib/directory/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const status = params.get("status");
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);

  let query = auth.supabase
    .from("clients")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .order("name")
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q}%`);

  const [{ data, error, count }, countsResult] = await Promise.all([
    query,
    auth.supabase.rpc("client_lifecycle_counts", { p_org: orgId }),
  ]);
  if (error) return jsonError(error.message, 500);

  type LifeRow = {
    client_id: string | null;
    active_count: number | string;
    for_release_count: number | string;
    inactive_count: number | string;
    needs_review_count: number | string;
    employee_count: number | string;
    latest_payroll_end: string | null;
  };

  const lifeByClient = new Map<string, LifeRow>();
  if (!countsResult.error) {
    for (const row of (countsResult.data ?? []) as LifeRow[]) {
      if (!row.client_id) continue;
      lifeByClient.set(row.client_id, row);
    }
  } else {
    // Fallback to simple headcount if RPC not yet migrated
    const fallback = await auth.supabase.rpc("client_employee_counts", {
      p_org: orgId,
    });
    if (!fallback.error) {
      for (const row of (fallback.data ?? []) as Array<{
        client_id: string | null;
        employee_count: number | string;
      }>) {
        if (!row.client_id) continue;
        lifeByClient.set(row.client_id, {
          client_id: row.client_id,
          active_count: 0,
          for_release_count: 0,
          inactive_count: 0,
          needs_review_count: 0,
          employee_count: row.employee_count,
          latest_payroll_end: null,
        });
      }
    }
  }

  return jsonOk({
    data: (data ?? []).map((client) => {
      const life = lifeByClient.get(client.id);
      return {
        ...client,
        employee_count: Number(life?.employee_count ?? 0),
        active_count: Number(life?.active_count ?? 0),
        for_release_count: Number(life?.for_release_count ?? 0),
        inactive_count: Number(life?.inactive_count ?? 0),
        needs_review_count: Number(life?.needs_review_count ?? 0),
        latest_payroll_end: life?.latest_payroll_end ?? null,
      };
    }),
    count: count ?? 0,
    limit,
    offset,
  });
}

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return jsonError("name is required", 400);
  }

  const { data, error } = await auth.supabase
    .from("clients")
    .insert({
      organization_id: orgId,
      name: body.name.trim(),
      tin: body.tin ?? null,
      status: body.status ?? "active",
      contact_person: body.contact_person ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      cut1_start: body.cut1_start ?? null,
      cut1_end: body.cut1_end ?? null,
      cut2_start: body.cut2_start ?? null,
      cut2_end: body.cut2_end ?? null,
      pay_frequency: body.pay_frequency ?? null,
      statutory_schedule: body.statutory_schedule ?? null,
      wtax_schedule: body.wtax_schedule ?? null,
      sss_basis: body.sss_basis ?? null,
      philhealth_basis: body.philhealth_basis ?? null,
      wtax_basis: body.wtax_basis ?? null,
      include_cola: body.include_cola ?? false,
      include_sea: body.include_sea ?? false,
      include_ctpa: body.include_ctpa ?? false,
      admin_fee: body.admin_fee ?? null,
      vat: body.vat ?? null,
      ewt: body.ewt ?? null,
      thirteenth_month_year: body.thirteenth_month_year ?? null,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  await emitDirectoryEvent("client.upserted", {
    organization_id: orgId,
    client: data,
  });
  return jsonOk({ data }, 201);
}
