-- Freeze pay channel on the register line (hours already have rate_snapshot).
-- Exports prefer these over live Directory after profile edits.

ALTER TABLE public.payroll_register_lines
  ADD COLUMN IF NOT EXISTS pay_through TEXT,
  ADD COLUMN IF NOT EXISTS gcash TEXT;

NOTIFY pgrst, 'reload schema';
