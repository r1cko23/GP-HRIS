-- Cutoff periods per Directory Branch (site). Organic periods keep branch_id NULL.
-- Dual-position hours: unique per person + position on a cutoff (ADR 0014).

ALTER TABLE public.cutoff_periods
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES directory.client_branches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cutoff_periods_branch_id_idx
  ON public.cutoff_periods (branch_id)
  WHERE branch_id IS NOT NULL;

ALTER TABLE public.cutoff_periods
  DROP CONSTRAINT IF EXISTS cutoff_periods_org_client_dates_key;

CREATE UNIQUE INDEX IF NOT EXISTS cutoff_periods_org_client_unbranched_dates_key
  ON public.cutoff_periods (organization_id, client_id, period_start, period_end)
  WHERE branch_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cutoff_periods_org_client_branch_dates_key
  ON public.cutoff_periods (organization_id, client_id, branch_id, period_start, period_end)
  WHERE branch_id IS NOT NULL;

ALTER TABLE public.cutoff_hours
  DROP CONSTRAINT IF EXISTS cutoff_hours_period_employee_key;

ALTER TABLE public.cutoff_hours
  ADD CONSTRAINT cutoff_hours_period_employee_position_key
  UNIQUE NULLS NOT DISTINCT (cutoff_period_id, directory_employee_id, position_id);

COMMENT ON COLUMN public.cutoff_periods.branch_id IS
  'Directory site (client_branches). NULL = Organic / whole-client cutoff.';

COMMENT ON CONSTRAINT cutoff_hours_period_employee_position_key ON public.cutoff_hours IS
  'One hours row per person per position per cutoff (two jobs = two rows).';
