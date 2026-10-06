import { NextResponse } from "next/server";
import { bindReporterForm, forwardSupport, isSupportId, readStaff } from "@/lib/it-support";

export async function POST(request: Request, context: { params: { id: string } }) {
  const staff = await readStaff();
  if (!staff) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!isSupportId(context.params.id)) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  const incoming = await request.formData();
  return forwardSupport(`/api/ingest/tickets/${context.params.id}/messages`, {
    method: "POST",
    body: bindReporterForm(incoming, staff),
  });
}
