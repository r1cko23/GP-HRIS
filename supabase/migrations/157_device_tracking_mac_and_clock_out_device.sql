-- =====================================================
-- 157: Device & login tracking for time entries
-- =====================================================
-- 1. Add optional MAC address columns (for native/kiosk apps that can capture MAC).
-- 2. Extend employee_clock_out to accept and store device + IP on clock out
--    so we can detect device switching within the same entry (clock in vs clock out).
-- =====================================================

-- Optional MAC columns (browsers cannot read MAC; use from native app or kiosk if needed)
ALTER TABLE public.time_clock_entries
  ADD COLUMN IF NOT EXISTS clock_in_mac TEXT,
  ADD COLUMN IF NOT EXISTS clock_out_mac TEXT;

COMMENT ON COLUMN public.time_clock_entries.clock_in_mac IS 'Optional. MAC at clock-in; set by native/kiosk when available. Browsers cannot read MAC.';
COMMENT ON COLUMN public.time_clock_entries.clock_out_mac IS 'Optional. MAC at clock-out; set by native/kiosk when available.';

-- Extend employee_clock_out to accept device and IP and persist on the entry
DROP FUNCTION IF EXISTS public.employee_clock_out(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
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
    clock_out_ip = p_ip
  WHERE id = p_entry_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT, TEXT, TEXT) TO anon;

-- Keep 3-arg version for backward compatibility (e.g. scripts)
CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.employee_clock_out(p_employee_id, p_entry_id, p_location, NULL::TEXT, NULL::TEXT);
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO anon;
