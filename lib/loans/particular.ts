/** Map GREENHRISMAIN `loan.particular` onto GP `employee_loans.loan_type`. */

export type EmployeeLoanType =
  | "company"
  | "sss_calamity"
  | "pagibig_calamity"
  | "sss"
  | "pagibig"
  | "emergency"
  | "other";

export function mapParticularToLoanType(
  particular: string | null | undefined
): EmployeeLoanType {
  const key = String(particular ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!key) return "other";
  if (key.includes("sss") && key.includes("calamity")) return "sss_calamity";
  if (key.includes("pag") && key.includes("calami")) return "pagibig_calamity";
  if (key.includes("sss")) return "sss";
  if (key.includes("pag")) return "pagibig";
  if (key.includes("emerg")) return "emergency";
  if (key.includes("company loan") || key === "company") return "company";
  if (key.includes("cash advance")) return "other";
  return "other";
}

export function normalizePaymentTerm(
  value: string | null | undefined
): "monthly" | "semi-monthly" {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  if (key.includes("semi")) return "semi-monthly";
  return "monthly";
}

/** GREENHRISMAIN `otherdeduction.particular` label for a GP loan line. */
export function particularLabel(
  loanType: string | null | undefined,
  stored?: string | null
): string {
  const fromStored = String(stored ?? "").trim();
  if (fromStored) return fromStored;
  switch (loanType) {
    case "sss":
    case "sss_calamity":
      return loanType === "sss_calamity" ? "SSS Calamity Loan" : "SSS Loan";
    case "pagibig":
    case "pagibig_calamity":
      return loanType === "pagibig_calamity"
        ? "Pag-IBIG Calamity Loan"
        : "Pag-IBIG Loan";
    case "company":
      return "Company Loan";
    case "emergency":
      return "Emergency Loan";
    default:
      return "Cash Advance";
  }
}
