/**
 * Partial unique indexes that must include period_kind so an adjustment can
 * share dates with its posted regular source (ADR 0017).
 */
export function cutoffBranchDatesUniqueIncludesKind(indexDef: string): boolean {
  const lower = indexDef.toLowerCase();
  if (!lower.includes("period_kind")) return false;
  if (!lower.includes("branch_id")) return false;
  if (!lower.includes("period_start") || !lower.includes("period_end")) {
    return false;
  }
  return true;
}

export function cutoffUnbranchedDatesUniqueIncludesKind(
  indexDef: string
): boolean {
  const lower = indexDef.toLowerCase();
  if (!lower.includes("period_kind")) return false;
  if (!lower.includes("period_start") || !lower.includes("period_end")) {
    return false;
  }
  // Unbranched index has no branch_id column in the key (WHERE branch_id IS NULL).
  return (
    lower.includes("organization_id") &&
    lower.includes("client_id") &&
    !/\(.*branch_id.*,.*period_start/i.test(indexDef)
  );
}
