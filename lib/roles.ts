/**
 * Dashboard / users.role values stored in public.users.
 * HR family roles share the same DB RLS and default module matrix
 * unless customized per user.
 */
export const HR_FAMILY_ROLES = [
  "head_of_hr",
  "hr_admin",
  "hr_compben",
] as const;

export type HRFamilyRole = (typeof HR_FAMILY_ROLES)[number];

export type DashboardUserRole =
  | "admin"
  | HRFamilyRole
  | "approver"
  | "viewer";

export function isHRFamilyRole(role: string | null | undefined): boolean {
  if (role == null || role === "") return false;
  return (HR_FAMILY_ROLES as readonly string[]).includes(role);
}

/** Admin or any HR-family role (full HR dashboard / RLS bucket). */
export function isAdminOrHRFamily(role: string | null | undefined): boolean {
  return role === "admin" || isHRFamilyRole(role);
}
