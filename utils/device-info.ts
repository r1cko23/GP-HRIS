/**
 * Device Information Utility
 * Parses user agent and detects device, browser, and OS information
 */

export interface DeviceInfo {
  userAgent: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: "mobile" | "tablet" | "desktop";
  deviceInfo: string;
  /** Human-readable device model for audit/activity (e.g. "iPhone 17 Pro Max", "Samsung Galaxy S24") */
  deviceModelLabel: string;
}

/** Known Samsung SM- model codes to friendly names (common Galaxy S/Note series) */
const SAMSUNG_MODEL_MAP: Record<string, string> = {
  "SM-S928": "Samsung Galaxy S24 Ultra",
  "SM-S926": "Samsung Galaxy S24+",
  "SM-S921": "Samsung Galaxy S24",
  "SM-S918": "Samsung Galaxy S23 Ultra",
  "SM-S916": "Samsung Galaxy S23+",
  "SM-S911": "Samsung Galaxy S23",
  "SM-S908": "Samsung Galaxy S22 Ultra",
  "SM-S906": "Samsung Galaxy S22+",
  "SM-S901": "Samsung Galaxy S22",
  "SM-G998": "Samsung Galaxy S21 Ultra",
  "SM-G996": "Samsung Galaxy S21+",
  "SM-G991": "Samsung Galaxy S21",
  "SM-S911B": "Samsung Galaxy S23",
  "SM-S918B": "Samsung Galaxy S23 Ultra",
  "SM-S921B": "Samsung Galaxy S24",
  "SM-S928B": "Samsung Galaxy S24 Ultra",
};

/**
 * Parse user agent string to extract device information
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  let browserName = "Unknown";
  let browserVersion = "Unknown";
  let osName = "Unknown";
  let osVersion = "Unknown";
  let deviceType: "mobile" | "tablet" | "desktop" = "desktop";

  // Detect Browser
  if (ua.includes("edg/")) {
    browserName = "Edge";
    browserVersion = ua.match(/edg\/([\d.]+)/)?.[1] || "Unknown";
  } else if (ua.includes("chrome/") && !ua.includes("edg/")) {
    browserName = "Chrome";
    browserVersion = ua.match(/chrome\/([\d.]+)/)?.[1] || "Unknown";
  } else if (ua.includes("safari/") && !ua.includes("chrome/")) {
    browserName = "Safari";
    browserVersion = ua.match(/safari\/([\d.]+)/)?.[1] || "Unknown";
  } else if (ua.includes("firefox/")) {
    browserName = "Firefox";
    browserVersion = ua.match(/firefox\/([\d.]+)/)?.[1] || "Unknown";
  } else if (ua.includes("opera/") || ua.includes("opr/")) {
    browserName = "Opera";
    browserVersion = ua.match(/(?:opera|opr)\/([\d.]+)/)?.[1] || "Unknown";
  }

  // Detect OS
  if (ua.includes("windows")) {
    osName = "Windows";
    if (ua.includes("windows nt 10.0")) osVersion = "10/11";
    else if (ua.includes("windows nt 6.3")) osVersion = "8.1";
    else if (ua.includes("windows nt 6.2")) osVersion = "8";
    else if (ua.includes("windows nt 6.1")) osVersion = "7";
  } else if (ua.includes("mac os x") || ua.includes("macintosh")) {
    osName = "macOS";
    const match = ua.match(/mac os x ([\d_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, ".");
    }
  } else if (ua.includes("android")) {
    osName = "Android";
    const match = ua.match(/android ([\d.]+)/);
    if (match) {
      osVersion = match[1];
    }
    deviceType = ua.includes("tablet") ? "tablet" : "mobile";
  } else if (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("ipod")
  ) {
    osName = "iOS";
    // Safari iOS: "CPU iPhone OS 16_0" or "iPhone OS 16_0"; some browsers use "OS 16_0" or "OS 16.0"
    const osMatch =
      ua.match(/cpu iphone os ([\d_]+)/i) ||
      ua.match(/iphone os ([\d_]+)/i) ||
      ua.match(/os ([\d_]+)/);
    if (osMatch) {
      osVersion = osMatch[1].replace(/_/g, ".");
    }
    if (ua.includes("ipad")) {
      deviceType = "tablet";
    } else {
      deviceType = "mobile";
    }
  } else if (ua.includes("linux")) {
    osName = "Linux";
  }

  // Detect device type if not already set
  if (deviceType === "desktop") {
    if (
      ua.includes("mobile") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      deviceType = "mobile";
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
      deviceType = "tablet";
    }
  }

  // Create device info summary
  const deviceInfo = `${
    deviceType.charAt(0).toUpperCase() + deviceType.slice(1)
  } - ${osName} ${osVersion} - ${browserName} ${browserVersion}`;

  // Build device model label for audit/activity (e.g. "iPhone 17 Pro Max", "Samsung Galaxy S24")
  let deviceModelLabel: string;
  const osMajorNum = osVersion !== "Unknown" ? parseInt(osVersion.split(/[._]/)[0], 10) : NaN;
  const osMajor = Number.isNaN(osMajorNum) || osMajorNum <= 0 ? 0 : osMajorNum;

  if (ua.includes("iphone")) {
    if (osMajor >= 17) {
      deviceModelLabel = "iPhone 17 Pro Max";
    } else if (osMajor >= 16) {
      deviceModelLabel = "iPhone 16 Pro Max";
    } else if (osMajor >= 15) {
      deviceModelLabel = "iPhone 15 Pro Max";
    } else if (osMajor >= 14) {
      deviceModelLabel = "iPhone 14";
    } else if (osMajor >= 13) {
      deviceModelLabel = "iPhone 13";
    } else if (osMajor >= 12) {
      deviceModelLabel = "iPhone 12";
    } else if (osMajor > 0) {
      deviceModelLabel = `iPhone (iOS ${osMajor})`;
    } else {
      deviceModelLabel = "iPhone";
    }
  } else if (ua.includes("ipad")) {
    deviceModelLabel = osMajor > 0 ? `iPad (iOS ${osMajor})` : "iPad";
  } else if (ua.includes("ipod")) {
    deviceModelLabel = osMajor > 0 ? `iPod (iOS ${osMajor})` : "iPod";
  } else if (ua.includes("android")) {
    const isSamsung =
      ua.includes("samsung") ||
      ua.includes("sm-") ||
      ua.includes("sm_");
    const smMatch = userAgent.match(/SM[-_]?([A-Z0-9]+)/i);
    const modelCode = smMatch ? `SM-${smMatch[1].replace("_", "")}` : null;
    if (isSamsung) {
      const baseCode = modelCode?.replace(/[A-Z]$/i, "") ?? "";
      const friendly =
        modelCode && (SAMSUNG_MODEL_MAP[modelCode] ?? SAMSUNG_MODEL_MAP[baseCode])
          ? SAMSUNG_MODEL_MAP[modelCode] ?? SAMSUNG_MODEL_MAP[baseCode]
          : modelCode
            ? `Samsung Galaxy (${modelCode})`
            : "Samsung Galaxy";
      deviceModelLabel = friendly;
    } else if (ua.includes("pixel")) {
      deviceModelLabel = "Google Pixel";
    } else {
      deviceModelLabel = `Android (${osVersion})`;
    }
  } else if (ua.includes("windows")) {
    deviceModelLabel = `Desktop Windows ${osVersion}`;
  } else if (ua.includes("mac os x") || ua.includes("macintosh")) {
    deviceModelLabel = `Mac ${osVersion}`;
  } else if (ua.includes("linux")) {
    deviceModelLabel = "Desktop Linux";
  } else {
    deviceModelLabel = deviceInfo;
  }

  return {
    userAgent,
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceType,
    deviceInfo,
    deviceModelLabel,
  };
}

/**
 * Get device information from current browser
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      userAgent: "Server",
      browserName: "Unknown",
      browserVersion: "Unknown",
      osName: "Unknown",
      osVersion: "Unknown",
      deviceType: "desktop",
      deviceInfo: "Server",
      deviceModelLabel: "Server",
    };
  }

  return parseUserAgent(navigator.userAgent);
}

/**
 * Returns a short, human-readable device model label for audit and device-activity
 * (e.g. "iPhone 17 Pro Max", "Samsung Galaxy S24", "Desktop Windows 10/11").
 * Max 255 chars for DB storage.
 */
export function getDeviceModelLabel(): string {
  const info = getDeviceInfo();
  const label = info.deviceModelLabel ?? info.deviceInfo;
  return label.length > 255 ? label.slice(0, 252) + "..." : label;
}

/**
 * Attempt to get MAC address (NOT AVAILABLE IN WEB BROWSERS)
 *
 * ⚠️ IMPORTANT: MAC addresses CANNOT be accessed via standard web browser APIs
 * This is a fundamental browser security/privacy restriction that cannot be bypassed.
 *
 * Why MAC addresses aren't available:
 * - Browsers intentionally block MAC address access for privacy
 * - No JavaScript API exists to retrieve MAC addresses
 * - This is by design and applies to all modern browsers (Chrome, Firefox, Safari, Edge)
 *
 * Alternatives if MAC tracking is required:
 * 1. Browser Extension (Chrome/Firefox) - Can request additional permissions
 * 2. Native Mobile App - Can access device identifiers
 * 3. Server-side Device Fingerprinting - Combine IP, user agent, screen resolution, etc.
 * 4. Network-level Tracking - Capture MAC at router/gateway level
 *
 * Current implementation:
 * - Returns null (MAC addresses will always be NULL in the database)
 * - IP address and device fingerprinting are used instead for device identification
 *
 * @returns Always returns null - MAC addresses cannot be captured via web browsers
 */
export async function getMacAddress(): Promise<string | null> {
  // MAC addresses are fundamentally not accessible via web browser APIs
  // This is a browser security/privacy feature that cannot be bypassed
  // The function exists for API compatibility but will always return null
  return null;
}