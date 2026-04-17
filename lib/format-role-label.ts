/** Human-readable labels for `public.users.role` (dashboard / ACL). */
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  head_of_hr: "Head of HR",
  hr_admin: "HR Admin",
  hr_compben: "HR Comp & Benefits",
  approver: "Approver",
  viewer: "Viewer",
  account_manager: "Account manager",
  ot_approver: "OT approver",
  ot_viewer: "OT viewer",
};

export function formatRoleLabel(role: string | null | undefined): string {
  if (role == null || role === "") return "—";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}
