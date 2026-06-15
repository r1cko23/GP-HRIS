/**
 * Employee portal viewport tiers (Tailwind breakpoints):
 *
 * | Tier    | Width      | Chrome                          |
 * |---------|------------|---------------------------------|
 * | Mobile  | < 768px    | Bottom nav, compact header      |
 * | Tablet  | 768–1023px | Sidebar, desktop header         |
 * | Laptop+ | ≥ 1024px   | Sidebar, full padding & grids   |
 *
 * Use EpMobileView / EpDesktopView for wholly separate layouts (split at md).
 */

export const epViewportMobileOnly = "flex w-full flex-col md:hidden";
export const epViewportDesktopOnly = "hidden w-full flex-col md:flex";
export const epViewportBlockMobileOnly = "block md:hidden";
export const epViewportBlockDesktopOnly = "hidden md:block";
