-- =====================================================
-- 241: ZKTeco ADMS biometric → Organic time_clock_entries
-- =====================================================
-- MB10-VL (SN UDP3235201130) at Green Pasture pushes ATTLOG via /iclock/*.
-- Punches land in public.time_clock_entries for bundy-enrolled staff assigned
-- to the Green Pasture office location. GPS bundy is disabled for mapped users.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.biometric_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Biometric terminal',
  office_location_name TEXT NOT NULL DEFAULT 'Green Pasture',
  is_active BOOLEAN NOT NULL DEFAULT true,
  attlog_stamp TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.biometric_devices IS
  'ZKTeco (and similar) ADMS terminals allowed to push punches into Organic clock.';

CREATE TABLE IF NOT EXISTS public.biometric_user_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.biometric_devices (id) ON DELETE CASCADE,
  device_user_id TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT biometric_user_maps_device_pin_key UNIQUE (device_id, device_user_id),
  CONSTRAINT biometric_user_maps_device_employee_key UNIQUE (device_id, employee_id)
);

COMMENT ON TABLE public.biometric_user_maps IS
  'Maps terminal PIN/user id → public.employees.id for ADMS punches.';

CREATE TABLE IF NOT EXISTS public.biometric_punch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.biometric_devices (id) ON DELETE CASCADE,
  device_user_id TEXT NOT NULL,
  punched_at TIMESTAMPTZ NOT NULL,
  status_code INTEGER,
  raw_line TEXT,
  time_clock_entry_id UUID REFERENCES public.time_clock_entries (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS biometric_punch_events_dedupe_idx
  ON public.biometric_punch_events (
    device_id,
    device_user_id,
    punched_at,
    COALESCE(status_code, -1)
  );

CREATE INDEX IF NOT EXISTS biometric_user_maps_employee_idx
  ON public.biometric_user_maps (employee_id);

CREATE INDEX IF NOT EXISTS biometric_punch_events_device_idx
  ON public.biometric_punch_events (device_id, punched_at DESC);

ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_user_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_punch_events ENABLE ROW LEVEL SECURITY;

-- Admin / HR manage; employees can see own map (for portal gate)
DROP POLICY IF EXISTS biometric_devices_select_authenticated ON public.biometric_devices;
CREATE POLICY biometric_devices_select_authenticated ON public.biometric_devices
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS biometric_devices_manage_admin_hr ON public.biometric_devices;
CREATE POLICY biometric_devices_manage_admin_hr ON public.biometric_devices
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr())
  WITH CHECK (public.is_admin_or_hr());

-- Authenticated can SELECT maps (portal gate); only admin/hr write
DROP POLICY IF EXISTS biometric_user_maps_select ON public.biometric_user_maps;
CREATE POLICY biometric_user_maps_select ON public.biometric_user_maps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS biometric_user_maps_manage_admin_hr ON public.biometric_user_maps;
CREATE POLICY biometric_user_maps_manage_admin_hr ON public.biometric_user_maps
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr())
  WITH CHECK (public.is_admin_or_hr());

DROP POLICY IF EXISTS biometric_punch_events_select_admin_hr ON public.biometric_punch_events;
CREATE POLICY biometric_punch_events_select_admin_hr ON public.biometric_punch_events
  FOR SELECT TO authenticated
  USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS biometric_punch_events_manage_admin_hr ON public.biometric_punch_events;
CREATE POLICY biometric_punch_events_manage_admin_hr ON public.biometric_punch_events
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr())
  WITH CHECK (public.is_admin_or_hr());

GRANT SELECT ON public.biometric_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_devices TO authenticated;
GRANT SELECT ON public.biometric_user_maps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_user_maps TO authenticated;
GRANT SELECT ON public.biometric_punch_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_punch_events TO authenticated;

-- Seed the office MB10-VL
INSERT INTO public.biometric_devices (serial_number, name, office_location_name, is_active)
VALUES ('UDP3235201130', 'Green Pasture MB10-VL', 'Green Pasture', true)
ON CONFLICT (serial_number) DO UPDATE
SET
  name = EXCLUDED.name,
  office_location_name = EXCLUDED.office_location_name,
  is_active = true,
  updated_at = now();
