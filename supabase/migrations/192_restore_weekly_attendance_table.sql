-- =====================================================
-- MIGRATION: Restore weekly_attendance table (Phase 4)
-- Purpose: Enable workflow gating: payslips are only generated
-- from timesheets that have status = 'finalized'.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'weekly_attendance'
  ) THEN
    CREATE TABLE public.weekly_attendance (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      period_type TEXT DEFAULT 'bimonthly' CHECK (period_type IN ('weekly', 'bimonthly')),
      attendance_data JSONB NOT NULL,
      total_regular_hours DECIMAL(10, 2) DEFAULT 0,
      total_overtime_hours DECIMAL(10, 2) DEFAULT 0,
      total_night_diff_hours DECIMAL(10, 2) DEFAULT 0,
      gross_pay DECIMAL(10, 2) DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
      finalized_at TIMESTAMP WITH TIME ZONE,
      finalized_by UUID REFERENCES public.users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID REFERENCES public.users(id)
      -- Keep uniqueness aligned to code: period_start uniquely identifies a cutoff per employee.
      -- If you later need period_end uniqueness too, add another UNIQUE clause.
    );

    ALTER TABLE public.weekly_attendance
      ADD CONSTRAINT weekly_attendance_employee_period_start_key UNIQUE (employee_id, period_start);
  END IF;
END $$;

-- Ensure indexes exist (even if table existed already but migrations were missed)
CREATE INDEX IF NOT EXISTS idx_weekly_attendance_employee ON public.weekly_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_weekly_attendance_dates ON public.weekly_attendance(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_weekly_attendance_employee_period
  ON public.weekly_attendance(employee_id, period_start DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.weekly_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can view attendance" ON public.weekly_attendance;
CREATE POLICY "All authenticated users can view attendance"
  ON public.weekly_attendance
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "HR and Admin can manage attendance" ON public.weekly_attendance;
CREATE POLICY "HR and Admin can manage attendance"
  ON public.weekly_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'hr')
    )
  );

-- =====================================================
-- UPDATED_AT trigger
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='weekly_attendance') THEN
    DROP TRIGGER IF EXISTS update_weekly_attendance_updated_at ON public.weekly_attendance;
    CREATE TRIGGER update_weekly_attendance_updated_at
      BEFORE UPDATE ON public.weekly_attendance
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

