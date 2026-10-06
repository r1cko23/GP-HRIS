import { NextResponse } from "next/server";
import { forwardSupport, readStaff, supportSiteUrl } from "@/lib/it-support";

export async function GET(request: Request) {
  const staff = await readStaff();
  if (!staff) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
  const registered = await forwardSupport("/api/ingest/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: staff.email,
      name: staff.name,
      userId: staff.userId,
      app: staff.app,
    }),
  });
  const body = (await registered.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!registered.ok || !body.token) {
    const back = new URL("/support", request.url);
    back.searchParams.set("error", body.error ?? "Could not open support");
    return NextResponse.redirect(back);
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const dest = new URL("/auth/handoff", supportSiteUrl(host));
  dest.searchParams.set("token", body.token);
  return NextResponse.redirect(dest);
}
