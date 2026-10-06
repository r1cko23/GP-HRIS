import { NextResponse } from "next/server";
import { forwardSupport, isSupportId, readStaff } from "@/lib/it-support";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const staff = await readStaff();
  if (!staff) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!isSupportId(context.params.id)) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  return forwardSupport(
    `/api/ingest/tickets/${context.params.id}?app=${staff.app}&email=${encodeURIComponent(staff.email)}`,
  );
}
