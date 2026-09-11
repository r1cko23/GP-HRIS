-- Same person at two GP-Client outlets is two billing lines.
-- Unique hours row: period + person + position + outlet (ADR 0014 + outlet).

ALTER TABLE public.cutoff_hours
  ADD COLUMN IF NOT EXISTS outlet TEXT;

ALTER TABLE public.cutoff_hours
  DROP CONSTRAINT IF EXISTS cutoff_hours_period_employee_position_key;

ALTER TABLE public.cutoff_hours
  ADD CONSTRAINT cutoff_hours_period_employee_position_outlet_key
  UNIQUE NULLS NOT DISTINCT (
    cutoff_period_id,
    directory_employee_id,
    position_id,
    outlet
  );

COMMENT ON COLUMN public.cutoff_hours.outlet IS
  'GP-Client timesheet outlet / cost center. Same person, different outlets stay separate for billing.';

COMMENT ON CONSTRAINT cutoff_hours_period_employee_position_outlet_key
  ON public.cutoff_hours IS
  'One hours row per person per position per outlet per cutoff.';
