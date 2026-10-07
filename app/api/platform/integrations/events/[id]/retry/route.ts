import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { requireCapability } from "@/lib/access/require-capability";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const gate = await requireCapability(auth, "fn:admin.system");
  if ("error" in gate) return gate.error;

  const id = context.params.id?.trim();
  if (!id) return jsonError("Integration event id is required", 400);

  const integration = auth.supabase.schema("public");
  const { data: existing, error: readError } = await integration
    .from("integration_outbox")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (readError) return jsonError(readError.message, 500);
  if (!existing) return jsonError("Integration event not found", 404);
  if (!["failed", "dead"].includes(existing.status)) {
    return jsonError("Only failed or dead events can be retried", 409);
  }

  const { data, error } = await integration
    .from("integration_outbox")
    .update({
      status: "pending",
      attempts: 0,
      available_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["failed", "dead"])
    .select("id,event_id,status,available_at")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk({ data });
}
