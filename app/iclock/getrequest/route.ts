import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  ensureDefaultDevice,
  touchDevice,
} from "@/lib/timekeeping/zkteco-adms";
import { DEFAULT_MB10_SERIAL } from "@/lib/timekeeping/zkteco-attlog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /iclock/getrequest — device polls for pending commands.
 * One-shot: deliver pending_command then clear it.
 * Do not auto-inject USERINFO here (Sync names button queues that) —
 * endless USERINFO polls starved ATTLOG dump resume.
 */
export async function GET(req: NextRequest) {
  const sn = (
    req.nextUrl.searchParams.get("SN") ||
    req.nextUrl.searchParams.get("sn") ||
    DEFAULT_MB10_SERIAL
  ).trim();

  let body = "OK";

  try {
    const admin = getAdminClient();
    const device = await ensureDefaultDevice(admin, sn);
    if (device?.id) {
      await touchDevice(admin, device.id);

      const { data: row } = await admin
        .from("biometric_devices")
        .select("pending_command")
        .eq("id", device.id)
        .maybeSingle();

      const cmd = (row?.pending_command as string | null)?.trim() || "";

      if (cmd) {
        await admin
          .from("biometric_devices")
          .update({
            pending_command: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", device.id);

        body = `C:${Date.now() % 100000}:${cmd}`;
        console.info("[iclock/getrequest]", sn, "cmd=", cmd);
      }
    }
  } catch (err) {
    console.error("[iclock/getrequest]", err);
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
