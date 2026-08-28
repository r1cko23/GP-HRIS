import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";

export type DirectoryAuth = {
  supabase: SupabaseClient;
  organizationId: string | null;
  userId: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function directoryClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  ).schema("directory");
}

export async function resolveDirectoryAuth(
  request: NextRequest
): Promise<DirectoryAuth | NextResponse> {
  const serviceKey = process.env.DIRECTORY_SERVICE_API_KEY;
  const headerKey = request.headers.get("x-directory-api-key");
  const organizationId =
    request.headers.get("x-organization-id") ||
    request.nextUrl.searchParams.get("organization_id");

  if (serviceKey && headerKey && headerKey === serviceKey) {
    return { supabase: directoryClient(), organizationId, userId: null };
  }

  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json(
      { error: "Forbidden: Admin/HR access required" },
      { status: 403 }
    );
  }

  return {
    supabase: directoryClient(),
    organizationId,
    userId: session.userId,
  };
}

export function requireOrganizationId(
  auth: DirectoryAuth
): string | NextResponse {
  if (!auth.organizationId) {
    return NextResponse.json(
      {
        error:
          "x-organization-id header (or organization_id query) is required",
      },
      { status: 400 }
    );
  }
  return auth.organizationId;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function isAuthResponse(
  value: DirectoryAuth | NextResponse
): value is NextResponse {
  return value instanceof NextResponse;
}
