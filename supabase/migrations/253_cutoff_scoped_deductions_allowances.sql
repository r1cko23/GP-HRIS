-- Scope itemized deductions / allowances to one cutoff payroll run.
-- Null cutoff_period_id rows (legacy standing) are no longer loaded on register build.

ALTER TABLE public.employee_other_deductions
  ADD COLUMN IF NOT EXISTS cutoff_period_id UUID
    REFERENCES public.cutoff_periods (id) ON DELETE CASCADE;

ALTER TABLE public.employee_allowances
  ADD COLUMN IF NOT EXISTS cutoff_period_id UUID
    REFERENCES public.cutoff_periods (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS employee_other_deductions_dir_key_uidx;
DROP INDEX IF EXISTS employee_other_deductions_office_key_uidx;
DROP INDEX IF EXISTS employee_allowances_dir_key_uidx;
DROP INDEX IF EXISTS employee_allowances_office_key_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS employee_other_deductions_dir_cutoff_key_uidx
  ON public.employee_other_deductions (cutoff_period_id, directory_employee_id, deduction_key)
  WHERE directory_employee_id IS NOT NULL AND cutoff_period_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_other_deductions_office_cutoff_key_uidx
  ON public.employee_other_deductions (cutoff_period_id, office_employee_id, deduction_key)
  WHERE office_employee_id IS NOT NULL
    AND directory_employee_id IS NULL
    AND cutoff_period_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_allowances_dir_cutoff_key_uidx
  ON public.employee_allowances (cutoff_period_id, directory_employee_id, allowance_key)
  WHERE directory_employee_id IS NOT NULL AND cutoff_period_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_allowances_office_cutoff_key_uidx
  ON public.employee_allowances (cutoff_period_id, office_employee_id, allowance_key)
  WHERE office_employee_id IS NOT NULL
    AND directory_employee_id IS NULL
    AND cutoff_period_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_other_deductions_cutoff_idx
  ON public.employee_other_deductions (cutoff_period_id)
  WHERE is_active = true AND cutoff_period_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_allowances_cutoff_idx
  ON public.employee_allowances (cutoff_period_id)
  WHERE is_active = true AND cutoff_period_id IS NOT NULL;

COMMENT ON COLUMN public.employee_other_deductions.cutoff_period_id IS
  'Cutoff this amount applies to; register build only loads matching cutoff_period_id';

COMMENT ON COLUMN public.employee_allowances.cutoff_period_id IS
  'Cutoff this amount applies to; register build only loads matching cutoff_period_id';

COMMENT ON TABLE public.employee_other_deductions IS
  'Itemized other deductions scoped to a cutoff payroll run';

COMMENT ON TABLE public.employee_allowances IS
  'TL / Load / Supervisory allowances scoped to a cutoff payroll run';
