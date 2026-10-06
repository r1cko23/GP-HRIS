import { NextResponse } from "next/server";
import { bindReporterForm, forwardSupport, readStaff } from "@/lib/it-support";

export async function GET() {
  const staff = await readStaff();
  if (!staff) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return forwardSupport(`/api/ingest/tickets?app=${staff.app}&email=${encodeURIComponent(staff.email)}`);
}

export async function POST(request: Request) {
  const staff = await readStaff();
  if (!staff) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const incoming = await request.formData();
  return forwardSupport("/api/ingest/tickets", {
    method: "POST",
    body: bindReporterForm(incoming, staff),
  });
}
