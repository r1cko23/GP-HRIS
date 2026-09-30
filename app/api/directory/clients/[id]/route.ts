import { NextRequest } from "next/server";
import {
  requireCapability,
  requirePeopleClientsOrEmployeesPage,
} from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { pickClientPatch } from "@/lib/directory/client-form";
import { emitDirectoryEvent } from "@/lib/directory/events";
import { normalizeProseTextOrNull } from "@/lib/prose-text";
import { parseBillingOutputPack } from "@/lib/client-billing/output-pack";
import { parseClientIndustry } from "@/lib/directory/position-approval";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleClientsOrEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;

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
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const gate = await requireCapability(auth, "fn:clients.update");
  if ("error" in gate) return gate.error;

  const body = (await request.json()) as Record<string, unknown>;
  const patch = pickClientPatch(body);
  if (typeof patch.name === "string") {
    patch.name = normalizeProseTextOrNull(patch.name) ?? patch.name.trim();
  }
  if (typeof patch.contact_person === "string") {
    patch.contact_person = normalizeProseTextOrNull(patch.contact_person);
  }
  if (typeof patch.address === "string") {
    patch.address = normalizeProseTextOrNull(patch.address);
  }
  for (const key of [
    "statutory_schedule",
    "wtax_schedule",
    "sss_basis",
    "philhealth_basis",
    "wtax_basis",
  ] as const) {
    if (typeof patch[key] === "string") {
      patch[key] = normalizeProseTextOrNull(patch[key] as string);
    }
  }
  if ("billing_output_pack" in patch) {
    patch.billing_output_pack = parseBillingOutputPack(patch.billing_output_pack);
  }
  if ("industry" in patch) {
    const industry = parseClientIndustry(patch.industry);
    if (!industry) {
      return jsonError('industry must be "HOTEL" or "NON-HOTEL"', 400);
    }
    patch.industry = industry;
  }
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
