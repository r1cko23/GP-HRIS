/**
 * After parking extra 201s under a person master, move their employment_tenures
 * onto that master so the Tenures panel is not empty on the live file.
 *
 * Never rewrite a barred / inactive episode into the live status — keep it closed
 * and seed a new current tenure when the live 201 differs.
 */

export type TenureReattachRow = {
  id: string;
  employee_id: string;
  sequence: number;
  is_current: boolean;
  status: string;
};

export type TenureReattachPlan = {
  moveIds: string[];
  /** All current flags to clear before promoting one row. */
  clearCurrentIds: string[];
  /** Ids that must stay closed with their original status (barred history). */
  keepHistoricalIds: string[];
  /** Tenure that becomes current on the master; null → seed from live 201. */
  currentId: string | null;
};

function isHistoricalStatus(status: string): boolean {
  return status === "barred" || status === "inactive";
}

export function planTenureReattachAfterCollapse(input: {
  masterId: string;
  loserIds: string[];
  liveStatus: string;
  tenures: TenureReattachRow[];
}): TenureReattachPlan {
  const loserSet = new Set(input.loserIds);
  const moveIds = input.tenures
    .filter((row) => loserSet.has(row.employee_id))
    .map((row) => row.id);

  const onMasterAfter = input.tenures.filter(
    (row) => row.employee_id === input.masterId || loserSet.has(row.employee_id)
  );
  if (onMasterAfter.length === 0) {
    return {
      moveIds: [],
      clearCurrentIds: [],
      keepHistoricalIds: [],
      currentId: null,
    };
  }

  const keepHistoricalIds = onMasterAfter
    .filter(
      (row) =>
        isHistoricalStatus(row.status) &&
        row.status !== input.liveStatus
    )
    .map((row) => row.id);

  const historical = new Set(keepHistoricalIds);
  const candidates = onMasterAfter.filter((row) => !historical.has(row.id));

  const preferred =
    candidates.find(
      (row) =>
        row.is_current &&
        row.employee_id === input.masterId &&
        row.status === input.liveStatus
    ) ??
    candidates.find(
      (row) => row.is_current && row.employee_id === input.masterId
    ) ??
    candidates.find(
      (row) => row.is_current && row.status === input.liveStatus
    ) ??
    candidates.find((row) => row.status === input.liveStatus) ??
    null;

  return {
    moveIds,
    clearCurrentIds: onMasterAfter
      .filter((row) => row.is_current)
      .map((row) => row.id),
    keepHistoricalIds,
    currentId: preferred?.id ?? null,
  };
}
