-- Who ran payroll: GP poster snapshot, or GREENHRISMAIN payroll_summary.pcreatedby on catalog import.

ALTER TABLE public.payroll_register_runs
  ADD COLUMN IF NOT EXISTS posted_by_name TEXT;

COMMENT ON COLUMN public.payroll_register_runs.posted_by_name IS
  'Display name of who posted/ran payroll. GP user full_name on Organic post; GREENHRISMAIN payroll_summary.pcreatedby on catalog import.';
