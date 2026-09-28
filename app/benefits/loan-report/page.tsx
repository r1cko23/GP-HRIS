import { redirect } from "next/navigation";

/** Brief Benefits mis-home — remittance reports belong under Reports. */
export default function BenefitsLoanReportRedirect() {
  redirect("/reports/loans");
}
