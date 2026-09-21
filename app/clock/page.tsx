import { redirect } from "next/navigation";

export default function ClockRedirectPage() {
  redirect("/time/attendance");
}
