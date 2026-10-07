import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgAccessActor = {
  /** null when authenticated via DIRECTORY_SERVICE_API_KEY */
  userId: string | null;
  role: string | null;
  viaServiceKey: boolean;
};

export type OrgAccessResult =
  | { ok: true }
  | { ok: false; error: string; status: 403 | 400 };

/**
 * Hybrid Organization gate (ADR 0008):
 * - service key: any org (caller must still supply organization_id)
 * - admin: any org
 * - everyone else with a People Directory session: active organization_members
 *   (HR family, client editors, position AMs)
 */
export async function assertCanActOnOrg(
  directory: SupabaseClient,
  actor: OrgAccessActor,
  organizationId: string
): Promise<OrgAccessResult> {
  if (!organizationId) {
    return {
      ok: false,
      error: "x-organization-id header (or organization_id query) is required",
      status: 400,
    };
  }

  if (actor.viaServiceKey) {
    return { ok: true };
  }

  if (actor.role === "admin") {
    return { ok: true };
  }

  if (!actor.userId) {
    return { ok: false, error: "Forbidden: authentication required", status: 403 };
  }

  const { data, error } = await directory
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", actor.userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, status: 403 };
  }
  if (!data) {
    return {
      ok: false,
      error:
        "Forbidden: must be a member of this organization (directory.organization_members)",
      status: 403,
    };
  }

  return { ok: true };
}

/** Pure helper for unit tests — decides policy without DB. */
export function orgAccessPolicy(
  actor: OrgAccessActor,
  membershipExists: boolean | null
): OrgAccessResult {
  if (actor.viaServiceKey || actor.role === "admin") return { ok: true };
  if (!actor.userId) {
    return { ok: false, error: "Forbidden: authentication required", status: 403 };
  }
  if (membershipExists !== true) {
    return {
      ok: false,
      error:
        "Forbidden: must be a member of this organization (directory.organization_members)",
      status: 403,
    };
  }
  return { ok: true };
}

/** Admin / service key may list every org; HR family only their memberships. */
export function shouldListAllOrganizations(actor: OrgAccessActor): boolean {
  return actor.viaServiceKey || actor.role === "admin";
}

/** API/UI: never surface the raw membership Forbidden string. */
export function isOrgMembershipDeniedError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /organization_members|must be a member of this organization/i.test(
    message
  );
}

export function peopleOrgMembershipEmptyCopy(surface: "clients" | "employees"): {
  title: string;
  detail: string;
} {
  if (surface === "clients") {
    return {
      title: "This organization is not on your desk",
      detail: "Switch to Deployed · clients, or ask HR to add you to this organization.",
    };
  }
  return {
    title: "This organization is not on your desk",
    detail:
      "People queues here are for another organization. Stay on Deployed · clients for client hires.",
  };
}
