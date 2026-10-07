import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

async function authorize(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return { error: auth } as const;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return { error: orgId } as const;
  const gate = await requireCapability(auth, "fn:admin.system");
  if ("error" in gate) return { error: gate.error } as const;
  return { auth, orgId } as const;
}

export async function GET(request: NextRequest) {
  const access = await authorize(request);
  if ("error" in access) return access.error;
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 25), 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const status = params.get("status")?.trim();
  const clientId = params.get("client_id")?.trim();
  const q = params.get("q")?.trim().replace(/[%_,().]/g, " ");
  let matchingClientIds: string[] | null = null;
  if (q) {
    const { data: matchingClients, error: clientError } =
      await access.auth.supabase
        .from("clients")
        .select("id")
        .eq("organization_id", access.orgId)
        .ilike("name", `%${q}%`)
        .limit(200);
    if (clientError) return jsonError(clientError.message, 500);
    matchingClientIds = (matchingClients ?? []).map((row) => String(row.id));
    if (matchingClientIds.length === 0) {
      return jsonOk({ data: [], count: 0, limit, offset });
    }
  }
  let query = publicDbClient()
    .from("platform_rollout_pilots")
    .select("*", { count: "exact" })
    .eq("organization_id", access.orgId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (matchingClientIds) query = query.in("client_id", matchingClientIds);
  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk({ data: data ?? [], count: count ?? 0, limit, offset });
}

export async function POST(request: NextRequest) {
  const access = await authorize(request);
  if ("error" in access) return access.error;
  const body = (await request.json().catch(() => null)) as {
    client_id?: string;
    branch_id?: string | null;
  } | null;
  const clientId = body?.client_id?.trim();
  if (!clientId) return jsonError("client_id is required", 400);
  const { data, error } = await publicDbClient()
    .from("platform_rollout_pilots")
    .insert({
      organization_id: access.orgId,
      client_id: clientId,
      branch_id: body?.branch_id?.trim() || null,
      created_by: access.auth.userId,
      updated_by: access.auth.userId,
    })
    .select("*")
    .single();
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data }, 201);
}
