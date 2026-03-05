/**
 * Browser device fingerprint for stable "same device" detection.
 * More reliable than IP (which changes with network). Not as unique as MAC (which browsers cannot read).
 * Combines: userAgent, platform, screen size, timezone, language, hardware concurrency.
 * Same device/browser typically yields the same hash; different device or browser yields different hash.
 */
const FINGERPRINT_MAX_LENGTH = 64;

function getFingerprintPayload(): string {
  if (typeof navigator === "undefined") return "";
  const parts = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? "",
    typeof screen !== "undefined" ? `${screen.width}x${screen.height}x${screen.colorDepth}` : "",
    typeof Intl !== "undefined" && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
  ];
  return parts.join("|");
}

/**
 * Returns a short hash of the device/browser fingerprint (stable per device).
 * Uses crypto.subtle when available; otherwise a simple string hash.
 */
export async function getDeviceFingerprint(): Promise<string> {
  const payload = getFingerprintPayload();
  if (!payload) return "";

  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      return hashHex.slice(0, FINGERPRINT_MAX_LENGTH);
    } catch {
      return simpleHash(payload);
    }
  }
  return simpleHash(payload);
}

/** Synchronous fallback when crypto.subtle is unavailable (e.g. insecure context). */
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return Math.abs(h).toString(16).slice(0, FINGERPRINT_MAX_LENGTH);
}

/**
 * Sync version that returns quickly with the simple hash (no crypto.subtle).
 * Use when you need a value without awaiting (e.g. in a callback that can't be async).
 */
export function getDeviceFingerprintSync(): string {
  return simpleHash(getFingerprintPayload());
}
