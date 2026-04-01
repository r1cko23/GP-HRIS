-- =====================================================
-- 175: Fix employee portal session token UUID function
-- =====================================================
-- In this Supabase project, uuid functions are exposed under the
-- extensions schema. SECURITY DEFINER functions with search_path=public
-- cannot resolve bare uuid_generate_v4().

CREATE OR REPLACE FUNCTION public.issue_employee_portal_session(
  p_employee_id UUID,
  p_ttl_minutes INTEGER DEFAULT 480,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  session_token TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_expiry TIMESTAMPTZ;
BEGIN
  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee ID is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.is_active = true
  ) THEN
    RAISE EXCEPTION 'Employee not found or inactive';
  END IF;

  v_token := replace(extensions.gen_random_uuid()::text, '-', '') || replace(extensions.gen_random_uuid()::text, '-', '');
  v_expiry := now() + make_interval(mins => GREATEST(COALESCE(p_ttl_minutes, 480), 5));

  INSERT INTO public.employee_portal_sessions (
    employee_id,
    session_token,
    expires_at,
    ip_address,
    user_agent
  )
  VALUES (
    p_employee_id,
    v_token,
    v_expiry,
    NULLIF(trim(p_ip_address), ''),
    NULLIF(trim(p_user_agent), '')
  );

  RETURN QUERY SELECT v_token, v_expiry;
END;
$$;
