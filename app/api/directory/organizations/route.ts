import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;

  const { data, error } = await auth.supabase
    .from("organizations")
    .select("*")
    .order("name");

  if (error) return jsonError(error.message, 500);
  return jsonOk({ data });
}
