export type SitePayFormat = {
  branchId: string;
  payFormat: number | null;
};

export function planCombinedSites(
  sites: SitePayFormat[],
): { ok: true } | { ok: false; error: string } {
  if (sites.length < 2) return { ok: true };
  if (sites.some((site) => site.payFormat == null)) {
    return {
      ok: false,
      error:
        "Each site needs a pay format from its last cutoff before they can share a register.",
    };
  }
  const formats = new Set(sites.map((site) => site.payFormat));
  if (formats.size > 1) {
    return {
      ok: false,
      error: "These sites use different pay formats. Pay them on separate registers.",
    };
  }
  return { ok: true };
}
