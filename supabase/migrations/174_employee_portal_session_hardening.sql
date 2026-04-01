-- =====================================================
-- 174: Employee portal session hardening + login event RPC
-- =====================================================
-- Introduces server-verifiable employee portal sessions so API routes
-- no longer trust client-supplied employee_id alone.

-- Session store for employee portal API authorization
CREATE TABLE IF NOT EXISTS public.employee_portal_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_employee_portal_sessions_employee_id
  ON public.employee_portal_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_portal_sessions_token
  ON public.employee_portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_employee_portal_sessions_expiry
  ON public.employee_portal_sessions(expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.employee_portal_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employee_portal_sessions'
      AND policyname = 'No direct access to employee_portal_sessions'
  ) THEN
    CREATE POLICY "No direct access to employee_portal_sessions"
      ON public.employee_portal_sessions
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.employee_portal_sessions IS
  'Server-verifiable employee portal sessions used by API routes.';

-- Login/logout audit trail for employee portal events
CREATE TABLE IF NOT EXISTS public.employee_login_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'logout')),
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  device_type TEXT,
  mac_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_login_events_employee_created
  ON public.employee_login_events(employee_id, created_at DESC);

ALTER TABLE public.employee_login_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employee_login_events'
      AND policyname = 'No direct access to employee_login_events'
  ) THEN
    CREATE POLICY "No direct access to employee_login_events"
      ON public.employee_login_events
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.employee_login_events IS
  'Employee portal login/logout events for audit and first-login tracking.';

-- Issue employee session token after successful credential validation.
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

  v_token := replace(uuid_generate_v4()::text, '-', '') || replace(uuid_generate_v4()::text, '-', '');
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

COMMENT ON FUNCTION public.issue_employee_portal_session(UUID, INTEGER, TEXT, TEXT) IS
  'Issues a server-verifiable employee portal session token.';

GRANT EXECUTE ON FUNCTION public.issue_employee_portal_session(UUID, INTEGER, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.issue_employee_portal_session(UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- Validate employee session token and optionally enforce expected employee.
CREATE OR REPLACE FUNCTION public.assert_employee_portal_session(
  p_session_token TEXT,
  p_expected_employee_id UUID DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  is_valid BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Missing session token'::TEXT;
    RETURN;
  END IF;

  SELECT s.*
  INTO v_session
  FROM public.employee_portal_sessions s
  WHERE s.session_token = trim(p_session_token)
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Session not found'::TEXT;
    RETURN;
  END IF;

  IF v_session.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Session revoked'::TEXT;
    RETURN;
  END IF;

  IF v_session.expires_at <= now() THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Session expired'::TEXT;
    RETURN;
  END IF;

  IF p_expected_employee_id IS NOT NULL AND v_session.employee_id <> p_expected_employee_id THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Session employee mismatch'::TEXT;
    RETURN;
  END IF;

  UPDATE public.employee_portal_sessions
  SET last_seen_at = now()
  WHERE id = v_session.id;

  RETURN QUERY SELECT v_session.employee_id, TRUE, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.assert_employee_portal_session(TEXT, UUID) IS
  'Validates an employee portal session token and returns employee_id if valid.';

GRANT EXECUTE ON FUNCTION public.assert_employee_portal_session(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.assert_employee_portal_session(TEXT, UUID) TO authenticated;

-- Revoke employee portal session token.
CREATE OR REPLACE FUNCTION public.revoke_employee_portal_session(
  p_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.employee_portal_sessions
  SET revoked_at = now()
  WHERE session_token = trim(p_session_token)
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.revoke_employee_portal_session(TEXT) IS
  'Revokes an employee portal session token.';

GRANT EXECUTE ON FUNCTION public.revoke_employee_portal_session(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.revoke_employee_portal_session(TEXT) TO authenticated;

-- Login/logout audit function used by employee portal API.
CREATE OR REPLACE FUNCTION public.record_employee_first_login(
  p_employee_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL,
  p_browser_name TEXT DEFAULT NULL,
  p_browser_version TEXT DEFAULT NULL,
  p_os_name TEXT DEFAULT NULL,
  p_os_version TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_mac_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  is_first_login BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type TEXT;
  v_has_prior_login BOOLEAN;
BEGIN
  IF p_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, 'Employee ID is required'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.is_active = true
  ) THEN
    RETURN QUERY SELECT FALSE, FALSE, 'Employee not found or inactive'::TEXT;
    RETURN;
  END IF;

  v_event_type := CASE
    WHEN p_mac_address IS NULL THEN 'logout'
    ELSE 'login'
  END;

  SELECT EXISTS (
    SELECT 1
    FROM public.employee_login_events le
    WHERE le.employee_id = p_employee_id
      AND le.event_type = 'login'
  )
  INTO v_has_prior_login;

  INSERT INTO public.employee_login_events (
    employee_id,
    event_type,
    ip_address,
    user_agent,
    device_info,
    browser_name,
    browser_version,
    os_name,
    os_version,
    device_type,
    mac_address
  )
  VALUES (
    p_employee_id,
    v_event_type,
    NULLIF(trim(p_ip_address), ''),
    NULLIF(trim(p_user_agent), ''),
    NULLIF(trim(p_device_info), ''),
    NULLIF(trim(p_browser_name), ''),
    NULLIF(trim(p_browser_version), ''),
    NULLIF(trim(p_os_name), ''),
    NULLIF(trim(p_os_version), ''),
    NULLIF(trim(p_device_type), ''),
    NULLIF(trim(p_mac_address), '')
  );

  IF v_event_type = 'login' THEN
    RETURN QUERY SELECT TRUE, (NOT v_has_prior_login), 'Login recorded'::TEXT;
  ELSE
    RETURN QUERY SELECT TRUE, FALSE, 'Logout recorded'::TEXT;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.record_employee_first_login(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Records employee login/logout events and flags first-ever login.';

GRANT EXECUTE ON FUNCTION public.record_employee_first_login(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.record_employee_first_login(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
