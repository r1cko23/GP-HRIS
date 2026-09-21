/**
 * One-shot: reprocess mapped ATTLOG skips from 2026-09-16 Manila.
 * Uses local env → production Supabase (same as next dev).
 */
import { createClient } from "@supabase/supabase-js";
import { reprocessMappedAttlogFrom } from "../lib/timekeeping/zkteco-adms";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fromMs = Date.parse("2026-09-16T00:00:00+08:00");
  const result = await reprocessMappedAttlogFrom(admin, {
    fromIso: new Date(fromMs).toISOString(),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
