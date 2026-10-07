import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { shouldListAllOrganizations } from "@/lib/directory/org-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;

  const actor = {
    userId: auth.userId,
    role: auth.role,
    viaServiceKey: auth.viaServiceKey,
  };

  if (shouldListAllOrganizations(actor)) {
    const { data, error } = await auth.supabase
      .from("organizations")
      .select("*")
      .order("name");
    if (error) return jsonError(error.message, 500);
    return jsonOk({ data });
  }

  if (!auth.userId) {
    return jsonError("Forbidden: authentication required", 403);
  }

  const { data: memberships, error: memErr } = await auth.supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", auth.userId)
    .eq("is_active", true);

  if (memErr) return jsonError(memErr.message, 500);

  const orgIds = (memberships ?? [])
    .map((m) => m.organization_id as string)
    .filter(Boolean);

  if (orgIds.length === 0) {
    return jsonOk({ data: [] });
  }

  const { data, error } = await auth.supabase
    .from("organizations")
    .select("*")
    .in("id", orgIds)
    .order("name");

  if (error) return jsonError(error.message, 500);
  return jsonOk({ data });
}
