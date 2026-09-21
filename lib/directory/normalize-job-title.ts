/**
 * Job titles must name the role. Rates live on the position card
 * (payroll_daily_rate). Legacy GREENHRISMAIN titles often appended the
 * rate in parentheses — e.g. "As (18,070.00)" or "Server (695)".
 *
 * Strip only a trailing parenthesis that is entirely numeric. Keep site
 * or note parentheses such as "Cashier (Batangas)" or
 * "Company Driver (Fixed-Term)". Expand a bare AS abbreviation to
 * Account Supervisor so portal schedule access and payroll rules match.
 */

const RATE_SUFFIX =
  /\s*\(\s*[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?\s*\)\s*$/;

function stripTrailingRateSuffix(title: string): string {
  return title.replace(RATE_SUFFIX, "").replace(/\s+/g, " ").trim();
}

function expandAccountSupervisorAbbreviation(title: string): string {
  const folded = title.replace(/\./g, "").replace(/\s+/g, " ").trim().toUpperCase();
  if (folded === "AS" || folded === "ACCOUNT SUPERVISOR") {
    return "Account Supervisor";
  }
  return title;
}

export function normalizeJobTitle(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return expandAccountSupervisorAbbreviation(stripTrailingRateSuffix(cleaned));
}
