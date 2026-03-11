-- =====================================================
-- 163: get_my_failure_to_log_requests RPC for employee portal
-- =====================================================
-- Problem:
-- - Employee portal uses anon Supabase client (no auth.uid()).
-- - Direct SELECTs sometimes behave inconsistently under RLS / env differences.
-- - Other employee-portal pages already use SECURITY DEFINER RPCs
--   (e.g. get_my_leave_requests) to return only that employee's rows.
--
-- Solution:
-- - Expose a stable RPC that:
--   * Accepts employee UUID (employees.id)
--   * Returns only that employee's failure_to_log rows
--   * Orders by created_at DESC
--   * Bypasses auth.uid()-based RLS via SECURITY DEFINER
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_my_failure_to_log_requests(
  p_employee_uuid UUID
)
RETURNS SETOF public.failure_to_log
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.failure_to_log
  WHERE employee_id = p_employee_uuid
  ORDER BY created_at DESC;
$$;

COMMENT ON FUNCTION public.get_my_failure_to_log_requests(UUID) IS
  'Employee portal: returns failure_to_log rows for a single employee (by employees.id), ordered by created_at DESC.';

GRANT EXECUTE ON FUNCTION public.get_my_failure_to_log_requests(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_failure_to_log_requests(UUID) TO authenticated;

