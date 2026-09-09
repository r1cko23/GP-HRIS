/** In-page tabs on the cutoff hub (`/payroll/[id]`). */

export const CUTOFF_HUB_TABS = [
  "hours",
  "register",
  "downloads",
  "billing",
] as const;

export type CutoffHubTab = (typeof CUTOFF_HUB_TABS)[number];

/**
 * Workflow section anchors live inside a tab. The guide stays above the tab
 * bar, so it does not switch tabs.
 */
export function cutoffHubTabForSection(
  sectionId: string
): CutoffHubTab | null {
  switch (sectionId) {
    case "cutoff-hours":
    case "cutoff-readiness":
      return "hours";
    case "payroll-register":
    case "pre-post-review":
      return "register";
    case "cutoff-downloads":
      return "downloads";
    case "client-billing":
      return "billing";
    case "cutoff-guide":
      return null;
    default:
      return "hours";
  }
}
