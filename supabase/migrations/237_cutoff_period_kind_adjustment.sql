-- Hours-based Adjustment cutoffs (ADR 0017).
-- Allow an adjustment period to share dates with its posted regular source.

ALTER TABLE public.cutoff_periods
  ADD COLUMN IF NOT EXISTS period_kind TEXT NOT NULL DEFAULT 'regular';

ALTER TABLE public.cutoff_periods
  ADD COLUMN IF NOT EXISTS source_cutoff_period_id UUID
    REFERENCES public.cutoff_periods (id) ON DELETE SET NULL;

ALTER TABLE public.cutoff_periods
  DROP CONSTRAINT IF EXISTS cutoff_periods_period_kind_check;

ALTER TABLE public.cutoff_periods
  ADD CONSTRAINT cutoff_periods_period_kind_check
  CHECK (period_kind IN ('regular', 'adjustment'));

ALTER TABLE public.cutoff_periods
  DROP CONSTRAINT IF EXISTS cutoff_periods_adjustment_source_check;

ALTER TABLE public.cutoff_periods
  ADD CONSTRAINT cutoff_periods_adjustment_source_check
  CHECK (
    (period_kind = 'regular' AND source_cutoff_period_id IS NULL)
    OR (period_kind = 'adjustment' AND source_cutoff_period_id IS NOT NULL)
  );

ALTER TABLE public.cutoff_periods
  DROP CONSTRAINT IF EXISTS cutoff_periods_org_client_dates_key;

ALTER TABLE public.cutoff_periods
  ADD CONSTRAINT cutoff_periods_org_client_dates_kind_key UNIQUE (
    organization_id,
    client_id,
    period_start,
    period_end,
    period_kind
  );

CREATE INDEX IF NOT EXISTS cutoff_periods_source_cutoff_idx
  ON public.cutoff_periods (source_cutoff_period_id)
  WHERE source_cutoff_period_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cutoff_periods_period_kind_idx
  ON public.cutoff_periods (organization_id, period_kind, period_start DESC);

COMMENT ON COLUMN public.cutoff_periods.period_kind IS
  'regular = normal kinsena; adjustment = hours-based correction run for a posted source (ADR 0017)';

COMMENT ON COLUMN public.cutoff_periods.source_cutoff_period_id IS
  'Posted regular cutoff this adjustment corrects; required when period_kind = adjustment';

NOTIFY pgrst, 'reload schema';
