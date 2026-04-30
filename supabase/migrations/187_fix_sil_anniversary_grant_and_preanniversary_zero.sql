-- =====================================================
-- 187: Fix SIL logic to match policy (no pre-anniversary accrual)
-- =====================================================
-- Policy (per docs/guides/SIL_CREDITING_LOGIC_DETAILED.md):
-- - < 1 year since hire date: 0 SIL (no accrual)
-- - In the year of first anniversary: one-time grant of 10 SIL (usable until Dec 31)
-- - After first anniversary year: monthly accrual of 10/12 each month within the year, capped at 10
-- - Annual reset on year change: sil_credits -> 0, sil_last_accrual -> NULL, sil_days_used -> 0
--
-- Notes:
-- - We compute accrual based on "earned" = sil_credits + sil_days_used so usage doesn't break catch-up.
-- - We keep sil_last_accrual as a marker to avoid re-granting the 10-day anniversary entitlement.
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_employee_leave_balances(p_employee_id UUID)
RETURNS TABLE (
  sil_credits NUMERIC,
  maternity_credits NUMERIC,
  paternity_credits NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp RECORD;
  v_today DATE := CURRENT_DATE;
  v_current_year INT := EXTRACT(YEAR FROM v_today)::int;
  v_year_start DATE := date_trunc('year', v_today)::date;
  v_first_anniv DATE;
  v_month_accrual NUMERIC := 10.0 / 12.0; -- 0.8333...
  v_month_anchor DATE := date_trunc('month', v_today)::date; -- 1st of current month
  v_month_index INT;
  v_target_earned NUMERIC;
  v_current_earned NUMERIC;
  v_delta NUMERIC;
BEGIN
  SELECT *
  INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Annual reset on year change
  IF v_emp.sil_balance_year IS DISTINCT FROM v_current_year THEN
    v_emp.sil_credits := 0;
    v_emp.sil_last_accrual := NULL;
    v_emp.sil_balance_year := v_current_year;
    v_emp.sil_days_used := 0;
  END IF;

  v_emp.sil_credits := COALESCE(v_emp.sil_credits, 0);
  v_emp.sil_days_used := COALESCE(v_emp.sil_days_used, 0);

  IF v_emp.hire_date IS NULL OR v_emp.hire_date > v_today THEN
    -- No hire date: never eligible.
    v_emp.sil_credits := 0;
    v_emp.sil_last_accrual := NULL;
  ELSE
    v_first_anniv := (v_emp.hire_date + INTERVAL '1 year')::date;

    IF v_today < v_first_anniv THEN
      -- Pre-anniversary: SIL stays at 0 (no accrual).
      v_emp.sil_credits := 0;
      v_emp.sil_last_accrual := NULL;
    ELSIF EXTRACT(YEAR FROM v_first_anniv)::int = v_current_year THEN
      -- Anniversary year: one-time full 10-day grant (remaining = 10 - used).
      IF v_emp.sil_last_accrual IS NULL OR v_emp.sil_last_accrual < v_first_anniv THEN
        v_emp.sil_credits := GREATEST(0, 10 - v_emp.sil_days_used);
        v_emp.sil_last_accrual := v_today;
      END IF;
    ELSE
      -- Subsequent years: monthly accrual (Jan..current month), catch-up within the year.
      -- By March, earned should be 3 * (10/12). By December, earned caps at 10.
      v_month_index :=
        (EXTRACT(YEAR FROM v_month_anchor)::int - EXTRACT(YEAR FROM v_year_start)::int) * 12
        + (EXTRACT(MONTH FROM v_month_anchor)::int - EXTRACT(MONTH FROM v_year_start)::int)
        + 1;

      v_target_earned := LEAST(10, v_month_index * v_month_accrual);
      v_current_earned := LEAST(10, v_emp.sil_credits + v_emp.sil_days_used);
      v_delta := GREATEST(0, v_target_earned - v_current_earned);

      IF v_delta > 0 THEN
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_delta);
      END IF;

      -- Mark that we've processed through this month's anchor.
      v_emp.sil_last_accrual := v_month_anchor;
    END IF;
  END IF;

  v_emp.maternity_credits := CASE WHEN v_emp.gender = 'female' THEN 105 ELSE 0 END;
  v_emp.paternity_credits := CASE WHEN v_emp.gender = 'male' THEN COALESCE(v_emp.paternity_credits, 0) ELSE 0 END;

  UPDATE public.employees
  SET
    sil_credits = v_emp.sil_credits,
    sil_last_accrual = v_emp.sil_last_accrual,
    sil_balance_year = v_emp.sil_balance_year,
    sil_days_used = COALESCE(v_emp.sil_days_used, 0),
    maternity_credits = v_emp.maternity_credits,
    paternity_credits = v_emp.paternity_credits
  WHERE id = v_emp.id;

  RETURN QUERY
  SELECT
    COALESCE(v_emp.sil_credits, 0),
    COALESCE(v_emp.maternity_credits, 0),
    COALESCE(v_emp.paternity_credits, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO anon;

