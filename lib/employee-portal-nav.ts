/** Pages reached via mobile "More" menu (not in the 4 primary bottom tabs). */
export const EMPLOYEE_PORTAL_MORE_PATHS = [
  "/employee-portal/failure-to-log",
  "/employee-portal/payslips",
  "/employee-portal/info",
  "/employee-portal/devices",
  "/employee-portal/schedule",
] as const;

export const EMPLOYEE_PORTAL_BUNDY_HREF = "/employee-portal/bundy";

/**
 * Mapped PIN → biometric terminal. GPS bundy is disabled (migration 245;
 * portal cutover deferred from 244).
 */
export function shouldShowEmployeePortalBundy(
  biometricMapped: boolean
): boolean {
  return !biometricMapped;
}

export function filterEmployeePortalNavItems<T extends { href: string }>(
  items: T[],
  opts: { biometricMapped: boolean }
): T[] {
  if (shouldShowEmployeePortalBundy(opts.biometricMapped)) return items;
  return items.filter((item) => item.href !== EMPLOYEE_PORTAL_BUNDY_HREF);
}

export function isEmployeePortalNavActive(
  pathname: string | null,
  href: string
): boolean {
  if (!pathname) return false;
  if (href === "/employee-portal") {
    return pathname === "/employee-portal";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isEmployeePortalMoreNavActive(
  pathname: string | null
): boolean {
  if (!pathname) return false;
  return EMPLOYEE_PORTAL_MORE_PATHS.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}
