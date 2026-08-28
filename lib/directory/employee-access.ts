import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/directory/auth";

export type DirectoryEmployeeRef = {
  id: string;
  organization_id: string;
  client_id: string | null;
};

/** Load employee in org (optional client_id match). Returns 404 NextResponse on miss. */
export async function requireDirectoryEmployee(
  supabase: SupabaseClient,
  organizationId: string,
  employeeId: string,
  clientId?: string | null
): Promise<DirectoryEmployeeRef | NextResponse> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, organization_id, client_id")
    .eq("organization_id", organizationId)
    .eq("id", employeeId)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Employee not found", 404);
  if (clientId && data.client_id !== clientId) {
    return jsonError("Employee is not in this client view", 404);
  }
  return data as DirectoryEmployeeRef;
}

export function isEmployeeRef(
  value: DirectoryEmployeeRef | NextResponse
): value is DirectoryEmployeeRef {
  return !(value instanceof NextResponse);
}
