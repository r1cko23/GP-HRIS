-- =====================================================
-- 167: Fix SIL entitlement to fixed yearly cap (10 days)
-- =====================================================
-- Goal:
-- - Employees are entitled to a full 10 SIL days per year.
-- - Using SIL should reduce only the *balance* (sil_credits) and tracked usage (sil_days_used),
--   but should NOT reduce the yearly entitlement itself.
-- - UI can show:
--     - sil_allotted: fixed yearly entitlement (10)
--     - sil_credits: remaining balance after usage + accrual
--     - sil_days_used: total used this year
--
-- Current state from migration 165:
-- - sil_allotted is a GENERATED column: (10 - sil_days_used)
--   so it goes down as days are used, which is confusing for entitlement.
--
-- This migration:
-- - Converts sil_allotted into a regular numeric column with default 10
-- - Backfills all rows to 10 (entitlement) while keeping sil_days_used and sil_credits unchanged
-- - Updates comments to reflect fixed entitlement semantics
-- =====================================================

DO $$
BEGIN
  -- If sil_allotted is still a generated column, drop the expression to make it regular.
  BEGIN
    ALTER TABLE public.employees
      ALTER COLUMN sil_allotted DROP EXPRESSION;
  EXCEPTION
    WHEN undefined_column THEN
      -- Column might not exist yet; ignore in that case.
      NULL;
    WHEN feature_not_supported THEN
      -- For older Postgres versions without DROP EXPRESSION support,
      -- fall back to drop+recreate pattern.
      BEGIN
        ALTER TABLE public.employees
          DROP COLUMN IF EXISTS sil_allotted;
        ALTER TABLE public.employees
          ADD COLUMN sil_allotted NUMERIC;
      EXCEPTION
        WHEN duplicate_column THEN
          NULL;
      END;
  END;

  -- Ensure column exists as a regular numeric column
  BEGIN
    ALTER TABLE public.employees
      ADD COLUMN sil_allotted NUMERIC;
  EXCEPTION
    WHEN duplicate_column THEN
      NULL;
  END;

  -- Set default yearly entitlement to 10 days
  ALTER TABLE public.employees
    ALTER COLUMN sil_allotted SET DEFAULT 10;

  -- Backfill existing rows: keep their current balance/usage,
  -- but reset entitlement to 10 (companies can override per-employee later if needed).
  UPDATE public.employees
  SET sil_allotted = 10
  WHERE sil_allotted IS NULL
     OR sil_allotted <> 10;

  -- Update comment to reflect fixed entitlement
  COMMENT ON COLUMN public.employees.sil_allotted IS
    'SIL days allotted for the year (fixed yearly entitlement, typically 10 days). Usage only affects sil_credits and sil_days_used, not this cap.';

  COMMENT ON COLUMN public.employees.sil_days_used IS
    'Cumulative SIL days used in the current balance year; reset on year change. Does not reduce yearly entitlement (sil_allotted).';
END;
$$;

