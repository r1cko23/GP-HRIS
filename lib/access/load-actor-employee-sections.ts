/**
 * Load People 201 section access for a directory API actor.
 */

import { createClient } from "@supabase/supabase-js";
import type { DirectoryAuth } from "@/lib/directory/auth";
import {
  parseEmployeeSectionsOverride,
  resolveEmployeeSectionAccess,
  type EmployeeSectionMap,
} from "@/lib/access/employee-sections";

function publicServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env for grant lookup");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ActorEmployeeSectionAccess = {
  sections: EmployeeSectionMap;
  salary: boolean;
};

export async function loadActorEmployeeSectionAccess(
  auth: DirectoryAuth
): Promise<ActorEmployeeSectionAccess> {
  if (auth.viaServiceKey || auth.role === "admin") {
    return resolveEmployeeSectionAccess({
      employeesRead: true,
      fullAccess: true,
    });
  }

  if (!auth.userId) {
    return resolveEmployeeSectionAccess({ employeesRead: false });
  }

  const db = publicServiceClient();
  const [{ data: grantRows }, { data: userRow }] = await Promise.all([
    db
      .from("hris_user_grants")
      .select("capability_key")
      .eq("user_id", auth.userId),
    db
      .from("users")
      .select("permissions, can_access_salary, role")
      .eq("id", auth.userId)
      .maybeSingle(),
  ]);

  const capabilityKeys = (grantRows ?? []).map(
    (row: { capability_key: string }) => row.capability_key
  );
  const employeesRead =
    capabilityKeys.includes("page:employees") ||
    Boolean(
      (userRow?.permissions as Record<string, { read?: boolean }> | null)
        ?.employees?.read
    );
  const override = parseEmployeeSectionsOverride(userRow?.permissions);
  const access = resolveEmployeeSectionAccess({
    employeesRead,
    capabilityKeys,
    sectionsOverride: override,
    fullAccess: userRow?.role === "admin",
  });

  // Salary flag on profile still wins when grants are sparse.
  if (userRow?.can_access_salary) {
    return { ...access, salary: true };
  }
  return access;
}
