/**
 * Persistent client/device ID stored in localStorage.
 * Same browser/device keeps the same ID until the user clears site data.
 * Used together with fingerprint for device-uniqueness tracking.
 */

const STORAGE_KEY = "gp_hris_device_id";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the persistent client ID for this browser/device.
 * Creates and stores a new UUID in localStorage if none exists.
 * Sync (no async) so it can be used anywhere.
 */
export function getOrCreateClientId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return "";
  }
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.length < 10) {
      id = generateId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
