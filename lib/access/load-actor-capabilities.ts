/**
 * Load hris_user_grants capability keys for a Directory API actor.
 */

import { createClient } from "@supabase/supabase-js";
import type { DirectoryAuth } from "@/lib/directory/auth";

function publicServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env for grant lookup");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadActorCapabilityKeys(
  auth: DirectoryAuth
): Promise<string[]> {
  if (auth.viaServiceKey) {
    return [
      "fn:admin.system",
      "page:employees",
      "page:people.clients",
      "page:people.employees",
    ];
  }
  if (!auth.userId) return [];

  const db = publicServiceClient();
  const { data: grantRows } = await db
    .from("hris_user_grants")
    .select("capability_key")
    .eq("user_id", auth.userId);

  return (grantRows ?? []).map(
    (row: { capability_key: string }) => row.capability_key
  );
}

export function actorHasCapability(
  capabilityKeys: Iterable<string>,
  key: string
): boolean {
  const keys = new Set(
    Array.from(capabilityKeys)
      .map((k) => k.trim())
      .filter(Boolean)
  );
  if (keys.has("fn:admin.system")) return true;
  return keys.has(key);
}
