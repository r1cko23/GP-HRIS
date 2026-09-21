-- Mapped employees clock on the MB10. Phone GPS bundy must not write IN/OUT.

CREATE OR REPLACE FUNCTION public.employee_clock_in(
  p_employee_id uuid,
  p_location text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text,
  p_ip text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, entry_id uuid, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entry_id UUID;
  v_existing_entry RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_employee_id AND is_active = true
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Employee not found or inactive'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.biometric_user_maps
    WHERE employee_id = p_employee_id
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Use the biometric terminal for time in/out'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_existing_entry
  FROM public.time_clock_entries
  WHERE employee_id = p_employee_id
    AND status = 'clocked_in'
  ORDER BY clock_in_time DESC
  LIMIT 1;

  IF v_existing_entry.id IS NOT NULL THEN
    DECLARE
      v_entry_date_ph DATE;
      v_today_ph DATE;
      v_entry_midnight_utc TIMESTAMP WITH TIME ZONE;
    BEGIN
      v_entry_date_ph := (v_existing_entry.clock_in_time AT TIME ZONE 'Asia/Manila')::DATE;
      v_today_ph := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
      IF v_entry_date_ph < v_today_ph THEN
        v_entry_midnight_utc := ((v_entry_date_ph + 1)::TIMESTAMP AT TIME ZONE 'Asia/Manila') - INTERVAL '1 second';
        UPDATE public.time_clock_entries
        SET
          clock_out_time = v_entry_midnight_utc,
          status = 'auto_approved',
          total_hours = NULL,
          regular_hours = NULL
        WHERE id = v_existing_entry.id;
      END IF;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.time_clock_entries
    WHERE employee_id = p_employee_id
      AND status = 'clocked_in'
      AND DATE(clock_in_time) = CURRENT_DATE
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Already clocked in today'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.time_clock_entries (
    employee_id,
    clock_in_time,
    clock_in_location,
    clock_in_device,
    clock_in_ip,
    status
  ) VALUES (
    p_employee_id,
    NOW(),
    p_location,
    p_device,
    p_ip,
    'clocked_in'
  )
  RETURNING id INTO v_entry_id;

  RETURN QUERY SELECT TRUE, v_entry_id, NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id uuid,
  p_entry_id uuid,
  p_location text DEFAULT NULL::text,
  p_device text DEFAULT NULL::text,
  p_ip text DEFAULT NULL::text,
  p_fingerprint text DEFAULT NULL::text,
  p_client_id text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF EXISTS (
    SELECT 1 FROM public.biometric_user_maps
    WHERE employee_id = p_employee_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'Use the biometric terminal for time in/out'::TEXT;
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
$function$;
