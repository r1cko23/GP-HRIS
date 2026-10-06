/**
 * Identity-step hire (Add employee → Continue) may create a for_verification
 * 201 with client but no position yet. Assignment / rehire / transfer still
 * require an approved position via loadAssignablePosition.
 */
export function planHirePositionGate(input: {
  clientId: string | null;
  positionId?: string | null;
}):
  | { ok: true; mode: "defer" }
  | { ok: true; mode: "assign"; positionId: string }
  | { ok: false; error: string; status: number } {
  const positionId = input.positionId?.trim() || null;
  if (!input.clientId && positionId) {
    return {
      ok: false,
      error: "position_id requires client_id",
      status: 400,
    };
  }
  if (!positionId) {
    return { ok: true, mode: "defer" };
  }
  return { ok: true, mode: "assign", positionId };
}
