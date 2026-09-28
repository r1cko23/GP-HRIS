/** Cutoff refund row written to public.cutoff_allowances. */

export type CutoffAllowanceExisting = {
  transpo_allowance?: number | null;
  load_allowance?: number | null;
  allowance?: number | null;
};

export type CutoffRefundUpsert = {
  employee_id: string;
  period_start: string;
  period_end: string;
  refund: number;
  transpo_allowance: number;
  load_allowance: number;
  allowance: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function money(value: number | null | undefined): number {
  return round2(Number(value) || 0);
}

/**
 * Build an upsert for Client → Employee → Refund amount on a cutoff.
 * Preserves other allowance columns when a prior row exists.
 */
export function buildCutoffRefundUpsert(args: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  refund: number;
  existing?: CutoffAllowanceExisting | null;
}): CutoffRefundUpsert {
  return {
    employee_id: args.employeeId,
    period_start: args.periodStart,
    period_end: args.periodEnd,
    refund: money(args.refund),
    transpo_allowance: money(args.existing?.transpo_allowance),
    load_allowance: money(args.existing?.load_allowance),
    allowance: money(args.existing?.allowance),
  };
}
