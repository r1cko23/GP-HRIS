-- =====================================================
-- 163: Fix SIL accrual to catch up by month
--  - Expected behavior: by March, SIL should be ~0.8333 * 3 (Jan, Feb, Mar)
--  - This updates refresh_employee_leave_balances to accrue ALL missed months
--    within the current year (capped at 10), instead of only one month.
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
  END IF;

  v_emp.sil_credits := COALESCE(v_emp.sil_credits, 0);

  IF v_emp.hire_date IS NOT NULL AND v_emp.hire_date <= v_today THEN
    v_first_anniv := (v_emp.hire_date + INTERVAL '1 year')::date;
    v_hire_day := EXTRACT(DAY FROM v_emp.hire_date)::int;

    IF v_today < v_first_anniv THEN
      -- Before 1-year anniversary: accrue ONCE on hire date day each month (no catch-up)
      IF v_emp.sil_last_accrual IS NULL THEN
        v_next_accrual_date := date_trunc('year', v_today)::date + (v_hire_day - 1) * INTERVAL '1 day';

        IF v_next_accrual_date < v_today THEN
          v_next_accrual_date := date_trunc('month', v_today)::date + INTERVAL '1 month' + (v_hire_day - 1) * INTERVAL '1 day';
        END IF;

        IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
          v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
        END IF;

        IF v_next_accrual_date < v_year_start THEN
          v_next_accrual_date := v_year_start + (v_hire_day - 1) * INTERVAL '1 day';
          IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
            v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
          END IF;
        END IF;
      ELSE
        v_next_accrual_date := date_trunc('month', v_emp.sil_last_accrual)::date + INTERVAL '1 month' + (v_hire_day - 1) * INTERVAL '1 day';
        IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
          v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
        END IF;
      END IF;

      IF v_next_accrual_date <= v_today
        AND v_next_accrual_date < v_first_anniv
        AND v_next_accrual_date >= v_year_start THEN
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_month_accrual);
        v_emp.sil_last_accrual := v_next_accrual_date;
      END IF;
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

CREATE OR REPLACE FUNCTION public.get_employee_leave_credits(p_employee_uuid UUID)
RETURNS TABLE (
  sil_credits NUMERIC,
  maternity_credits NUMERIC,
  paternity_credits NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.refresh_employee_leave_balances(p_employee_uuid);
END;
$$;
