import { invalidateSessionCache } from "@/lib/session-cache";

/** Clear browser session cache and bump server Redis epoch (best-effort). */
export async function bustCache(): Promise<void> {
  invalidateSessionCache();
  try {
    await fetch("/api/cache/invalidate", { method: "POST" });
  } catch {
    /* best-effort */
  }
}
