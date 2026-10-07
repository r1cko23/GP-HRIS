import { NextRequest } from "next/server";
import { actorHasCapability } from "@/lib/access/load-actor-capabilities";
import { requirePeopleTalentPage } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";

export const dynamic = "force-dynamic";

async function authorize(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return { error: auth } as const;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return { error: orgId } as const;
  const gate = await requirePeopleTalentPage(auth);
  if ("error" in gate) return { error: gate.error } as const;
  return { auth, orgId, capabilities: gate.capabilityKeys } as const;
}

export async function GET(request: NextRequest) {
  const access = await authorize(request);
  if ("error" in access) return access.error;
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 25), 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const q = params.get("q")?.trim();
  const active = params.get("active");

  let query = access.auth.supabase
    .from("packet_templates")
    .select(
      "id,code,name,description,version,is_active,created_at,updated_at,tasks:packet_template_tasks(id,task_key,title,description,sort_order,is_required,default_owner_type,due_days)",
      { count: "exact" }
    )
    .eq("organization_id", access.orgId)
    .order("name")
    .range(offset, offset + limit - 1);
  if (active === "true" || active === "false") {
    query = query.eq("is_active", active === "true");
  }
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ");
    query = query.or(`code.ilike.%${safe}%,name.ilike.%${safe}%`);
  }
  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk({ data: data ?? [], count: count ?? 0, limit, offset });
}

export async function POST(request: NextRequest) {
  const access = await authorize(request);
  if ("error" in access) return access.error;
  if (!actorHasCapability(access.capabilities, "fn:employees.create")) {
    return jsonError("Forbidden: missing grant fn:employees.create", 403);
  }
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    name?: string;
    description?: string;
    tasks?: unknown[];
  } | null;
  const code = body?.code?.trim() ?? "";
  const name = body?.name?.trim() ?? "";
  if (!code || !name || !Array.isArray(body?.tasks) || body.tasks.length === 0) {
    return jsonError("code, name, and at least one task are required", 400);
  }
  const { data, error } = await access.auth.supabase.rpc(
    "create_packet_template",
    {
      p_organization_id: access.orgId,
      p_code: code,
      p_name: name,
      p_description: body.description?.trim() ?? "",
      p_tasks: body.tasks,
    }
  );
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data: { id: data } }, 201);
}
