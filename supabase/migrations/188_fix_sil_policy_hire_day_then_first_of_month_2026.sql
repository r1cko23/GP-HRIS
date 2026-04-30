-- =====================================================
-- 188: SIL policy fix (hire-day accrual <1yr, 1st-of-month >=1yr) for 2026+
-- =====================================================
-- Policy (per user clarification):
-- - Accrual starts one month after hire:
--     hired Apr 30 -> +0.83 on May 30 (same year)
-- - While tenure < 1 year:
--     accrue 10/12 (~0.83) on the hire-day each month (clamped to month-end)
-- - Once tenure reaches 1 year (on/after first anniversary date):
--     accrue 10/12 (~0.83) every 1st of the month (catch-up within current year)
--     Transition rule:
--       - If anniversary is on the 1st, that month counts (accrue on that day).
--       - Otherwise, first "1st-of-month" accrual is the 1st of the next month.
-- - Reset at end/start of each calendar year:
--     sil_credits -> 0, sil_last_accrual -> NULL, sil_days_used -> 0, sil_balance_year -> current year
--
-- Implementation notes:
-- - We compute accrual based on "earned" = sil_credits + sil_days_used so usage doesn't break catch-up.
-- - We only ever add to sil_credits here (deductions are handled elsewhere by triggers).
-- - Cap yearly earned at 10.
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
  v_month_accrual NUMERIC := 10.0 / 12.0; -- 0.8333...
  v_first_anniv DATE;

  -- Pre-anniversary counting (hire-day accrual)
  v_hire_day INT;
  v_cursor DATE;
  v_accrual_date DATE;
  v_pre_months INT := 0;

  -- Post-anniversary counting (1st-of-month accrual)
  v_month_anchor DATE := date_trunc('month', v_today)::date; -- 1st of current month
  v_post_start DATE;
  v_post_months INT := 0;

  -- Delta application
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

  -- Reset on year change (credits do not carry over)
  IF v_emp.sil_balance_year IS DISTINCT FROM v_current_year THEN
    v_emp.sil_credits := 0;
    v_emp.sil_last_accrual := NULL;
    v_emp.sil_balance_year := v_current_year;
    v_emp.sil_days_used := 0;
  END IF;

  v_emp.sil_credits := COALESCE(v_emp.sil_credits, 0);
  v_emp.sil_days_used := COALESCE(v_emp.sil_days_used, 0);

  IF v_emp.hire_date IS NOT NULL AND v_emp.hire_date <= v_today THEN
    v_first_anniv := (v_emp.hire_date + INTERVAL '1 year')::date;
    v_hire_day := EXTRACT(DAY FROM v_emp.hire_date)::int;

    IF v_today < v_first_anniv THEN
      -- =================================================
      -- PRE-ANNIVERSARY: accrue on hire-day each month
      -- =================================================
      -- Count how many monthly accrual events should have happened in the current year up to today.
      -- First eligible month is the hire month; but the accrual date in that month equals hire_date,
      -- which is excluded because we require accrual_date > hire_date.
      v_cursor := GREATEST(v_year_start, date_trunc('month', v_emp.hire_date)::date);

      WHILE v_cursor < v_first_anniv AND v_cursor <= v_today LOOP
        -- Compute hire-day in this month; clamp to month-end if hire day doesn't exist.
        v_accrual_date := (v_cursor + (v_hire_day - 1) * INTERVAL '1 day')::date;
        IF EXTRACT(MONTH FROM v_accrual_date) <> EXTRACT(MONTH FROM v_cursor) THEN
          v_accrual_date := (date_trunc('month', v_cursor) + INTERVAL '1 month - 1 day')::date;
        END IF;

        IF v_accrual_date >= v_year_start
           AND v_accrual_date <= v_today
           AND v_accrual_date > v_emp.hire_date
           AND v_accrual_date < v_first_anniv
        THEN
          v_pre_months := v_pre_months + 1;
        END IF;

        v_cursor := (date_trunc('month', v_cursor) + INTERVAL '1 month')::date;
      END LOOP;

      v_target_earned := LEAST(10, v_pre_months * v_month_accrual);
      v_current_earned := LEAST(10, v_emp.sil_credits + v_emp.sil_days_used);
      v_delta := GREATEST(0, v_target_earned - v_current_earned);

      IF v_delta > 0 THEN
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_delta);
      END IF;

      -- Mark last accrual as "last eligible accrual date" for traceability
      -- (use current date to avoid accidentally skipping future accruals).
      IF v_pre_months > 0 THEN
        v_emp.sil_last_accrual := v_today;
      END IF;

    ELSE
      -- =================================================
      -- POST-ANNIVERSARY: accrue on 1st of each month
      -- =================================================
      -- Determine first eligible 1st-of-month accrual date.
      IF EXTRACT(DAY FROM v_first_anniv)::int = 1 THEN
        v_post_start := v_first_anniv; -- anniversary itself is a 1st
      ELSE
        v_post_start := (date_trunc('month', v_first_anniv)::date + INTERVAL '1 month')::date; -- next month 1st
      END IF;

      v_post_start := GREATEST(v_year_start, v_post_start);

      IF v_post_start <= v_month_anchor THEN
        v_post_months :=
          (EXTRACT(YEAR FROM v_month_anchor)::int - EXTRACT(YEAR FROM v_post_start)::int) * 12
          + (EXTRACT(MONTH FROM v_month_anchor)::int - EXTRACT(MONTH FROM v_post_start)::int)
          + 1;
        v_post_months := GREATEST(0, v_post_months);
      ELSE
        v_post_months := 0;
      END IF;

      v_target_earned := LEAST(10, v_post_months * v_month_accrual);
      v_current_earned := LEAST(10, v_emp.sil_credits + v_emp.sil_days_used);
      v_delta := GREATEST(0, v_target_earned - v_current_earned);

      IF v_delta > 0 THEN
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_delta);
      END IF;

      -- Record month anchor so subsequent calls are stable for the month.
      v_emp.sil_last_accrual := v_month_anchor;
    END IF;
  END IF;

  v_emp.maternity_credits := CASE WHEN v_emp.gender = 'female' THEN 105 ELSE 0 END;
  v_emp.paternity_credits := CASE WHEN v_emp.gender = 'male' THEN COALESCE(v_emp.paternity_credits, 0) ELSE 0 END;

  UPDATE public.employees
  SET
    sil_credits = COALESCE(v_emp.sil_credits, 0),
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

