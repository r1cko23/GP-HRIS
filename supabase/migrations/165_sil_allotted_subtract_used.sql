-- =====================================================
-- 165: Subtract used SIL from allotted (no hardcoded 10 in UI)
--  - sil_days_used: cumulative SIL days used in current year
--  - sil_allotted: generated as (year_cap - sil_days_used), so allotted goes down when used
--  - Trigger and refresh_employee_leave_balances updated; approve_leave_request no longer
--    updates sil_credits (trigger does it, avoiding double-deduction)
-- =====================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS sil_days_used NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.employees.sil_days_used IS 'Cumulative SIL days used in the current balance year; reset on year change.';

-- Yearly SIL entitlement column (fixed cap, typically 10 days per year)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS sil_allotted NUMERIC DEFAULT 10;

COMMENT ON COLUMN public.employees.sil_allotted IS 'SIL days allotted for the year (fixed yearly entitlement, typically 10 days).';

-- Trigger: deduct sil_credits AND add to sil_days_used on approve; restore both on reject/cancel
CREATE OR REPLACE FUNCTION public.deduct_sil_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved_by_hr'
     AND OLD.status IS DISTINCT FROM 'approved_by_hr'
     AND NEW.leave_type = 'SIL' THEN
    UPDATE public.employees
    SET sil_credits = GREATEST(0, COALESCE(sil_credits, 0) - NEW.total_days),
        sil_days_used = COALESCE(sil_days_used, 0) + NEW.total_days
    WHERE id = NEW.employee_id;
  END IF;

  IF NEW.status IN ('rejected', 'cancelled')
     AND OLD.status = 'approved_by_hr'
     AND NEW.leave_type = 'SIL' THEN
    UPDATE public.employees
    SET sil_credits = COALESCE(sil_credits, 0) + OLD.total_days,
        sil_days_used = GREATEST(0, COALESCE(sil_days_used, 0) - OLD.total_days)
    WHERE id = NEW.employee_id;
  END IF;

  RETURN NEW;
END;
$$;

-- refresh_employee_leave_balances: reset sil_days_used on year change
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
      IF v_emp.sil_last_accrual IS NULL OR v_emp.sil_last_accrual < v_year_start THEN
        v_last_anchor := (v_year_start - INTERVAL '1 month')::date;
      ELSIF v_emp.sil_last_accrual < v_first_anniv THEN
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

-- approve_leave_request: stop updating sil_credits here (trigger deduct_sil_credits does it)
CREATE OR REPLACE FUNCTION public.approve_leave_request(p_request_id UUID, p_level TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.leave_requests;
  v_role TEXT;
  v_user_id UUID;
  v_employee_group_id UUID;
  v_employee_approver_id UUID;
  v_group_approver_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_effective_level TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT role INTO v_role
  FROM public.users
  WHERE id = v_user_id AND is_active = true;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User role not found or user is inactive. User ID: %', v_user_id;
  END IF;

  IF p_level NOT IN ('manager', 'hr') THEN
    RAISE EXCEPTION 'Invalid approval level. Must be "manager" or "hr"';
  END IF;

  SELECT * INTO v_req
  FROM public.leave_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id;
  END IF;

  IF v_req.status IN ('approved_by_hr', 'rejected', 'cancelled') THEN
    RETURN;
  END IF;

  v_effective_level := p_level;

  IF v_role = 'admin' THEN
    v_is_authorized := TRUE;
  ELSIF v_role = 'hr' THEN
    IF v_req.status = 'approved_by_manager' AND p_level = 'hr' THEN
      v_is_authorized := TRUE;
      v_effective_level := 'hr';
    ELSE
      SELECT e.overtime_group_id, e.overtime_approver_id
        INTO v_employee_group_id, v_employee_approver_id
      FROM public.employees e
      WHERE e.id = v_req.employee_id;
      IF v_employee_approver_id = v_user_id THEN
        v_is_authorized := TRUE;
      ELSIF v_employee_group_id IS NOT NULL THEN
        SELECT og.approver_id INTO v_group_approver_id
        FROM public.overtime_groups og
        WHERE og.id = v_employee_group_id;
        IF v_group_approver_id = v_user_id THEN
          v_is_authorized := TRUE;
        END IF;
      END IF;
      IF v_is_authorized THEN
        IF v_req.status = 'pending' THEN
          v_effective_level := 'manager';
        ELSE
          v_effective_level := 'hr';
        END IF;
      END IF;
    END IF;
    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'You do not have permission to approve leave requests for this employee';
    END IF;
  ELSIF v_role = 'approver' THEN
    SELECT e.overtime_group_id, e.overtime_approver_id
      INTO v_employee_group_id, v_employee_approver_id
    FROM public.employees e
    WHERE e.id = v_req.employee_id;
    IF v_employee_approver_id = v_user_id THEN
      v_is_authorized := TRUE;
    ELSIF v_employee_group_id IS NOT NULL THEN
      SELECT og.approver_id INTO v_group_approver_id
      FROM public.overtime_groups og
      WHERE og.id = v_employee_group_id;
      IF v_group_approver_id = v_user_id THEN
        v_is_authorized := TRUE;
      END IF;
    END IF;
    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'You do not have permission to approve leave requests for this employee';
    END IF;
    v_effective_level := 'manager';
  ELSE
    RAISE EXCEPTION 'Only admins, HR, and approvers can approve leave requests. Current role: %', v_role;
  END IF;

  IF v_effective_level = 'manager' THEN
    IF v_req.status <> 'pending' THEN
      RAISE EXCEPTION 'Manager-level approval requires pending status. Current status: %', v_req.status;
    END IF;
    UPDATE public.leave_requests
    SET status = 'approved_by_manager',
        account_manager_id = v_user_id,
        account_manager_approved_at = NOW()
    WHERE id = p_request_id;
  ELSE
    IF v_req.status <> 'approved_by_manager' THEN
      RAISE EXCEPTION 'HR-level approval requires approved_by_manager status. Current status: %', v_req.status;
    END IF;
    UPDATE public.leave_requests
    SET status = 'approved_by_hr',
        hr_approved_by = v_user_id,
        hr_approved_at = NOW()
    WHERE id = p_request_id;
  END IF;
END;
$$;

-- RPC: get_employee_leave_credits - now also returns sil_allotted (year cap minus used)
DROP FUNCTION IF EXISTS public.get_employee_leave_credits(UUID);

CREATE FUNCTION public.get_employee_leave_credits(p_employee_uuid UUID)
RETURNS TABLE (
  sil_credits NUMERIC,
  maternity_credits NUMERIC,
  paternity_credits NUMERIC,
  sil_allotted NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure balances are refreshed before reading
  PERFORM public.refresh_employee_leave_balances(p_employee_uuid);

  RETURN QUERY
  SELECT
    COALESCE(e.sil_credits, 0) AS sil_credits,
    COALESCE(e.maternity_credits, 0) AS maternity_credits,
    COALESCE(e.paternity_credits, 0) AS paternity_credits,
    COALESCE(e.sil_allotted, 0) AS sil_allotted
  FROM public.employees e
  WHERE e.id = p_employee_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_leave_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_credits(UUID) TO anon;

COMMENT ON FUNCTION public.get_employee_leave_credits(UUID) IS
  'Returns current SIL/maternity/paternity credits and SIL allotted (year cap minus used). Calls refresh_employee_leave_balances() before reading.';
