import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPasswordResetEmail } from "@/lib/auth/send-password-reset-email";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Basic throttling parameters
const MINUTE = 60 * 1000;
const MIN_GAP_MS = 5 * MINUTE; // 5 minutes between sends per email
const DAILY_LIMIT = 5; // max per email per day

function getOrigin(req: NextRequest) {
  try {
    return new URL(req.url).origin;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL || "";
  }
}

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  // Next.js sets request.ip when using edge/server; may be undefined locally
  // @ts-ignore
  return (req as any).ip || null;
}

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  let email = "";
  try {
    const body = await req.json();
    email = (body?.email || "").trim().toLowerCase();
  } catch {
    // fall through to generic response
  }

  // Always respond generically to avoid account enumeration
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: true });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Throttle checks
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await supabaseAdmin
    .from("password_reset_requests")
    .select("requested_at")
    .eq("email", email)
    .gte("requested_at", since)
    .order("requested_at", { ascending: false });

  if (!recentError && recent) {
    if (recent.length >= DAILY_LIMIT) {
      return NextResponse.json({ ok: true });
    }
    const last = recent[0];
    if (last?.requested_at) {
      const lastTs = new Date(last.requested_at).getTime();
      if (Date.now() - lastTs < MIN_GAP_MS) {
        return NextResponse.json({ ok: true });
      }
    }
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim()
      ? process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/+$/, "")
      : getOrigin(req);
  const redirectTo =
    base && base.length > 0
      ? `${base}/reset-password`
      : `${req.nextUrl.origin}/reset-password`;

  let success = false;
  try {
    const result = await sendPasswordResetEmail(
      { email, redirectTo },
      {
        generateRecoveryLink: async ({ email: targetEmail, redirectTo: to }) => {
          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email: targetEmail,
            options: { redirectTo: to },
          });
          if (error || !data?.properties?.action_link) {
            return {
              ok: false as const,
              error: error?.message || "Could not generate recovery link.",
            };
          }

          let name: string | undefined;
          const { data: userRow } = await supabaseAdmin
            .from("users")
            .select("full_name, email")
            .eq("email", targetEmail)
            .maybeSingle();
          if (userRow?.full_name && typeof userRow.full_name === "string") {
            name = userRow.full_name.trim() || undefined;
          }

          return {
            ok: true as const,
            actionLink: data.properties.action_link,
            name,
          };
        },
      }
    );

    if (!result.ok) {
      throw new Error(result.error);
    }
    success = true;
  } catch (err) {
    // Log failure but keep response generic
    console.error("reset-request error", err);
  }

  // Record the attempt (success flag for observability)
  const requesterIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || null;
  await supabaseAdmin.from("password_reset_requests").insert({
    email,
    requester_ip: requesterIp,
    user_agent: userAgent,
    success,
  });

  return NextResponse.json({ ok: true });
}
