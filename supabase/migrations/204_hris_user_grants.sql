-- ABAC: hris pages + functions (alongside existing users.permissions JSON).
CREATE TABLE IF NOT EXISTS public.hris_capabilities (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('page', 'function')),
  label TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.hris_user_grants (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL REFERENCES public.hris_capabilities(key) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, capability_key)
);

CREATE INDEX IF NOT EXISTS hris_user_grants_key_idx ON public.hris_user_grants (capability_key);

ALTER TABLE public.hris_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hris_user_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hris_capabilities_read ON public.hris_capabilities;
CREATE POLICY hris_capabilities_read ON public.hris_capabilities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS hris_user_grants_read_own ON public.hris_user_grants;
CREATE POLICY hris_user_grants_read_own ON public.hris_user_grants
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.hris_capabilities TO authenticated, service_role;
GRANT SELECT ON public.hris_user_grants TO authenticated, service_role;
GRANT ALL ON public.hris_capabilities TO service_role;
GRANT ALL ON public.hris_user_grants TO service_role;

INSERT INTO public.hris_capabilities (key, kind, label, description, sort_order) VALUES
  ('page:dashboard', 'page', 'Dashboard', 'Workforce overview', 10),
  ('page:executive', 'page', 'Executive dashboard', 'Executive metrics', 15),
  ('page:employees', 'page', 'Employees', 'Directory and profiles', 20),
  ('page:schedules', 'page', 'Schedules', 'Shifts', 30),
  ('page:loans', 'page', 'Loans', 'Salary advances', 40),
  ('page:payslips', 'page', 'Payslips', 'Pay runs', 50),
  ('page:timesheet', 'page', 'Time & attendance', 'Attendance grid', 60),
  ('page:time_entries', 'page', 'Time entries', 'Clock events', 70),
  ('page:leave_approval', 'page', 'Leave requests', 'Leave approvals', 80),
  ('page:overtime_approval', 'page', 'Overtime requests', 'OT approvals', 90),
  ('page:failure_to_log', 'page', 'Missed punches', 'FTL approvals', 100),
  ('page:audit', 'page', 'Audit log', 'Change history', 110),
  ('page:bir_reports', 'page', 'BIR reports', 'Tax filings', 120),
  ('page:reports', 'page', 'Payroll register', 'Payroll exports', 130),
  ('page:settings', 'page', 'Settings', 'App preferences', 140),
  ('page:user_management', 'page', 'Team & access', 'Invite and grants', 150),
  ('fn:employees.create', 'function', 'Create employees', '', 200),
  ('fn:employees.update', 'function', 'Update employees', '', 210),
  ('fn:employees.delete', 'function', 'Delete employees', '', 220),
  ('fn:schedules.create', 'function', 'Create schedules', '', 230),
  ('fn:schedules.update', 'function', 'Update schedules', '', 240),
  ('fn:schedules.delete', 'function', 'Delete schedules', '', 250),
  ('fn:loans.create', 'function', 'Create loans', '', 260),
  ('fn:loans.update', 'function', 'Update loans', '', 270),
  ('fn:payslips.create', 'function', 'Create payslips', '', 280),
  ('fn:payslips.update', 'function', 'Update payslips', '', 290),
  ('fn:payslips.approve', 'function', 'Approve payslips', '', 295),
  ('fn:timesheet.update', 'function', 'Edit timesheets', '', 300),
  ('fn:time_entries.create', 'function', 'Create time entries', '', 310),
  ('fn:time_entries.update', 'function', 'Update time entries', '', 320),
  ('fn:time_entries.delete', 'function', 'Delete time entries', '', 330),
  ('fn:leave_approval.update', 'function', 'Act on leave', '', 340),
  ('fn:overtime_approval.update', 'function', 'Act on overtime', '', 350),
  ('fn:failure_to_log.update', 'function', 'Act on FTL', '', 360),
  ('fn:user_management.create', 'function', 'Create team users', '', 370),
  ('fn:user_management.update', 'function', 'Edit team access', '', 380),
  ('fn:admin.system', 'function', 'Admin system', 'Audit, BIR, and system APIs', 390),
  ('fn:salary.read', 'function', 'Read pay info', 'Salary fields', 400)
ON CONFLICT (key) DO UPDATE SET
  kind = EXCLUDED.kind,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Seed admin: every capability.
INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, c.key
FROM public.users u
CROSS JOIN public.hris_capabilities c
WHERE u.role = 'admin' AND u.is_active = true
ON CONFLICT DO NOTHING;

-- Seed from JSON permissions: read → page; create/update/delete → fn.
INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, 'page:' || mod.key
FROM public.users u
CROSS JOIN LATERAL jsonb_each(COALESCE(u.permissions, '{}'::jsonb)) AS mod(key, val)
WHERE u.is_active = true
  AND u.role IS DISTINCT FROM 'admin'
  AND (mod.val->>'read')::boolean IS TRUE
  AND EXISTS (SELECT 1 FROM public.hris_capabilities c WHERE c.key = 'page:' || mod.key)
ON CONFLICT DO NOTHING;

INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, 'fn:' || mod.key || '.' || act
FROM public.users u
CROSS JOIN LATERAL jsonb_each(COALESCE(u.permissions, '{}'::jsonb)) AS mod(key, val)
CROSS JOIN LATERAL unnest(ARRAY['create','update','delete']) AS act
WHERE u.is_active = true
  AND u.role IS DISTINCT FROM 'admin'
  AND (mod.val->>act)::boolean IS TRUE
  AND EXISTS (SELECT 1 FROM public.hris_capabilities c WHERE c.key = 'fn:' || mod.key || '.' || act)
ON CONFLICT DO NOTHING;

INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, 'fn:salary.read'
FROM public.users u
WHERE u.is_active = true AND COALESCE(u.can_access_salary, false) = true
ON CONFLICT DO NOTHING;
