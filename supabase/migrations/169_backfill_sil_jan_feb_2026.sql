-- =====================================================
-- 169: Backfill SIL accrual for Jan & Feb 2026
-- =====================================================
-- Context:
-- - SIL yearly entitlement is 10 days, accrued monthly at 10/12 ≈ 0.8333.
-- - For 2026, employees should effectively have ~2.49 days earned by end of Feb
--   (3 monthly slices including March when run), assuming no prior manual fixes.
-- - Some employees currently show only a single monthly accrual (≈0.83).
--
-- One-off fix:
-- - Add two months worth of accrual (2 × 10/12) to sil_credits for all employees
--   whose current balance year is 2026, capping at 10 days.
-- - We do NOT touch sil_days_used or sil_allotted; this strictly increases the
--   available balance to reflect the missing Jan/Feb accruals.
-- =====================================================

DO $$
DECLARE
  v_month_accrual NUMERIC := 10.0 / 12.0; -- 0.8333...
BEGIN
  UPDATE public.employees
  SET sil_credits = LEAST(10, COALESCE(sil_credits, 0) + (v_month_accrual * 2))
  WHERE sil_balance_year = 2026;
END;
$$;

