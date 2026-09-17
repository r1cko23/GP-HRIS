-- Adjustment cutoffs must share dates with their posted regular source.
-- Migration 237 updated the table UNIQUE to include period_kind, but left
-- branch/unbranched partial unique indexes that still exclude period_kind —
-- so Open adjustment collided with the regular row (23505).

DROP INDEX IF EXISTS public.cutoff_periods_org_client_branch_dates_key;
CREATE UNIQUE INDEX cutoff_periods_org_client_branch_dates_kind_key
  ON public.cutoff_periods (
    organization_id,
    client_id,
    branch_id,
    period_start,
    period_end,
    period_kind
  )
  WHERE branch_id IS NOT NULL;

DROP INDEX IF EXISTS public.cutoff_periods_org_client_unbranched_dates_key;
CREATE UNIQUE INDEX cutoff_periods_org_client_unbranched_dates_kind_key
  ON public.cutoff_periods (
    organization_id,
    client_id,
    period_start,
    period_end,
    period_kind
  )
  WHERE branch_id IS NULL;

COMMENT ON INDEX public.cutoff_periods_org_client_branch_dates_kind_key IS
  'One regular + one adjustment per client/branch/dates (ADR 0017)';

NOTIFY pgrst, 'reload schema';
