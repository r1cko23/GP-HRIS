-- =====================================================
-- 161: Employee login device registry (multi-device detection)
-- =====================================================
-- Tracks every distinct device an employee has logged in from.
-- Used to detect abnormal device switching and limit credential sharing.
-- Access only via RPCs; no direct client SELECT (employee portal has no Supabase auth).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.employee_login_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  client_id TEXT,
  device_label TEXT,
  ip_address TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, device_fingerprint)
);

COMMENT ON TABLE public.employee_login_devices IS 'Distinct devices per employee for login; used for multi-device detection and "Your devices" list.';
COMMENT ON COLUMN public.employee_login_devices.device_fingerprint IS 'Hash from getDeviceFingerprint(); stable per device/browser.';
COMMENT ON COLUMN public.employee_login_devices.client_id IS 'Persistent UUID from localStorage (getOrCreateClientId).';
COMMENT ON COLUMN public.employee_login_devices.device_label IS 'Human-readable e.g. iPhone 17 Pro Max, Samsung Galaxy S24.';

CREATE INDEX IF NOT EXISTS idx_employee_login_devices_employee_id
  ON public.employee_login_devices(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_login_devices_employee_last_seen
  ON public.employee_login_devices(employee_id, last_seen_at DESC);

-- RLS: block direct access; all access via SECURITY DEFINER RPCs
ALTER TABLE public.employee_login_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to employee_login_devices"
  ON public.employee_login_devices
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Max devices per employee (hardcoded; can move to app_config later)
-- When exceeded, register_employee_login_device returns allowed = false.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_max_devices_note') THEN
    RAISE NOTICE 'Max devices enforced in register_employee_login_device (default 5)';
  END IF;
END $$;

-- =====================================================
-- register_employee_login_device: upsert device, return is_new, total_count, allowed
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
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existed BOOLEAN;
  v_count BIGINT;
  v_max_devices INT := 5;
  v_fp TEXT := trim(p_device_fingerprint);
BEGIN
  IF p_employee_id IS NULL OR (p_device_fingerprint IS NULL OR v_fp = '') THEN
    RETURN QUERY SELECT FALSE, 0::BIGINT, FALSE, 'Missing employee_id or device_fingerprint'::TEXT;
    RETURN;
  END IF;

  -- Check if this device already existed (before upsert)
  SELECT EXISTS (
    SELECT 1 FROM public.employee_login_devices d
    WHERE d.employee_id = p_employee_id AND d.device_fingerprint = v_fp
  ) INTO v_existed;

  -- Upsert: insert or update last_seen_at, device_label, ip_address
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

  -- is_new_device = we did not have this device before (so after upsert it's the first time we see it)
  RETURN QUERY
  SELECT
    NOT v_existed,
    v_count,
    (v_count <= v_max_devices),
    CASE WHEN v_count > v_max_devices THEN 'Too many devices. Contact HR to continue.' ELSE NULL END;
END;
$$;

COMMENT ON FUNCTION public.register_employee_login_device(UUID, TEXT, TEXT, TEXT, TEXT) IS
  'Registers or updates a device for an employee login. Returns is_new_device, total_device_count, allowed (false when over max), message.';

GRANT EXECUTE ON FUNCTION public.register_employee_login_device(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.register_employee_login_device(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =====================================================
-- get_employee_devices: list devices for one employee (for "Your devices" and admin)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_employee_devices(p_employee_id UUID)
RETURNS TABLE (
  device_label TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  ip_address TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    d.device_label,
    d.first_seen_at,
    d.last_seen_at,
    d.ip_address
  FROM public.employee_login_devices d
  WHERE d.employee_id = p_employee_id
  ORDER BY d.last_seen_at DESC;
$$;

COMMENT ON FUNCTION public.get_employee_devices(UUID) IS
  'Returns all devices ever used by an employee. Call from API that verifies requester is that employee or admin.';

GRANT EXECUTE ON FUNCTION public.get_employee_devices(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_devices(UUID) TO authenticated;

-- =====================================================
-- get_all_employees_devices: admin-only summary (employee | device_count | devices)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_all_employees_devices()
RETURNS TABLE (
  employee_id UUID,
  employee_identifier TEXT,
  full_name TEXT,
  device_count BIGINT,
  last_seen_at TIMESTAMPTZ,
  device_labels TEXT,
  abnormal BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.employee_id AS employee_identifier,
    e.full_name,
    c.cnt AS device_count,
    maxd.last_seen_at,
    (SELECT string_agg(d.device_label, ', ' ORDER BY d.last_seen_at DESC)
     FROM public.employee_login_devices d WHERE d.employee_id = e.id) AS device_labels,
    (c.cnt > 3) AS abnormal
  FROM public.employees e
  JOIN LATERAL (
    SELECT count(*)::BIGINT AS cnt
    FROM public.employee_login_devices d
    WHERE d.employee_id = e.id
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT max(d.last_seen_at) AS last_seen_at
    FROM public.employee_login_devices d
    WHERE d.employee_id = e.id
  ) maxd ON true
  WHERE c.cnt > 0
  ORDER BY c.cnt DESC, maxd.last_seen_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_all_employees_devices() IS
  'Admin: list employees with at least one login device; device_count, last_seen, labels; abnormal = more than 3 devices.';

GRANT EXECUTE ON FUNCTION public.get_all_employees_devices() TO authenticated;
