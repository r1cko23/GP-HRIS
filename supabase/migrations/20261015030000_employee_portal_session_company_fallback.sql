-- Employee portal login was failing with "Could not start employee session"
-- when public.employees.company_id was NULL: issue_employee_portal_session
-- treated that as "not found or inactive" even after a good password check.
-- Fall back to default_company_id() and backfill any nulls.

UPDATE public.employees
SET company_id = public.default_company_id(),
    updated_at = now()
WHERE company_id IS NULL
  AND is_active = true;

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
  v_company_id UUID;
BEGIN
  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee ID is required';
  END IF;

  SELECT COALESCE(e.company_id, public.default_company_id())
  INTO v_company_id
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found or inactive';
  END IF;

  -- Keep the row usable for future session inserts (composite FK).
  UPDATE public.employees e
  SET company_id = v_company_id,
      updated_at = now()
  WHERE e.id = p_employee_id
    AND e.company_id IS NULL;

  v_token := replace(extensions.gen_random_uuid()::text, '-', '')
    || replace(extensions.gen_random_uuid()::text, '-', '');
  v_expiry := now() + make_interval(mins => GREATEST(COALESCE(p_ttl_minutes, 480), 5));

  INSERT INTO public.employee_portal_sessions (
    employee_id,
    company_id,
    session_token,
    expires_at,
    ip_address,
    user_agent
  )
  VALUES (
    p_employee_id,
    v_company_id,
    v_token,
    v_expiry,
    NULLIF(trim(p_ip_address), ''),
    NULLIF(trim(p_user_agent), '')
  );

  RETURN QUERY SELECT v_token, v_expiry;
END;
$$;

COMMENT ON FUNCTION public.issue_employee_portal_session(UUID, INTEGER, TEXT, TEXT) IS
  'Issues employee portal session; uses default_company_id when employees.company_id is null.';
