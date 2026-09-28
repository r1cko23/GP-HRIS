import { redirect } from "next/navigation";

/** Legacy Reports path → Admin hub. */
export default function Page() {
  redirect("/admin/cutoff-parity");
}
