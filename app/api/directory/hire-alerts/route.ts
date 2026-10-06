import { NextRequest } from "next/server";
import { requirePeopleEmployeesPage } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { parseHireAlertName } from "@/lib/directory/hire-alert";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["open", "dismissed", "cleared"]);

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;

  const params = request.nextUrl.searchParams;
  const status = params.get("status")?.trim() || "open";
  const q = params.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 25), 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  if (status !== "all" && !STATUSES.has(status)) {
    return jsonError("Invalid status", 400);
  }

  let query = auth.supabase
    .from("hire_alerts")
    .select(
      "id, person_name, status, created_at, created_by_name, client_id, branch_id, csm_client_id, clients(name), client_branches(name)",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("person_name", `%${q.replace(/[%_]/g, "")}%`);

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk({ data: data ?? [], count: count ?? 0, limit, offset });
}

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  if (!auth.viaServiceKey) return jsonError("Forbidden", 403);
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const personName = parseHireAlertName(textField(body?.person_name));
  const clientId = textField(body?.client_id);
  const branchId = textField(body?.branch_id);
  const csmClientId = textField(body?.csm_client_id);
  if (!personName) return jsonError("A name is required.", 400);
  if (!clientId || !branchId || !csmClientId) {
    return jsonError("Site is required.", 400);
  }

  const { data: branch, error: branchError } = await auth.supabase
    .from("client_branches")
    .select("id, client_id, clients(organization_id)")
    .eq("id", branchId)
    .maybeSingle();
  if (branchError) return jsonError(branchError.message, 500);
  const client = Array.isArray(branch?.clients) ? branch.clients[0] : branch?.clients;
  if (!branch || branch.client_id !== clientId || client?.organization_id !== orgId) {
    return jsonError("This site is not on that employer.", 409);
  }

  const { data, error } = await auth.supabase
    .from("hire_alerts")
    .insert({
      organization_id: orgId,
      client_id: clientId,
      branch_id: branchId,
      csm_client_id: csmClientId,
      person_name: personName,
      created_by_name: textField(body?.created_by_name) || null,
      status: "open",
    })
    .select("id, person_name, status")
    .single();
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data }, 201);
}
