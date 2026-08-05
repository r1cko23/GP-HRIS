import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeClientSlug,
  slugifyClientName,
} from "@/lib/payroll-summary/client-slug";
import type { AuditCompany } from "@/lib/payroll-summary/types";

function toAuditCompany(row: {
  id: string;
  name: string;
  slug: string;
}): AuditCompany {
  return { id: row.id, name: row.name, slug: row.slug };
}

/**
 * Find an active company by slug, or create / reactivate it.
 */
export async function findOrCreateAuditCompany(
  supabase: SupabaseClient,
  name: string,
  preferredSlug?: string
): Promise<{ company: AuditCompany; created: boolean }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error("Client name must be at least 2 characters");
  }

  const slug = preferredSlug?.trim()
    ? normalizeClientSlug(preferredSlug)
    : slugifyClientName(trimmed);

  const { data: existing, error: lookupError } = await supabase
    .from("companies")
    .select("id, name, slug, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    if (!existing.is_active) {
      const { data: reactivated, error: updateError } = await supabase
        .from("companies")
        .update({
          name: trimmed,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id, name, slug")
        .single();
      if (updateError) throw updateError;
      return { company: toAuditCompany(reactivated), created: true };
    }

    return { company: toAuditCompany(existing), created: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("companies")
    .insert({ name: trimmed, slug, is_active: true })
    .select("id, name, slug")
    .single();

  if (insertError) {
    // Race: another request created the same slug
    if ((insertError as { code?: string }).code === "23505") {
      const { data: raced } = await supabase
        .from("companies")
        .select("id, name, slug")
        .eq("slug", slug)
        .single();
      if (raced) return { company: toAuditCompany(raced), created: false };
    }
    throw insertError;
  }

  return { company: toAuditCompany(inserted), created: true };
}
