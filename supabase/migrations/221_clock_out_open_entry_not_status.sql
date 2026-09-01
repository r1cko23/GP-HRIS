-- =====================================================
-- 221: Clock-out matches any open entry (not status only)
-- =====================================================
-- Production bug: some punches flip to auto_approved while still open
-- (clock_out_time IS NULL). employee_clock_out required status =
-- 'clocked_in', so Confirm Time Out returned "No active clock-in entry
-- found" even when a punch was open — common for recruitment and others.
--
-- Fix: treat open as clock_out_time IS NULL. Keep rest-day / active checks.
-- =====================================================

CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_fingerprint TEXT DEFAULT NULL,
  p_client_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_employee_id AND is_active = true
  ) THEN
    RETURN QUERY SELECT FALSE, 'Employee not found or inactive'::TEXT;
    RETURN;
  END IF;

  IF public.is_rest_day_today(p_employee_id) THEN
    RETURN QUERY SELECT FALSE, 'Cannot clock out on rest day'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_entry
  FROM public.time_clock_entries
  WHERE id = p_entry_id
    AND employee_id = p_employee_id
    AND clock_out_time IS NULL
  FOR UPDATE;

  IF v_entry.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No active clock-in entry found'::TEXT;
    RETURN;
  END IF;

  UPDATE public.time_clock_entries
  SET
    clock_out_time = NOW(),
    clock_out_location = p_location,
    clock_out_device = p_device,
    clock_out_ip = p_ip,
    clock_out_fingerprint = p_fingerprint,
    clock_out_client_id = p_client_id
  WHERE id = p_entry_id
    AND clock_out_time IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No active clock-in entry found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

-- Keep thin overloads pointing at the 7-arg implementation.
CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, error_message TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.employee_clock_out(
    p_employee_id, p_entry_id, p_location, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO anon;

CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, error_message TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.employee_clock_out(
    p_employee_id, p_entry_id, p_location, p_device, p_ip, NULL::TEXT, NULL::TEXT
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT) TO anon;

CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_fingerprint TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, error_message TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.employee_clock_out(
    p_employee_id, p_entry_id, p_location, p_device, p_ip, p_fingerprint, NULL::TEXT
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
