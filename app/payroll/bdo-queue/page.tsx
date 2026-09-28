import { redirect } from "next/navigation";

/** Old Payroll-nested path — BDO queue lives at /bdo-queue. */
export default function PayrollBdoQueueRedirect() {
  redirect("/bdo-queue");
}
