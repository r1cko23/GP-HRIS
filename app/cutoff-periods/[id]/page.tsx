import { redirect } from "next/navigation";

/** Bookmarks: cutoff hub now lives under Operations → Payroll. */
export default function CutoffPeriodHubRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/payroll/${params.id}`);
}
