-- Cutoff hours kernel: deployed DTR / tbl_timekeep shape for GP-payroll-timekeeping-attendance.
-- Office live clock still uses time_clock_entries; both paths converge here for payroll.

-- ---------------------------------------------------------------------------
-- Cutoff period (one client + date range batch)
-- ---------------------------------------------------------------------------

CREATE TABLE public.cutoff_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payroll_date DATE,
  pay_frequency TEXT CHECK (
    pay_frequency IS NULL
    OR pay_frequency IN ('weekly', 'semi-monthly', 'monthly')
  ),
  source_app TEXT NOT NULL DEFAULT 'gp-payroll-timekeeping-attendance',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_audit', 'approved', 'posted', 'cancelled')
  ),
  legacy_idtimekeep BIGINT,
  notes TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  audited_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  audited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cutoff_periods_dates_check CHECK (period_end >= period_start),
  CONSTRAINT cutoff_periods_org_client_dates_key UNIQUE (
    organization_id,
    client_id,
    period_start,
    period_end
  )
);

CREATE INDEX cutoff_periods_client_dates_idx
  ON public.cutoff_periods (client_id, period_start DESC);

CREATE INDEX cutoff_periods_org_status_idx
  ON public.cutoff_periods (organization_id, status);

-- ---------------------------------------------------------------------------
-- Cutoff hours document (one row per person per period — tbl_timekeep grain)
-- ---------------------------------------------------------------------------

CREATE TABLE public.cutoff_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  directory_employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  office_employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,
  branch_id UUID REFERENCES directory.client_branches (id) ON DELETE SET NULL,
  position_id UUID REFERENCES directory.positions (id) ON DELETE SET NULL,
  employee_code TEXT,
  last_name TEXT,
  first_name TEXT,
  -- Premium-hour matrix (tbl_timekeep hours columns)
  actual_regular_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  hours_work NUMERIC(9, 2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  night_diff_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  regular_night_ot_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  legal_holiday_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  legal_holiday_ot_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  legal_holiday_nd_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  legal_holiday_ot_nd_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  special_holiday_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  special_holiday_ot_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  special_holiday_nd_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  special_holiday_ot_nd_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  rest_day_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  rest_day_ot_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  rest_day_nd_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  rest_day_ot_nd_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  lh_rest_day_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  lh_rest_day_ot_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  sh_rest_day_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  sh_rest_day_ot_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  wdo_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  tardiness_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  undertime_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  absences_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  pto_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  allowance NUMERIC(12, 4),
  daily_rate_payroll NUMERIC(12, 4),
  rate_snapshot JSONB,
  remarks TEXT,
  tk_status TEXT,
  source_of_data TEXT,
  legacy_idtimekeep BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cutoff_hours_period_employee_key UNIQUE (cutoff_period_id, directory_employee_id)
);

CREATE INDEX cutoff_hours_period_idx ON public.cutoff_hours (cutoff_period_id);
CREATE INDEX cutoff_hours_directory_employee_idx
  ON public.cutoff_hours (directory_employee_id, cutoff_period_id DESC);

-- ---------------------------------------------------------------------------
-- DTR punches (daily IN/OUT from timekeeping app — not office time_clock_entries)
-- ---------------------------------------------------------------------------

CREATE TABLE public.cutoff_dtr_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  directory_employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'timekeeping_app',
  remarks TEXT,
  legacy_row_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cutoff_dtr_punches_period_employee_date_key UNIQUE (
    cutoff_period_id,
    directory_employee_id,
    work_date
  )
);

CREATE INDEX cutoff_dtr_punches_period_idx ON public.cutoff_dtr_punches (cutoff_period_id);
CREATE INDEX cutoff_dtr_punches_employee_date_idx
  ON public.cutoff_dtr_punches (directory_employee_id, work_date DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_cutoff_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cutoff_periods_updated_at
BEFORE UPDATE ON public.cutoff_periods
FOR EACH ROW EXECUTE FUNCTION public.touch_cutoff_updated_at();

CREATE TRIGGER trg_cutoff_hours_updated_at
BEFORE UPDATE ON public.cutoff_hours
FOR EACH ROW EXECUTE FUNCTION public.touch_cutoff_updated_at();

CREATE TRIGGER trg_cutoff_dtr_punches_updated_at
BEFORE UPDATE ON public.cutoff_dtr_punches
FOR EACH ROW EXECUTE FUNCTION public.touch_cutoff_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (browser Admin/HR; sibling apps use service-role API routes)
-- ---------------------------------------------------------------------------

ALTER TABLE public.cutoff_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutoff_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutoff_dtr_punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY cutoff_periods_select_authenticated ON public.cutoff_periods
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY cutoff_periods_manage_admin_hr ON public.cutoff_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'hr')
    )
  );

CREATE POLICY cutoff_hours_select_authenticated ON public.cutoff_hours
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY cutoff_hours_manage_admin_hr ON public.cutoff_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'hr')
    )
  );

CREATE POLICY cutoff_dtr_punches_select_authenticated ON public.cutoff_dtr_punches
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY cutoff_dtr_punches_manage_admin_hr ON public.cutoff_dtr_punches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'hr')
    )
  );

COMMENT ON TABLE public.cutoff_periods IS
  'Client cutoff batch (tbl_timekeep header). Ingested from GP-payroll-timekeeping-attendance or generated from office clock.';

COMMENT ON TABLE public.cutoff_hours IS
  'Approved premium-hour matrix per Directory employee per cutoff period. Payroll register consumes this.';

COMMENT ON TABLE public.cutoff_dtr_punches IS
  'Daily DTR IN/OUT from timekeeping app. Display/audit only — not public.time_clock_entries.';
