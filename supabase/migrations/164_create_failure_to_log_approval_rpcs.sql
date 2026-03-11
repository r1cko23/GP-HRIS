-- =====================================================
-- 164: Failure-to-log approval/rejection RPCs
--  - Used by app/failure-to-log-approval/page.tsx
--  - Updates failure_to_log status and (optionally) linked time_clock_entries
-- =====================================================

CREATE OR REPLACE FUNCTION public.approve_failure_to_log(
  p_request_id UUID,
  p_correct_clock_in_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_correct_clock_out_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_req
  FROM public.failure_to_log
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failure-to-log request not found';
  END IF;

  IF v_req.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  -- Update linked time entry if present
  IF v_req.time_entry_id IS NOT NULL THEN
    UPDATE public.time_clock_entries
    SET
      clock_in_time = COALESCE(p_correct_clock_in_time, clock_in_time),
      clock_out_time = COALESCE(p_correct_clock_out_time, clock_out_time),
      status = 'approved',
      approved_by = v_user_id,
      approved_at = v_now,
      updated_at = v_now
    WHERE id = v_req.time_entry_id;
  END IF;

  UPDATE public.failure_to_log
  SET
    status = 'approved',
    account_manager_id = v_user_id,
    approved_at = v_now,
    updated_at = v_now
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_failure_to_log(
  p_request_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_req
  FROM public.failure_to_log
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failure-to-log request not found';
  END IF;

  IF v_req.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  UPDATE public.failure_to_log
  SET
    status = 'rejected',
    account_manager_id = v_user_id,
    rejection_reason = NULLIF(TRIM(p_reason), ''),
    updated_at = v_now
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_failure_to_log(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_failure_to_log(UUID, TEXT) TO authenticated;
