/**
 * GREENHRISMAIN → GP-HRIS ETL target policy.
 *
 * Always writes to the on-prem / local Supabase (hris.greenpasture.com or
 * loopback Kong). Cloud *.supabase.co is refused so a Mac .env.local cannot
 * accidentally catalog-mirror into Vercel/cloud.
 *
 * Override URL with ETL_SUPABASE_URL (e.g. http://127.0.0.1:8000).
 * Optional local key: ETL_SUPABASE_SERVICE_ROLE_KEY (when NEXT_PUBLIC points at cloud).
 * Escape hatch only for emergencies: ETL_ALLOW_CLOUD=1.
 */

import fs from "fs";
import path from "path";

export const DEFAULT_LOCAL_ETL_SUPABASE_URL = "https://hris.greenpasture.com";

export function isCloudSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host.endsWith(".supabase.co") || host.endsWith(".supabase.in");
  } catch {
    return false;
  }
}

/** On-prem Kong / app hosts and loopback — not cloud Supabase. */
export function isLocalEtlSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true;
    }
    if (host === "hris.greenpasture.com" || host === "hris.greenpasture.ph") {
      return true;
    }
    // Office LAN IP of gp-hris / Kong
    if (/^10\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function resolveEtlSupabaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  const allowCloud = env.ETL_ALLOW_CLOUD === "1";
  const preferred = [
    env.ETL_SUPABASE_URL,
    env.ETL_LOCAL_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_URL,
    DEFAULT_LOCAL_ETL_SUPABASE_URL,
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));

  for (const url of preferred) {
    if (isCloudSupabaseUrl(url)) {
      if (allowCloud) return url;
      continue;
    }
    if (isLocalEtlSupabaseUrl(url) || allowCloud) return url;
  }

  if (allowCloud && env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return env.NEXT_PUBLIC_SUPABASE_URL.trim();
  }

  throw new Error(
    [
      "GREENHRISMAIN ETL refuses cloud Supabase.",
      `Set ETL_SUPABASE_URL (default ${DEFAULT_LOCAL_ETL_SUPABASE_URL})`,
      "and ETL_SUPABASE_SERVICE_ROLE_KEY for the local on-prem project,",
      "or run on gp-hris where .env.production.local points at local Kong.",
      "Emergency only: ETL_ALLOW_CLOUD=1",
    ].join(" ")
  );
}

/** Best-effort: cloud Supabase JWTs carry a project `ref` in the payload. */
export function serviceRoleKeyLooksCloud(key: string): boolean {
  try {
    const parts = key.split(".");
    if (parts.length < 2) return false;
    const json = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { ref?: string; iss?: string };
    if (typeof payload.ref === "string" && payload.ref.length > 0) return true;
    if (typeof payload.iss === "string" && /supabase\.co/i.test(payload.iss)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function resolveEtlServiceRoleKey(
  env: NodeJS.ProcessEnv = process.env,
  supabaseUrl?: string
): string {
  const key =
    env.ETL_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing ETL_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  const url = supabaseUrl ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (
    env.ETL_ALLOW_CLOUD !== "1" &&
    isLocalEtlSupabaseUrl(url) &&
    serviceRoleKeyLooksCloud(key) &&
    !env.ETL_SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    throw new Error(
      [
        "GREENHRISMAIN ETL target is local, but SUPABASE_SERVICE_ROLE_KEY is a cloud JWT.",
        "On gp-hris, put the local service role in .env.production.local.",
        "From a Mac, set ETL_SUPABASE_SERVICE_ROLE_KEY to the on-prem key",
        "(or rsync code and run the ETL on 10.0.0.110).",
      ].join(" ")
    );
  }
  return key;
}

function loadEnvFile(fileName: string, opts?: { override?: boolean }) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (opts?.override || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * Load env for MAIN ETLs, then pin NEXT_PUBLIC_SUPABASE_URL to the local target.
 * `.env.production.local` overrides `.env.local` so office-server secrets win.
 */
export function loadMainEtlEnv(): {
  supabaseUrl: string;
  serviceRoleKey: string;
  sqlHost: string;
} {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
  // On-prem server keeps local URL/keys here — must win over a cloud .env.local.
  loadEnvFile(".env.production.local", { override: true });

  const supabaseUrl = resolveEtlSupabaseUrl(process.env);
  const serviceRoleKey = resolveEtlServiceRoleKey(process.env, supabaseUrl);

  if (isCloudSupabaseUrl(supabaseUrl) && process.env.ETL_ALLOW_CLOUD !== "1") {
    throw new Error(
      `Refusing GREENHRISMAIN ETL to cloud Supabase (${supabaseUrl}). Use local on-prem.`
    );
  }

  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

  const sqlHost = process.env.SQL_HOST?.trim();
  if (!sqlHost) {
    throw new Error("Missing SQL_HOST (GREENHRISMAIN)");
  }

  console.log(
    `ETL target: MAIN SQL ${sqlHost} → Supabase ${supabaseUrl}` +
      (process.env.ETL_ALLOW_CLOUD === "1" ? " (ETL_ALLOW_CLOUD=1)" : "")
  );

  return { supabaseUrl, serviceRoleKey, sqlHost };
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
