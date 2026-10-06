import { resolveGpClientApiBase } from "@/lib/timekeeping/gp-client-ingest";
import type { SitePayFormat } from "@/lib/timekeeping/combine-sites-pay-format";

export async function loadLatestSitePayFormats(
  branchIds: string[],
): Promise<SitePayFormat[]> {
  const unique = [...new Set(branchIds.filter(Boolean))];
  if (unique.length < 2) {
    return unique.map((branchId) => ({ branchId, payFormat: null }));
  }

  const base = resolveGpClientApiBase();
  const key = process.env.DIRECTORY_SERVICE_API_KEY?.trim();
  if (!key) {
    throw new Error("Timekeeping is not configured. Set DIRECTORY_SERVICE_API_KEY.");
  }

  const query = encodeURIComponent(unique.join(","));
  let res: Response;
  try {
    res = await fetch(
      `${base}/api/periods/pay-formats-for-hris?directory_branch_id=${query}`,
      {
        headers: { "x-directory-api-key": key },
        cache: "no-store",
      },
    );
  } catch {
    throw new Error(`Cannot reach timekeeping at ${base} to read pay formats.`);
  }
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: { directory_branch_id: string; pay_format: number }[];
  };
  if (!res.ok) {
    throw new Error(json.error || "Could not read site pay formats.");
  }

  const byBranch = new Map(
    (json.data ?? []).map((row) => [row.directory_branch_id, row.pay_format]),
  );
  return unique.map((branchId) => ({
    branchId,
    payFormat: byBranch.get(branchId) ?? null,
  }));
}
