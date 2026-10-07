-- Approved work is the immutable commercial input shared by payroll and billing.
-- These ledgers intentionally do not replace payroll_register_* or billing_* yet.

CREATE TABLE public.approved_work_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_period_id UUID NOT NULL
    REFERENCES public.cutoff_periods (id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL
    REFERENCES directory.organizations (id) ON DELETE RESTRICT,
  client_id UUID NOT NULL
    REFERENCES directory.clients (id) ON DELETE RESTRICT,
  source_system TEXT NOT NULL,
  source_version TEXT NOT NULL,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT approved_work_snapshots_source_key
    UNIQUE (cutoff_period_id, source_system, source_version)
);

CREATE INDEX approved_work_snapshots_cutoff_idx
  ON public.approved_work_snapshots (cutoff_period_id, approved_at DESC);

CREATE TABLE public.approved_work_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approved_work_snapshot_id UUID NOT NULL
    REFERENCES public.approved_work_snapshots (id) ON DELETE RESTRICT,
  source_line_key TEXT NOT NULL,
  source_cutoff_hours_id UUID
    REFERENCES public.cutoff_hours (id) ON DELETE RESTRICT,
  directory_employee_id UUID NOT NULL
    REFERENCES directory.employees (id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES directory.client_branches (id) ON DELETE RESTRICT,
  position_id UUID REFERENCES directory.positions (id) ON DELETE RESTRICT,
  employee_code TEXT,
  last_name TEXT,
  first_name TEXT,
  approved_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  regular_hours NUMERIC(12, 4) NOT NULL DEFAULT 0,
  payable BOOLEAN NOT NULL DEFAULT true,
  billable BOOLEAN NOT NULL DEFAULT true,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT approved_work_lines_source_key
    UNIQUE (approved_work_snapshot_id, source_line_key),
  CONSTRAINT approved_work_lines_regular_hours_nonnegative
    CHECK (regular_hours >= 0)
);

CREATE INDEX approved_work_lines_snapshot_name_idx
  ON public.approved_work_lines (
    approved_work_snapshot_id,
    last_name,
    first_name,
    employee_code
  );
CREATE INDEX approved_work_lines_employee_idx
  ON public.approved_work_lines (directory_employee_id);

CREATE TABLE public.payable_charge_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approved_work_snapshot_id UUID NOT NULL
    REFERENCES public.approved_work_snapshots (id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL
    REFERENCES directory.organizations (id) ON DELETE RESTRICT,
  client_id UUID NOT NULL
    REFERENCES directory.clients (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'posted', 'adjusted')),
  batch_version INTEGER NOT NULL DEFAULT 1 CHECK (batch_version > 0),
  adjusts_batch_id UUID
    REFERENCES public.payable_charge_batches (id) ON DELETE RESTRICT,
  adjustment_reason TEXT,
  approved_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  posted_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payable_charge_batches_version_key
    UNIQUE (approved_work_snapshot_id, batch_version),
  CONSTRAINT payable_charge_batches_adjustment_reason_check
    CHECK (
      (adjusts_batch_id IS NULL AND adjustment_reason IS NULL)
      OR (adjusts_batch_id IS NOT NULL AND adjustment_reason IS NOT NULL)
    ),
  CONSTRAINT payable_charge_batches_not_self_adjusting
    CHECK (adjusts_batch_id IS NULL OR adjusts_batch_id <> id)
);

COMMENT ON COLUMN public.payable_charge_batches.adjusts_batch_id IS
  'Payable-only adjustment lineage. It can never reference a billable batch.';
COMMENT ON COLUMN public.payable_charge_batches.status IS
  '''adjusted'' identifies a finalized adjustment batch; posted/adjusted rows are immutable.';

CREATE INDEX payable_charge_batches_snapshot_idx
  ON public.payable_charge_batches (approved_work_snapshot_id, batch_version DESC);
CREATE INDEX payable_charge_batches_adjusts_idx
  ON public.payable_charge_batches (adjusts_batch_id)
  WHERE adjusts_batch_id IS NOT NULL;

CREATE TABLE public.payable_charge_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL
    REFERENCES public.payable_charge_batches (id) ON DELETE RESTRICT,
  approved_work_line_id UUID NOT NULL
    REFERENCES public.approved_work_lines (id) ON DELETE RESTRICT,
  directory_employee_id UUID NOT NULL
    REFERENCES directory.employees (id) ON DELETE RESTRICT,
  employee_code TEXT,
  last_name TEXT,
  first_name TEXT,
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 0,
  rate NUMERIC(14, 6) NOT NULL DEFAULT 0,
  base_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2)
    GENERATED ALWAYS AS (round(base_amount + adjustment_amount, 2)) STORED,
  rate_source JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payable_charge_lines_batch_work_key
    UNIQUE (batch_id, approved_work_line_id)
);

CREATE INDEX payable_charge_lines_batch_name_idx
  ON public.payable_charge_lines (batch_id, last_name, first_name, employee_code);
CREATE INDEX payable_charge_lines_work_idx
  ON public.payable_charge_lines (approved_work_line_id);

CREATE TABLE public.billable_charge_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approved_work_snapshot_id UUID NOT NULL
    REFERENCES public.approved_work_snapshots (id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL
    REFERENCES directory.organizations (id) ON DELETE RESTRICT,
  client_id UUID NOT NULL
    REFERENCES directory.clients (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'posted', 'adjusted')),
  batch_version INTEGER NOT NULL DEFAULT 1 CHECK (batch_version > 0),
  adjusts_batch_id UUID
    REFERENCES public.billable_charge_batches (id) ON DELETE RESTRICT,
  adjustment_reason TEXT,
  approved_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  posted_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billable_charge_batches_version_key
    UNIQUE (approved_work_snapshot_id, batch_version),
  CONSTRAINT billable_charge_batches_adjustment_reason_check
    CHECK (
      (adjusts_batch_id IS NULL AND adjustment_reason IS NULL)
      OR (adjusts_batch_id IS NOT NULL AND adjustment_reason IS NOT NULL)
    ),
  CONSTRAINT billable_charge_batches_not_self_adjusting
    CHECK (adjusts_batch_id IS NULL OR adjusts_batch_id <> id)
);

COMMENT ON COLUMN public.billable_charge_batches.adjusts_batch_id IS
  'Billable-only adjustment lineage. It can never reference a payable batch.';
COMMENT ON COLUMN public.billable_charge_batches.status IS
  '''adjusted'' identifies a finalized adjustment batch; posted/adjusted rows are immutable.';

CREATE INDEX billable_charge_batches_snapshot_idx
  ON public.billable_charge_batches (approved_work_snapshot_id, batch_version DESC);
CREATE INDEX billable_charge_batches_adjusts_idx
  ON public.billable_charge_batches (adjusts_batch_id)
  WHERE adjusts_batch_id IS NOT NULL;

CREATE TABLE public.billable_charge_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL
    REFERENCES public.billable_charge_batches (id) ON DELETE RESTRICT,
  approved_work_line_id UUID NOT NULL
    REFERENCES public.approved_work_lines (id) ON DELETE RESTRICT,
  directory_employee_id UUID NOT NULL
    REFERENCES directory.employees (id) ON DELETE RESTRICT,
  employee_code TEXT,
  last_name TEXT,
  first_name TEXT,
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 0,
  rate NUMERIC(14, 6) NOT NULL DEFAULT 0,
  base_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2)
    GENERATED ALWAYS AS (round(base_amount + adjustment_amount, 2)) STORED,
  rate_source JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billable_charge_lines_batch_work_key
    UNIQUE (batch_id, approved_work_line_id)
);

CREATE INDEX billable_charge_lines_batch_name_idx
  ON public.billable_charge_lines (batch_id, last_name, first_name, employee_code);
CREATE INDEX billable_charge_lines_work_idx
  ON public.billable_charge_lines (approved_work_line_id);

ALTER TABLE public.billing_runs
  ALTER COLUMN payroll_register_run_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS billable_charge_batch_id UUID
    REFERENCES public.billable_charge_batches (id) ON DELETE RESTRICT;

ALTER TABLE public.billing_lines
  ADD COLUMN IF NOT EXISTS source_billable_charge_line_id UUID
    REFERENCES public.billable_charge_lines (id) ON DELETE RESTRICT;

ALTER TABLE public.payroll_register_runs
  ADD COLUMN IF NOT EXISTS payable_charge_batch_id UUID
    REFERENCES public.payable_charge_batches (id) ON DELETE RESTRICT;

ALTER TABLE public.payroll_register_lines
  ADD COLUMN IF NOT EXISTS source_payable_charge_line_id UUID
    REFERENCES public.payable_charge_lines (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_payable_batch_key
  ON public.payroll_register_runs (payable_charge_batch_id)
  WHERE payable_charge_batch_id IS NOT NULL
    AND status = 'posted';

CREATE UNIQUE INDEX IF NOT EXISTS billing_runs_billable_batch_key
  ON public.billing_runs (billable_charge_batch_id)
  WHERE billable_charge_batch_id IS NOT NULL
    AND status = 'processed';

CREATE UNIQUE INDEX IF NOT EXISTS billing_lines_billable_source_key
  ON public.billing_lines (run_id, source_billable_charge_line_id)
  WHERE source_billable_charge_line_id IS NOT NULL;

CREATE FUNCTION public.guard_final_charge_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('posted', 'adjusted') THEN
    RAISE EXCEPTION '% % is immutable after finalization', TG_TABLE_NAME, OLD.id
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE FUNCTION public.guard_approved_work_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'approved work snapshots are immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION public.guard_approved_work_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  snapshot_id UUID;
  has_charge_batch BOOLEAN;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'approved work lines are immutable'
      USING ERRCODE = '55000';
  END IF;
  snapshot_id := NEW.approved_work_snapshot_id;
  SELECT
    EXISTS (
      SELECT 1 FROM public.payable_charge_batches
      WHERE approved_work_snapshot_id = snapshot_id
    )
    OR EXISTS (
      SELECT 1 FROM public.billable_charge_batches
      WHERE approved_work_snapshot_id = snapshot_id
    )
  INTO has_charge_batch;
  IF has_charge_batch THEN
    RAISE EXCEPTION 'approved work cannot gain lines after charge derivation'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.guard_final_payable_charge_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_batch_status TEXT;
  new_batch_status TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status INTO old_batch_status
    FROM public.payable_charge_batches
    WHERE id = OLD.batch_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT status INTO new_batch_status
    FROM public.payable_charge_batches
    WHERE id = NEW.batch_id;
  END IF;
  IF old_batch_status IN ('posted', 'adjusted')
     OR new_batch_status IN ('posted', 'adjusted') THEN
    RAISE EXCEPTION 'payable charge lines are immutable after batch finalization'
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE FUNCTION public.guard_final_billable_charge_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_batch_status TEXT;
  new_batch_status TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status INTO old_batch_status
    FROM public.billable_charge_batches
    WHERE id = OLD.batch_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT status INTO new_batch_status
    FROM public.billable_charge_batches
    WHERE id = NEW.batch_id;
  END IF;
  IF old_batch_status IN ('posted', 'adjusted')
     OR new_batch_status IN ('posted', 'adjusted') THEN
    RAISE EXCEPTION 'billable charge lines are immutable after batch finalization'
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_approved_work_snapshots_immutable
BEFORE UPDATE OR DELETE ON public.approved_work_snapshots
FOR EACH ROW EXECUTE FUNCTION public.guard_approved_work_snapshot();

CREATE TRIGGER trg_approved_work_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.approved_work_lines
FOR EACH ROW EXECUTE FUNCTION public.guard_approved_work_line();

CREATE TRIGGER trg_payable_charge_batches_immutable
BEFORE UPDATE OR DELETE ON public.payable_charge_batches
FOR EACH ROW EXECUTE FUNCTION public.guard_final_charge_batch();

CREATE TRIGGER trg_billable_charge_batches_immutable
BEFORE UPDATE OR DELETE ON public.billable_charge_batches
FOR EACH ROW EXECUTE FUNCTION public.guard_final_charge_batch();

CREATE TRIGGER trg_payable_charge_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.payable_charge_lines
FOR EACH ROW EXECUTE FUNCTION public.guard_final_payable_charge_line();

CREATE TRIGGER trg_billable_charge_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.billable_charge_lines
FOR EACH ROW EXECUTE FUNCTION public.guard_final_billable_charge_line();

CREATE OR REPLACE FUNCTION public.build_cutoff_charge_ledgers(
  p_cutoff_period_id UUID,
  p_source_version TEXT,
  p_billable BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, directory
AS $$
DECLARE
  v_period public.cutoff_periods;
  v_snapshot_id UUID;
  v_payable_batch_id UUID;
  v_billable_batch_id UUID;
BEGIN
  SELECT * INTO v_period
  FROM public.cutoff_periods
  WHERE id = p_cutoff_period_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cutoff period not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status NOT IN ('approved', 'audited', 'posted') THEN
    RAISE EXCEPTION 'Cutoff must be approved before charge derivation';
  END IF;

  INSERT INTO public.approved_work_snapshots (
    cutoff_period_id,
    organization_id,
    client_id,
    source_system,
    source_version,
    source_metadata,
    approved_at
  )
  VALUES (
    v_period.id,
    v_period.organization_id,
    v_period.client_id,
    COALESCE(v_period.source_app, 'gp-hris'),
    p_source_version,
    jsonb_build_object('period_status', v_period.status),
    COALESCE(v_period.approved_at, v_period.audited_at, now())
  )
  ON CONFLICT (cutoff_period_id, source_system, source_version)
  DO NOTHING
  RETURNING id INTO v_snapshot_id;

  IF v_snapshot_id IS NULL THEN
    SELECT id INTO v_snapshot_id
    FROM public.approved_work_snapshots
    WHERE cutoff_period_id = v_period.id
      AND source_system = COALESCE(v_period.source_app, 'gp-hris')
      AND source_version = p_source_version;
    SELECT id INTO v_payable_batch_id
    FROM public.payable_charge_batches
    WHERE approved_work_snapshot_id = v_snapshot_id
      AND batch_version = 1;
    SELECT id INTO v_billable_batch_id
    FROM public.billable_charge_batches
    WHERE approved_work_snapshot_id = v_snapshot_id
      AND batch_version = 1;
    RETURN jsonb_build_object(
      'snapshot_id', v_snapshot_id,
      'payable_batch_id', v_payable_batch_id,
      'billable_batch_id', v_billable_batch_id,
      'duplicate', true
    );
  END IF;

  INSERT INTO public.approved_work_lines (
    approved_work_snapshot_id,
    source_line_key,
    source_cutoff_hours_id,
    directory_employee_id,
    branch_id,
    position_id,
    employee_code,
    last_name,
    first_name,
    approved_hours,
    regular_hours,
    payable,
    billable,
    source_metadata
  )
  SELECT
    v_snapshot_id,
    hours.id::TEXT,
    hours.id,
    hours.directory_employee_id,
    hours.branch_id,
    hours.position_id,
    hours.employee_code,
    hours.last_name,
    hours.first_name,
    jsonb_build_object(
      'regular', hours.actual_regular_hours,
      'overtime', hours.overtime_hours,
      'night_differential', hours.night_diff_hours,
      'legal_holiday', hours.legal_holiday_hours,
      'special_holiday', hours.special_holiday_hours,
      'rest_day', hours.rest_day_hours
    ),
    hours.actual_regular_hours,
    true,
    p_billable,
    jsonb_build_object('cutoff_hours_id', hours.id)
  FROM public.cutoff_hours hours
  WHERE hours.cutoff_period_id = v_period.id;

  INSERT INTO public.payable_charge_batches (
    approved_work_snapshot_id,
    organization_id,
    client_id
  )
  VALUES (v_snapshot_id, v_period.organization_id, v_period.client_id)
  RETURNING id INTO v_payable_batch_id;

  INSERT INTO public.billable_charge_batches (
    approved_work_snapshot_id,
    organization_id,
    client_id
  )
  VALUES (v_snapshot_id, v_period.organization_id, v_period.client_id)
  RETURNING id INTO v_billable_batch_id;

  INSERT INTO public.payable_charge_lines (
    batch_id,
    approved_work_line_id,
    directory_employee_id,
    employee_code,
    last_name,
    first_name,
    quantity,
    rate,
    base_amount,
    rate_source
  )
  SELECT
    v_payable_batch_id,
    work.id,
    work.directory_employee_id,
    work.employee_code,
    work.last_name,
    work.first_name,
    work.regular_hours,
    COALESCE(hours.daily_rate_payroll, employee.daily_rate, 0) / 8,
    round(
      work.regular_hours *
      (COALESCE(hours.daily_rate_payroll, employee.daily_rate, 0) / 8),
      2
    ),
    jsonb_build_object(
      'daily_rate', COALESCE(hours.daily_rate_payroll, employee.daily_rate, 0),
      'hours_per_day', 8
    )
  FROM public.approved_work_lines work
  JOIN public.cutoff_hours hours
    ON hours.id = work.source_cutoff_hours_id
  JOIN directory.employees employee
    ON employee.id = work.directory_employee_id
  WHERE work.approved_work_snapshot_id = v_snapshot_id
    AND work.payable;

  INSERT INTO public.billable_charge_lines (
    batch_id,
    approved_work_line_id,
    directory_employee_id,
    employee_code,
    last_name,
    first_name,
    quantity,
    rate,
    base_amount,
    rate_source
  )
  SELECT
    v_billable_batch_id,
    work.id,
    work.directory_employee_id,
    work.employee_code,
    work.last_name,
    work.first_name,
    work.regular_hours,
    COALESCE(placement.billing_daily_rate, employee.billing_daily_rate, 0) / 8,
    round(
      work.regular_hours *
      (
        COALESCE(
          placement.billing_daily_rate,
          employee.billing_daily_rate,
          0
        ) / 8
      ),
      2
    ),
    jsonb_build_object(
      'daily_rate',
      COALESCE(placement.billing_daily_rate, employee.billing_daily_rate, 0),
      'hours_per_day', 8,
      'placement_id', placement.id
    )
  FROM public.approved_work_lines work
  JOIN directory.employees employee
    ON employee.id = work.directory_employee_id
  LEFT JOIN directory.placements placement
    ON placement.id = employee.current_placement_id
  WHERE work.approved_work_snapshot_id = v_snapshot_id
    AND work.billable;

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'payable_batch_id', v_payable_batch_id,
    'billable_batch_id', v_billable_batch_id,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_cutoff_charge_ledgers(
  UUID, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_cutoff_charge_ledgers(
  UUID, TEXT, BOOLEAN
) TO service_role;

CREATE OR REPLACE FUNCTION public.create_charge_adjustment(
  p_kind TEXT,
  p_source_batch_id UUID,
  p_reason TEXT,
  p_lines JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id UUID;
BEGIN
  IF p_kind NOT IN ('payable', 'billable') THEN
    RAISE EXCEPTION 'Adjustment kind must be payable or billable';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Adjustment reason is required';
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_lines) = 0
  THEN
    RAISE EXCEPTION 'Adjustment requires at least one line';
  END IF;

  IF p_kind = 'payable' THEN
    INSERT INTO public.payable_charge_batches (
      approved_work_snapshot_id,
      organization_id,
      client_id,
      batch_version,
      adjusts_batch_id,
      adjustment_reason
    )
    SELECT
      approved_work_snapshot_id,
      organization_id,
      client_id,
      (
        SELECT COALESCE(max(candidate.batch_version), 0) + 1
        FROM public.payable_charge_batches candidate
        WHERE candidate.approved_work_snapshot_id =
          source.approved_work_snapshot_id
      ),
      id,
      btrim(p_reason)
    FROM public.payable_charge_batches source
    WHERE source.id = p_source_batch_id
      AND source.status IN ('posted', 'adjusted')
    RETURNING id INTO v_batch_id;
    IF v_batch_id IS NULL THEN
      RAISE EXCEPTION 'Final payable source batch not found';
    END IF;

    INSERT INTO public.payable_charge_lines (
      batch_id,
      approved_work_line_id,
      directory_employee_id,
      employee_code,
      last_name,
      first_name,
      quantity,
      rate,
      base_amount,
      adjustment_amount,
      metadata
    )
    SELECT
      v_batch_id,
      source.approved_work_line_id,
      source.directory_employee_id,
      source.employee_code,
      source.last_name,
      source.first_name,
      0,
      0,
      0,
      (line->>'adjustment_amount')::NUMERIC,
      jsonb_build_object('reason', p_reason)
    FROM jsonb_array_elements(p_lines) rows(line)
    JOIN public.payable_charge_lines source
      ON source.batch_id = p_source_batch_id
     AND source.approved_work_line_id =
       (line->>'approved_work_line_id')::UUID;
  ELSE
    INSERT INTO public.billable_charge_batches (
      approved_work_snapshot_id,
      organization_id,
      client_id,
      batch_version,
      adjusts_batch_id,
      adjustment_reason
    )
    SELECT
      approved_work_snapshot_id,
      organization_id,
      client_id,
      (
        SELECT COALESCE(max(candidate.batch_version), 0) + 1
        FROM public.billable_charge_batches candidate
        WHERE candidate.approved_work_snapshot_id =
          source.approved_work_snapshot_id
      ),
      id,
      btrim(p_reason)
    FROM public.billable_charge_batches source
    WHERE source.id = p_source_batch_id
      AND source.status IN ('posted', 'adjusted')
    RETURNING id INTO v_batch_id;
    IF v_batch_id IS NULL THEN
      RAISE EXCEPTION 'Final billable source batch not found';
    END IF;

    INSERT INTO public.billable_charge_lines (
      batch_id,
      approved_work_line_id,
      directory_employee_id,
      employee_code,
      last_name,
      first_name,
      quantity,
      rate,
      base_amount,
      adjustment_amount,
      metadata
    )
    SELECT
      v_batch_id,
      source.approved_work_line_id,
      source.directory_employee_id,
      source.employee_code,
      source.last_name,
      source.first_name,
      0,
      0,
      0,
      (line->>'adjustment_amount')::NUMERIC,
      jsonb_build_object('reason', p_reason)
    FROM jsonb_array_elements(p_lines) rows(line)
    JOIN public.billable_charge_lines source
      ON source.batch_id = p_source_batch_id
     AND source.approved_work_line_id =
       (line->>'approved_work_line_id')::UUID;
  END IF;

  IF (
    SELECT count(*)
    FROM jsonb_array_elements(p_lines)
  ) <> (
    SELECT count(*)
    FROM (
      SELECT approved_work_line_id
      FROM public.payable_charge_lines
      WHERE p_kind = 'payable' AND batch_id = v_batch_id
      UNION ALL
      SELECT approved_work_line_id
      FROM public.billable_charge_lines
      WHERE p_kind = 'billable' AND batch_id = v_batch_id
    ) inserted
  ) THEN
    RAISE EXCEPTION 'One or more adjustment source lines were not found';
  END IF;

  RETURN v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_charge_adjustment(
  TEXT, UUID, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_charge_adjustment(
  TEXT, UUID, TEXT, JSONB
) TO service_role;

ALTER TABLE public.approved_work_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_work_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payable_charge_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payable_charge_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billable_charge_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billable_charge_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY approved_work_snapshots_service
  ON public.approved_work_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY approved_work_lines_service
  ON public.approved_work_lines FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY payable_charge_batches_service
  ON public.payable_charge_batches FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY payable_charge_lines_service
  ON public.payable_charge_lines FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY billable_charge_batches_service
  ON public.billable_charge_batches FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY billable_charge_lines_service
  ON public.billable_charge_lines FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.approved_work_snapshots,
     public.approved_work_lines,
     public.payable_charge_batches,
     public.payable_charge_lines,
     public.billable_charge_batches,
     public.billable_charge_lines
  TO service_role;

NOTIFY pgrst, 'reload schema';
