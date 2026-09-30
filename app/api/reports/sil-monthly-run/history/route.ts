/**
 * SIL monthly run history for a client.
 * GET ?client_id=&status=&year=&limit=&offset=
 */

import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";
import { isSilRunStatus } from "@/lib/reports/sil-run-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const params = request.nextUrl.searchParams;
  const clientId = params.get("client_id")?.trim() || null;
  const status = params.get("status")?.trim().toLowerCase() || "";
  const year = params.get("year") ? Number(params.get("year")) : null;
  const limit = Math.min(
    Math.max(Number(params.get("limit") ?? 50) || 50, 1),
    200
  );
  const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);

  if (!clientId) return jsonError("client_id is required", 400);
  if (status && status !== "all" && !isSilRunStatus(status)) {
    return jsonError(
      "Invalid status. Use draft, approved, posted, void, or all",
      400
    );
  }
  if (year != null && (!Number.isFinite(year) || year < 2000 || year > 2100)) {
    return jsonError("Invalid year", 400);
  }

  const directory = directoryClient();
  const { data: client, error: clientError } = await directory
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found", 404);

  const publicDb = publicDbClient();
  let query = publicDb
    .from("sil_monthly_runs")
    .select(
      "id, year, month, status, line_count, totals, built_at, approved_at, posted_at, voided_at, created_at",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") query = query.eq("status", status);
  if (year != null) query = query.eq("year", year);

  const { data, error, count } = await query;
  if (error) return jsonError(error.message, 500);

  return jsonOk({
    data: data ?? [],
    count: count ?? 0,
    limit,
    offset,
    client_name: String(client.name ?? "").trim(),
  });
}
