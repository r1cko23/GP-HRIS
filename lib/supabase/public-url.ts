/**
 * Resolve the public Supabase (Kong) URL for browser / middleware calls.
 *
 * On-prem nginx proxies /auth /rest /realtime /storage on the same host as the
 * Next app. Office uses *.greenpasture.com; AS/WFH use *.greenpasture.ph via
 * Cloudflare Tunnel — both must call Kong on the host the user opened.
 */

const GP_APP_HOST =
  /^(hris|csm|timekeep|payroll)\.greenpasture\.(com|ph)$/i;

export function isGreenPastureAppHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return GP_APP_HOST.test(hostname);
}

/** Prefer the request/browser origin when it is a GP app host; else env fallback. */
export function resolvePublicSupabaseUrl(opts: {
  host?: string | null;
  proto?: string | null;
  envUrl?: string | null;
}): string {
  const envUrl = (opts.envUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const host = (opts.host ?? "").trim().toLowerCase();
  if (host && isGreenPastureAppHost(host)) {
    const proto = (opts.proto ?? "https").replace(/:$/, "") || "https";
    return `${proto}://${host.split(":")[0]}`;
  }
  if (envUrl) return envUrl.replace(/\/$/, "");
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (and no GP app host)");
}

/** Client Components: use window.location when on .com / .ph app hosts. */
export function browserPublicSupabaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.host) {
    return resolvePublicSupabaseUrl({
      host: window.location.host,
      proto: window.location.protocol.replace(":", "") || "https",
    });
  }
  return resolvePublicSupabaseUrl({});
}
