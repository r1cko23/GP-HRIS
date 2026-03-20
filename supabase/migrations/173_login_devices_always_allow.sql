-- =====================================================
-- 173: Always allow employee login; log all devices (no hard cap)
-- =====================================================
-- Return type adds exceeds_recommended_device_count; drop first.
DROP FUNCTION IF EXISTS public.register_employee_login_device(UUID, TEXT, TEXT, TEXT, TEXT);

-- =====================================================
-- Previously register_employee_login_device returned allowed = false when
-- device count exceeded v_max_devices (5), blocking login.
-- Now: every successful registration allows login; devices beyond the
-- recommended count (2) are still stored and flagged for HR (matches
-- get_all_employees_devices abnormal = cnt > 2).
-- =====================================================

CREATE OR REPLACE FUNCTION public.register_employee_login_device(
  p_employee_id UUID,
  p_device_fingerprint TEXT,
  p_client_id TEXT DEFAULT NULL,
  p_device_label TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_new_device BOOLEAN,
  total_device_count BIGINT,
  allowed BOOLEAN,
  message TEXT,
  exceeds_recommended_device_count BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existed BOOLEAN;
  v_count BIGINT;
  v_fp TEXT := trim(p_device_fingerprint);
  v_recommended_max INT := 2;
BEGIN
  IF p_employee_id IS NULL OR (p_device_fingerprint IS NULL OR v_fp = '') THEN
    RETURN QUERY SELECT
      FALSE,
      0::BIGINT,
      FALSE,
      'Missing employee_id or device_fingerprint'::TEXT,
      FALSE;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.employee_login_devices d
    WHERE d.employee_id = p_employee_id AND d.device_fingerprint = v_fp
  ) INTO v_existed;

  INSERT INTO public.employee_login_devices (
    employee_id,
    device_fingerprint,
    client_id,
    device_label,
    ip_address,
    first_seen_at,
    last_seen_at
  )
  VALUES (
    p_employee_id,
    v_fp,
    NULLIF(trim(p_client_id), ''),
    NULLIF(trim(p_device_label), ''),
    NULLIF(trim(p_ip_address), ''),
    now(),
    now()
  )
  ON CONFLICT (employee_id, device_fingerprint)
  DO UPDATE SET
    last_seen_at = now(),
    device_label = COALESCE(NULLIF(trim(EXCLUDED.device_label), ''), employee_login_devices.device_label),
    ip_address = COALESCE(NULLIF(trim(EXCLUDED.ip_address), ''), employee_login_devices.ip_address),
    client_id = COALESCE(NULLIF(trim(EXCLUDED.client_id), ''), employee_login_devices.client_id);

  SELECT count(*) INTO v_count
  FROM public.employee_login_devices
  WHERE employee_id = p_employee_id;

  RETURN QUERY
  SELECT
    NOT v_existed,
    v_count,
    TRUE,
    CASE
      WHEN v_count > v_recommended_max THEN
        'More than 2 devices are linked to this account. Login was allowed and this device was logged for HR review.'
      ELSE NULL
    END,
    (v_count > v_recommended_max);
END;
$$;

COMMENT ON FUNCTION public.register_employee_login_device(UUID, TEXT, TEXT, TEXT, TEXT) IS
  'Registers or updates login device. Always allows login after success; exceeds_recommended_device_count when count > 2 (3+ devices).';

GRANT EXECUTE ON FUNCTION public.register_employee_login_device(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.register_employee_login_device(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
