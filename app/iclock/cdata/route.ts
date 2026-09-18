import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  applyAttlogPush,
  applyOperlogPush,
  ensureDefaultDevice,
  touchDevice,
} from "@/lib/timekeeping/zkteco-adms";
import {
  DEFAULT_MB10_SERIAL,
  admsPollTiming,
} from "@/lib/timekeeping/zkteco-attlog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Plain-text ADMS responses — device expects body "OK" (and option blocks). */
function admsText(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function snFrom(req: NextRequest): string {
  return (
    req.nextUrl.searchParams.get("SN") ||
    req.nextUrl.searchParams.get("sn") ||
    ""
  ).trim();
}

/**
 * GET /iclock/cdata — device handshake / options.
 */
export async function GET(req: NextRequest) {
  const sn = snFrom(req) || DEFAULT_MB10_SERIAL;
  try {
    const admin = getAdminClient();
    const device = await ensureDefaultDevice(admin, sn);
    if (!device || !device.is_active) {
      return admsText("OK");
    }
    await touchDevice(admin, device.id);
    const { data: fresh } = await admin
      .from("biometric_devices")
      .select("attlog_stamp, operlog_stamp")
      .eq("id", device.id)
      .maybeSingle();
    const attStamp = (fresh?.attlog_stamp as string | null) || "None";
    // Force OPERLOG re-push until we have terminal names (ATTLOG has no Name field)
    const { count: userCount } = await admin
      .from("biometric_device_users")
      .select("id", { count: "exact", head: true })
      .eq("device_id", device.id);
    const operStamp =
      (userCount ?? 0) > 0
        ? (fresh?.operlog_stamp as string | null) || "None"
        : "None";
    const { data: farthestRow } = await admin
      .from("biometric_punch_events")
      .select("punched_at")
      .eq("device_id", device.id)
      .order("punched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { delaySec, transIntervalMin } = admsPollTiming(
      (farthestRow?.punched_at as string | null) ?? null
    );
    const options = [
      `GET OPTION FROM: ${sn}`,
      `ATTLOGStamp=${attStamp}`,
      `OPERLOGStamp=${operStamp}`,
      `ATTPHOTOStamp=None`,
      `ErrorDelay=30`,
      `Delay=${delaySec}`,
      `TransTimes=00:00;14:00`,
      `TransInterval=${transIntervalMin}`,
      `TransFlag=TransData AttLog OpLog EnrollUser ChgUser`,
      `TimeZone=8`,
      `Realtime=1`,
      `Encrypt=0`,
    ].join("\n");
    return admsText(options);
  } catch (err) {
    console.error("[iclock/cdata GET]", err);
    return admsText("OK");
  }
}

/**
 * POST /iclock/cdata — ATTLOG / OPERLOG / USERINFO push.
 */
export async function POST(req: NextRequest) {
  const sn = snFrom(req);
  const table = (req.nextUrl.searchParams.get("table") || "").toUpperCase();
  const stamp = req.nextUrl.searchParams.get("Stamp");

  let body = "";
  try {
    body = await req.text();
  } catch {
    body = "";
  }

  try {
    const admin = getAdminClient();

    if (!sn) {
      return admsText("OK");
    }

    if (sn === DEFAULT_MB10_SERIAL) {
      await ensureDefaultDevice(admin, sn);
    }

    if (table === "ATTLOG" || (!table && body.includes("\t") && !/PIN=/i.test(body))) {
      const result = await applyAttlogPush(admin, {
        serialNumber: sn,
        body,
        stamp,
      });
      if (result.errors.length) {
        console.warn("[iclock ATTLOG]", sn, result);
      }
      return admsText("OK");
    }

    if (
      table === "OPERLOG" ||
      table === "USERINFO" ||
      (/PIN=/i.test(body) && /Name=/i.test(body))
    ) {
      const result = await applyOperlogPush(admin, {
        serialNumber: sn,
        body,
        stamp,
      });
      if (result.upserted) {
        console.info("[iclock users]", sn, result);
      }
      return admsText("OK");
    }

    const { data: device } = await admin
      .from("biometric_devices")
      .select("id")
      .eq("serial_number", sn)
      .maybeSingle();
    if (device?.id) await touchDevice(admin, device.id as string);

    return admsText("OK");
  } catch (err) {
    console.error("[iclock/cdata POST]", err);
    return admsText("OK");
  }
}
