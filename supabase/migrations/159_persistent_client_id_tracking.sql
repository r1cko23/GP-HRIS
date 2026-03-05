-- =====================================================
-- 159: Persistent client ID for device tracking
-- =====================================================
-- Store a UUID from localStorage (same browser until cleared). Complements
-- fingerprint: if user clears storage, client_id changes; fingerprint may stay same.
-- =====================================================

ALTER TABLE public.time_clock_entries
  ADD COLUMN IF NOT EXISTS clock_in_client_id TEXT,
  ADD COLUMN IF NOT EXISTS clock_out_client_id TEXT;

COMMENT ON COLUMN public.time_clock_entries.clock_in_client_id IS 'Persistent client UUID from localStorage at clock-in; changes if user clears site data.';
COMMENT ON COLUMN public.time_clock_entries.clock_out_client_id IS 'Persistent client UUID from localStorage at clock-out; changes if user clears site data.';

-- Extend employee_clock_out to accept and store client_id (7th arg)
DROP FUNCTION IF EXISTS public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.employee_clock_out(UUID, UUID, TEXT);

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
    AND status = 'clocked_in'
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
  WHERE id = p_entry_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

-- 3-arg overload
CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, error_message TEXT)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.employee_clock_out(p_employee_id, p_entry_id, p_location, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO anon;

-- 5-arg overload (device, ip)
CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, error_message TEXT)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.employee_clock_out(p_employee_id, p_entry_id, p_location, p_device, p_ip, NULL::TEXT, NULL::TEXT);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT) TO anon;

-- 6-arg overload (device, ip, fingerprint)
CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_fingerprint TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, error_message TEXT)
SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.employee_clock_out(p_employee_id, p_entry_id, p_location, p_device, p_ip, p_fingerprint, NULL::TEXT);
END;
$$;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
