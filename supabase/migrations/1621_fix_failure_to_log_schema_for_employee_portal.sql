-- =====================================================
-- 162: Fix failure_to_log schema for employee portal
--  - Allow nullable time_entry_id (employee may not have an entry to link)
--  - Support missing clock IN / OUT / BOTH (actual_clock_in_time, actual_clock_out_time, entry_type)
--  - Allow cancelled status from employee portal
--  - Allow nullable missed_date (admin screen filters handle nulls)
-- =====================================================

ALTER TABLE public.failure_to_log
  ALTER COLUMN time_entry_id DROP NOT NULL;

ALTER TABLE public.failure_to_log
  ALTER COLUMN missed_date DROP NOT NULL;

ALTER TABLE public.failure_to_log
  ALTER COLUMN actual_clock_out_time DROP NOT NULL;

ALTER TABLE public.failure_to_log
  ADD COLUMN IF NOT EXISTS actual_clock_in_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.failure_to_log
  ADD COLUMN IF NOT EXISTS manual_notes TEXT;

ALTER TABLE public.failure_to_log
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'out';

ALTER TABLE public.failure_to_log
  DROP CONSTRAINT IF EXISTS failure_to_log_status_check;

ALTER TABLE public.failure_to_log
  ADD CONSTRAINT failure_to_log_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE public.failure_to_log
  DROP CONSTRAINT IF EXISTS failure_to_log_entry_type_check;

ALTER TABLE public.failure_to_log
  ADD CONSTRAINT failure_to_log_entry_type_check
  CHECK (entry_type IN ('in', 'out', 'both'));

CREATE INDEX IF NOT EXISTS idx_failure_to_log_entry_type ON public.failure_to_log(entry_type);
