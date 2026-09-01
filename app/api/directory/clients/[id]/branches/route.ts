import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { normalizeProseTextOrNull } from "@/lib/prose-text";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const status = request.nextUrl.searchParams.get("status");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") ?? 0), 0);

  let query = auth.supabase
    .from("client_branches")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .eq("client_id", params.id)
    .order("name")
    .range(offset, offset + limit - 1);

  if (status === "active") query = query.eq("is_active", true);
  else if (status === "inactive") query = query.eq("is_active", false);
  if (q) {
    query = query.or(`name.ilike.%${q}%,location.ilike.%${q}%`);
  }

  const { data, error, count } = await query;

  if (error) return jsonError(error.message, 500);
  return jsonOk({ data, count, limit, offset });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  if (!body.name || typeof body.name !== "string") {
    return jsonError("name is required", 400);
  }

  const { data, error } = await auth.supabase
    .from("client_branches")
    .insert({
      organization_id: orgId,
      client_id: params.id,
      name: normalizeProseTextOrNull(String(body.name)) ?? String(body.name).trim(),
      location:
        typeof body.location === "string" && body.location.trim()
          ? normalizeProseTextOrNull(body.location)
          : null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return jsonOk({ data }, 201);
}
