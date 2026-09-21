import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";
import { reprocessMappedAttlogFrom } from "@/lib/timekeeping/zkteco-adms";
import { DEFAULT_MB10_SERIAL } from "@/lib/timekeeping/zkteco-attlog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/timekeeping/biometric/reprocess
 * Body: { from?: "2026-09-16" } — Manila calendar date (defaults to 2026-09-16).
 * Re-applies skipped-unmapped ATTLOG for PINs that now have maps.
 * Biometric overwrites same-day phone bundy rows (source of truth).
 */
export async function POST(request: NextRequest) {
  const session = await verifyAdminOrHrAccess();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fromDate = String(body?.from ?? "2026-09-16").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return NextResponse.json(
      { error: "from must be YYYY-MM-DD (Manila)" },
      { status: 400 }
    );
  }

  // Manila midnight → UTC
  const fromIso = `${fromDate}T00:00:00+08:00`;
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) {
    return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
  }

  const admin = getAdminClient();
  const result = await reprocessMappedAttlogFrom(admin, {
    fromIso: new Date(fromMs).toISOString(),
    serialNumber: DEFAULT_MB10_SERIAL,
  });

  return NextResponse.json({
    ...result,
    from: fromDate,
    from_iso: new Date(fromMs).toISOString(),
    message:
      "Mapped PIN skips re-applied. Biometric times replace same-day phone bundy for payroll.",
  });
}
