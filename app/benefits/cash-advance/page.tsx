import { redirect } from "next/navigation";

/** Brief Benefits mis-home — cash advance report belongs under Reports. */
export default function BenefitsCashAdvanceRedirect() {
  redirect("/reports/cash-advance");
}
