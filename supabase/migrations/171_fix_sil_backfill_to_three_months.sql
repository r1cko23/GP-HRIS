-- =====================================================
-- 171: Correct SIL backfill to ensure 3 months earned (Jan–Mar 2026)
-- =====================================================
-- Goal:
-- - By March 2026, each employee in balance year 2026 should have earned
--   3 monthly SIL slices (3 × 10/12 ≈ 2.5 days), regardless of usage.
-- - Remaining balance should be:
--     sil_credits = max(0, target_earned - sil_days_used)
--   but we only ever *add* credits; if someone is already at/above target,
--   we leave their balance unchanged.
--
-- Implementation:
-- - For each employee with sil_balance_year = 2026:
--     current_earned = sil_credits + sil_days_used
--     target_earned  = 3 * (10/12)
--     delta          = GREATEST(0, target_earned - current_earned)
--     sil_credits   := LEAST(10, sil_credits + delta)
--
-- Examples:
-- - No usage, 0.83 credits now:
--     current_earned = 0.83
--     target_earned  = 2.5
--     delta ≈ 1.67 → final sil_credits ≈ 2.5
-- - Used 1 day, 0.83 credits now (like April Gammad):
--     current_earned = 1.83
--     target_earned  = 2.5
--     delta ≈ 0.67 → final sil_credits ≈ 1.5
-- =====================================================

DO $$
DECLARE
  v_month_accrual NUMERIC := 10.0 / 12.0; -- 0.8333...
  v_target_earned NUMERIC := 3 * (10.0 / 12.0); -- 3 months worth ≈ 2.5
BEGIN
  UPDATE public.employees e
  SET sil_credits = LEAST(
        10,
        COALESCE(e.sil_credits, 0)
        + GREATEST(
            0,
            v_target_earned - (COALESCE(e.sil_credits, 0) + COALESCE(e.sil_days_used, 0))
          )
      )
  WHERE e.sil_balance_year = 2026;
END;
$$;

