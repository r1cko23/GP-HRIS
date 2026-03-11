-- =====================================================
-- 168: Include sil_days_used in get_employee_leave_credits
-- =====================================================
-- Goal:
-- - Expose not just entitlement (sil_allotted) and balance (sil_credits),
--   but also how many SIL days have been used this year (sil_days_used),
--   so the employee portal can display "used X out of 10".
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_employee_leave_credits(p_employee_uuid UUID)
RETURNS TABLE (
  sil_credits NUMERIC,
  maternity_credits NUMERIC,
  paternity_credits NUMERIC,
  sil_allotted NUMERIC,
  sil_days_used NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure balances are refreshed before reading (keeps sil_credits up to date)
  PERFORM public.refresh_employee_leave_balances(p_employee_uuid);

  RETURN QUERY
  SELECT
    COALESCE(e.sil_credits, 0) AS sil_credits,
    COALESCE(e.maternity_credits, 0) AS maternity_credits,
    COALESCE(e.paternity_credits, 0) AS paternity_credits,
    COALESCE(e.sil_allotted, 0) AS sil_allotted,
    COALESCE(e.sil_days_used, 0) AS sil_days_used
  FROM public.employees e
  WHERE e.id = p_employee_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_leave_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_credits(UUID) TO anon;

COMMENT ON FUNCTION public.get_employee_leave_credits(UUID) IS
  'Returns current SIL/maternity/paternity credits plus SIL yearly entitlement (sil_allotted) and SIL days used this year (sil_days_used). Calls refresh_employee_leave_balances() before reading.';

