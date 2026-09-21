import { redirect } from "next/navigation";

/** Punch review now lives on the attendance card. */
export default function TimeEntriesRedirectPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") params.set(key, value);
      else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
    }
  }
  const qs = params.toString();
  redirect(qs ? `/time/attendance?${qs}` : "/time/attendance");
}
