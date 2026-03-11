-- =====================================================
-- 166: Pre-anniversary SIL monthly catch-up on hire-date
--  - Before 1-year anniversary, employees should accrue
--    10/12 (~0.83) per month on the hire-date day.
--  - This migration updates refresh_employee_leave_balances
--    so that missed pre-anniversary months in the current year
--    are caught up based on hire date (no carryover across years).
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
  v_first_anniv DATE;
  v_month_accrual NUMERIC := 10.0 / 12.0;
  v_year_start DATE := date_trunc('year', v_today)::date;
  v_hire_day INT;
  v_next_accrual_date DATE;
  v_month_anchor DATE := date_trunc('month', v_today)::date;
  v_last_anchor DATE;
  v_months_to_accrue INT;
  v_cursor DATE;
  v_accrual_date DATE;
BEGIN
  SELECT *
  INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Reset credits on year change
  IF v_emp.sil_balance_year IS DISTINCT FROM v_current_year THEN
    v_emp.sil_credits := 0;
    v_emp.sil_last_accrual := NULL;
    v_emp.sil_balance_year := v_current_year;
    v_emp.sil_days_used := 0;
  END IF;

  v_emp.sil_credits := COALESCE(v_emp.sil_credits, 0);

  IF v_emp.hire_date IS NOT NULL AND v_emp.hire_date <= v_today THEN
    v_first_anniv := (v_emp.hire_date + INTERVAL '1 year')::date;
    v_hire_day := EXTRACT(DAY FROM v_emp.hire_date)::int;

    IF v_today < v_first_anniv THEN
      -- Before 1-year anniversary:
      -- Accrue 10/12 per month on the hire-date day, with CATCH-UP
      -- for all eligible months in the current balance year up to today.

      -- Determine starting month cursor based on last accrual and year start
      IF v_emp.sil_last_accrual IS NULL OR v_emp.sil_last_accrual < v_year_start THEN
        v_cursor := GREATEST(v_year_start, date_trunc('month', v_emp.hire_date)::date);
      ELSE
        v_cursor := (date_trunc('month', v_emp.sil_last_accrual)::date + INTERVAL '1 month')::date;
      END IF;

      -- Only consider months before the first anniversary
      WHILE v_cursor < v_first_anniv AND v_cursor <= v_today LOOP
        -- Target accrual date in this month is hire-day; clamp to month end if needed
        v_accrual_date := (v_cursor + (v_hire_day - 1) * INTERVAL '1 day')::date;
        IF EXTRACT(MONTH FROM v_accrual_date) <> EXTRACT(MONTH FROM v_cursor) THEN
          v_accrual_date := (date_trunc('month', v_cursor) + INTERVAL '1 month - 1 day')::date;
        END IF;

        -- Only accrue if:
        -- - accrual date is within the current balance year
        -- - on or before today
        -- - not before actual hire date
        -- - strictly after the last accrual date
        IF v_accrual_date >= v_year_start
           AND v_accrual_date <= v_today
           AND v_accrual_date >= v_emp.hire_date
           AND (v_emp.sil_last_accrual IS NULL OR v_accrual_date > v_emp.sil_last_accrual)
        THEN
          v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_month_accrual);
          v_emp.sil_last_accrual := v_accrual_date;
        END IF;

        v_cursor := (date_trunc('month', v_cursor) + INTERVAL '1 month')::date;
      END LOOP;

    ELSE
      -- After 1-year anniversary: accrue on the 1st of each month, CATCHING UP within current year.
      -- Determine the "last credited month anchor" (month boundary).
      IF v_emp.sil_last_accrual IS NULL OR v_emp.sil_last_accrual < v_year_start THEN
        -- Treat as if last credit happened one month before year start, so January counts.
        v_last_anchor := (v_year_start - INTERVAL '1 month')::date;
      ELSIF v_emp.sil_last_accrual < v_first_anniv THEN
        -- Just crossed anniversary: first eligible credit is the 1st of next month after anniversary.
        -- So set last anchor to the anniversary month, and the diff will start accruing from next month.
        v_last_anchor := date_trunc('month', v_first_anniv)::date;
      ELSE
        v_last_anchor := date_trunc('month', v_emp.sil_last_accrual)::date;
      END IF;

      v_months_to_accrue :=
        (EXTRACT(YEAR FROM v_month_anchor)::int - EXTRACT(YEAR FROM v_last_anchor)::int) * 12
        + (EXTRACT(MONTH FROM v_month_anchor)::int - EXTRACT(MONTH FROM v_last_anchor)::int);

      v_months_to_accrue := GREATEST(0, v_months_to_accrue);

      IF v_months_to_accrue > 0 THEN
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + (v_months_to_accrue * v_month_accrual));
        v_emp.sil_last_accrual := v_month_anchor;
      END IF;
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

