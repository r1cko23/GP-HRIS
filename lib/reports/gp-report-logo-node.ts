/**
 * Disk logo for Node PDF routes. Keep this off `"use client"` import graphs —
 * webpack cannot resolve `fs` in the browser bundle.
 */

import fs from "fs";
import path from "path";

let cachedLogoDataUrl: string | null | undefined;

export function loadGpLogoDataUrl(): string | null {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const logoPath = path.join(process.cwd(), "public", "gp-logo.webp");
    const bytes = fs.readFileSync(logoPath);
    cachedLogoDataUrl = `data:image/webp;base64,${bytes.toString("base64")}`;
    return cachedLogoDataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

/** Test seam — reset memoized logo between cases. */
export function resetGpLogoCacheForTests(): void {
  cachedLogoDataUrl = undefined;
}
