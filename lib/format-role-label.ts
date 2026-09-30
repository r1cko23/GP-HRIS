/** Human-readable labels for `public.users.role` (dashboard / ACL). Sentence case. */
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  head_of_accounting: "Head of accounting",
  head_of_hr: "Head of HR",
  hr_admin: "HR admin",
  hr_compben: "HR comp & benefits",
  approver: "Approver",
  viewer: "Viewer",
  employee: "Employee",
  account_manager: "Account manager",
  ot_approver: "OT approver",
  ot_viewer: "OT viewer",
};

/** First word capital, rest lower, with HR and OT kept as abbreviations. */
function sentenceCaseRole(value: string): string {
  const spaced = value.replaceAll("_", " ").trim();
  if (!spaced) return value;
  const sentence =
    spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  return sentence.replace(/\bhr\b/g, "HR").replace(/\bot\b/g, "OT");
}

export function formatRoleLabel(role: string | null | undefined): string {
  if (role == null || role === "") return "—";
  return ROLE_LABELS[role] ?? sentenceCaseRole(role);
}
