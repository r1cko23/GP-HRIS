/** Cutoff punch signals used to filter the attendance employee picker. */

export type CutoffPunchSignal = {
  employeeId: string;
  status: string;
  clockOutTime: string | null;
};

export function cutoffPunchNeedsAttention(punch: {
  status: string;
  clockOutTime: string | null;
}): boolean {
  if (punch.status === "rejected" || punch.status === "pending") return false;
  if (punch.status === "clocked_out") return true;
  if (punch.status === "clocked_in" || !punch.clockOutTime) return true;
  return false;
}

/** Employees with an incomplete punch or a punch still waiting for review. */
export function employeeIdsNeedingAttention(
  punches: CutoffPunchSignal[]
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const punch of punches) {
    if (!cutoffPunchNeedsAttention(punch) || seen.has(punch.employeeId)) continue;
    seen.add(punch.employeeId);
    ids.push(punch.employeeId);
  }
  return ids;
}
