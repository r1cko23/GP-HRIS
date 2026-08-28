import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { aggregateOfficeClockIntoCutoff } from "@/lib/timekeeping/aggregate-office-clock";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type Body = {
  replace_existing?: boolean;
};

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = ((await request.json().catch(() => ({}))) ?? {}) as Body;
  const publicDb = publicDbClient();

  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  try {
    const result = await aggregateOfficeClockIntoCutoff(
      publicDb,
      directoryClient(),
      period,
      body.replace_existing ?? false
    );
    return jsonOk({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Aggregation failed";
    return jsonError(message, 400);
  }
}
