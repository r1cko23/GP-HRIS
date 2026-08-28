import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { pickClientPatch } from "@/lib/directory/client-form";
import { emitDirectoryEvent } from "@/lib/directory/events";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const { data, error } = await auth.supabase
    .from("clients")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Client not found", 404);
  return jsonOk({ data });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const patch = pickClientPatch(body);
  if (Object.keys(patch).length === 0) {
    return jsonError("No updatable client fields provided", 400);
  }
  if (typeof patch.name === "string" && !patch.name.trim()) {
    return jsonError("name cannot be empty", 400);
  }

  const { data, error } = await auth.supabase
    .from("clients")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Client not found", 404);
  await emitDirectoryEvent("client.upserted", {
    organization_id: orgId,
    client: data,
  });
  return jsonOk({ data });
}
