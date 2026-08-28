import type { SupabaseClient } from "@supabase/supabase-js";

/** Organic (GP house) helpers for cutoff / payroll E2E. */

export type OrganicClient = {
  id: string;
  name: string;
  organization_id: string;
};

export async function resolveOrganicOrganization(
  directory: SupabaseClient
): Promise<{ id: string; name: string }> {
  const { data, error } = await directory
    .from("organizations")
    .select("id, name");
  if (error) throw new Error(error.message);
  const org = (data ?? []).find((row) =>
    /organic/i.test(String((row as { name?: string }).name ?? ""))
  ) as { id: string; name: string } | undefined;
  if (!org) throw new Error("Organic organization not found in Directory");
  return org;
}

export async function resolveOrganicHouseClient(
  directory: SupabaseClient,
  organizationId: string
): Promise<OrganicClient> {
  const { data, error } = await directory
    .from("clients")
    .select("id, name, organization_id")
    .eq("organization_id", organizationId)
    .order("name")
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OrganicClient[];
  const preferred =
    rows.find((row) => /green pasture people/i.test(row.name)) ??
    rows.find((row) => /green pasture/i.test(row.name)) ??
    rows[0];
  if (!preferred) {
    throw new Error("No Organic house client found under Organic organization");
  }
  return preferred;
}
