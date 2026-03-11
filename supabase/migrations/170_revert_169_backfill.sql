-- =====================================================
-- 170: Revert 169_backfill_sil_jan_feb_2026 (over-credit)
-- =====================================================
-- Migration 169 blindly added 2 × (10/12) to sil_credits for all employees
-- in balance year 2026. That over-credited employees who had already accrued
-- some months and/or used SIL.
--
-- This migration reverses that change so we can reapply a correct, per-employee
-- backfill in a follow-up migration.
-- =====================================================

DO $$
DECLARE
  v_month_accrual NUMERIC := 10.0 / 12.0; -- 0.8333...
BEGIN
  UPDATE public.employees
  SET sil_credits = GREATEST(0, COALESCE(sil_credits, 0) - (v_month_accrual * 2))
  WHERE sil_balance_year = 2026;
END;
$$;

