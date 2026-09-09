/**
 * Account Supervisor titles on the office clock roster.
 *
 * Portal schedule access used to require the literal "ACCOUNT SUPERVISOR".
 * Directory/CSM position cards write titles like "As (18,070.00)" onto
 * public.employees.position, so the matcher must accept both.
 */
export function isAccountSupervisorPosition(
  position: string | null | undefined
): boolean {
  const p = (position ?? "").trim().toUpperCase();
  if (!p) return false;
  if (p.includes("ACCOUNT SUPERVISOR")) return true;
  if (p === "AS") return true;
  if (p.startsWith("AS ") || p.startsWith("AS(")) return true;
  return false;
}

export function isClientBasedAccountSupervisor(
  employeeType: string | null | undefined,
  position: string | null | undefined
): boolean {
  return (
    employeeType === "client-based" && isAccountSupervisorPosition(position)
  );
}
