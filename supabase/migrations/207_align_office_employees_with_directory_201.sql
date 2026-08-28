-- Align public.employees with directory.employees (201 file shape).
-- Legacy clock/leave columns are kept during the webapp redesign; triggers mirror values both ways.

-- ---------------------------------------------------------------------------
-- Directory-shaped columns on office employees
-- ---------------------------------------------------------------------------

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES directory.organizations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES directory.client_branches (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES directory.positions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_code TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS regular_date DATE,
  ADD COLUMN IF NOT EXISTS resign_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS billing_daily_rate NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS ecola NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS tin TEXT,
  ADD COLUMN IF NOT EXISTS tax_status TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_no TEXT,
  ADD COLUMN IF NOT EXISTS gcash TEXT,
  ADD COLUMN IF NOT EXISTS pay_through TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS mobile TEXT,
  ADD COLUMN IF NOT EXISTS legacy_id INTEGER;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_status_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_status_check CHECK (
    status IS NULL
    OR status IN (
      'active',
      'inactive',
      'barred',
      'float',
      'for_release',
      'for_verification'
    )
  );

CREATE INDEX IF NOT EXISTS employees_organization_id_idx
  ON public.employees (organization_id);

CREATE INDEX IF NOT EXISTS employees_status_idx
  ON public.employees (status);

CREATE INDEX IF NOT EXISTS employees_employee_code_idx
  ON public.employees (employee_code)
  WHERE employee_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS employees_directory_client_id_idx
  ON public.employees (directory_client_id)
  WHERE directory_client_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill from existing office columns
-- ---------------------------------------------------------------------------

UPDATE public.employees
SET
  employee_code = COALESCE(employee_code, employee_id),
  middle_name = COALESCE(
    middle_name,
    NULLIF(TRIM(middle_initial), '')
  ),
  sex = COALESCE(
    sex,
    CASE
      WHEN gender IS NULL OR TRIM(gender) = '' THEN NULL
      WHEN LOWER(TRIM(gender)) LIKE 'm%' THEN 'Male'
      WHEN LOWER(TRIM(gender)) LIKE 'f%' THEN 'Female'
      ELSE INITCAP(TRIM(gender))
    END
  ),
  tin = COALESCE(tin, NULLIF(TRIM(tin_number), '')),
  daily_rate = COALESCE(daily_rate, per_day),
  status = COALESCE(
    status,
    CASE
      WHEN is_active IS TRUE THEN 'active'
      WHEN is_active IS FALSE THEN 'inactive'
      ELSE 'active'
    END
  )
WHERE employee_code IS NULL
   OR middle_name IS NULL
   OR sex IS NULL
   OR tin IS NULL
   OR daily_rate IS NULL
   OR status IS NULL;

-- Pull full 201 identity from linked Directory rows (Organic / reconciled)
UPDATE public.employees e
SET
  organization_id = d.organization_id,
  branch_id = d.branch_id,
  position_id = d.position_id,
  employee_code = COALESCE(e.employee_code, d.employee_code, e.employee_id),
  first_name = COALESCE(NULLIF(TRIM(e.first_name), ''), d.first_name),
  last_name = COALESCE(NULLIF(TRIM(e.last_name), ''), d.last_name),
  middle_name = COALESCE(e.middle_name, d.middle_name),
  sex = COALESCE(e.sex, d.sex),
  birth_date = COALESCE(e.birth_date, d.birth_date),
  hire_date = COALESCE(e.hire_date, d.hire_date),
  regular_date = COALESCE(e.regular_date, d.regular_date),
  resign_date = COALESCE(e.resign_date, d.resign_date),
  status = COALESCE(e.status, d.status),
  daily_rate = COALESCE(e.daily_rate, d.daily_rate),
  billing_daily_rate = COALESCE(e.billing_daily_rate, d.billing_daily_rate),
  ecola = COALESCE(e.ecola, d.ecola),
  tin = COALESCE(e.tin, d.tin),
  sss_number = COALESCE(NULLIF(TRIM(e.sss_number), ''), d.sss_number),
  philhealth_number = COALESCE(NULLIF(TRIM(e.philhealth_number), ''), d.philhealth_number),
  pagibig_number = COALESCE(NULLIF(TRIM(e.pagibig_number), ''), d.pagibig_number),
  tax_status = COALESCE(e.tax_status, d.tax_status),
  bank_name = COALESCE(e.bank_name, d.bank_name),
  bank_account_no = COALESCE(e.bank_account_no, d.bank_account_no),
  gcash = COALESCE(e.gcash, d.gcash),
  pay_through = COALESCE(e.pay_through, d.pay_through),
  email = COALESCE(e.email, d.email),
  mobile = COALESCE(e.mobile, d.mobile),
  address = COALESCE(NULLIF(TRIM(e.address), ''), d.address),
  profile_picture_url = COALESCE(e.profile_picture_url, d.profile_picture_url),
  legacy_id = COALESCE(e.legacy_id, d.legacy_id),
  directory_client_id = COALESCE(e.directory_client_id, d.client_id)
FROM directory.employees d
WHERE e.directory_employee_id = d.id;

-- Organic org default for active office staff without organization_id
UPDATE public.employees e
SET organization_id = o.id
FROM directory.organizations o
WHERE e.organization_id IS NULL
  AND o.slug = 'organic';

-- ---------------------------------------------------------------------------
-- Bidirectional mirror: new 201 columns ↔ legacy clock columns (transition)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_employees_201_legacy_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_code IS NOT NULL AND NEW.employee_code IS DISTINCT FROM NEW.employee_id THEN
    NEW.employee_id := NEW.employee_code;
  ELSIF NEW.employee_id IS NOT NULL AND NEW.employee_code IS NULL THEN
    NEW.employee_code := NEW.employee_id;
  END IF;

  IF NEW.middle_name IS NOT NULL AND NEW.middle_name IS DISTINCT FROM NEW.middle_initial THEN
    NEW.middle_initial := UPPER(LEFT(TRIM(NEW.middle_name), 1));
  ELSIF NEW.middle_initial IS NOT NULL AND NEW.middle_name IS NULL THEN
    NEW.middle_name := NEW.middle_initial;
  END IF;

  IF NEW.sex IS NOT NULL THEN
    NEW.gender := CASE
      WHEN LOWER(TRIM(NEW.sex)) LIKE 'm%' THEN 'male'
      WHEN LOWER(TRIM(NEW.sex)) LIKE 'f%' THEN 'female'
      ELSE LOWER(TRIM(NEW.sex))
    END;
  ELSIF NEW.gender IS NOT NULL AND NEW.sex IS NULL THEN
    NEW.sex := CASE
      WHEN LOWER(TRIM(NEW.gender)) LIKE 'm%' THEN 'Male'
      WHEN LOWER(TRIM(NEW.gender)) LIKE 'f%' THEN 'Female'
      ELSE INITCAP(TRIM(NEW.gender))
    END;
  END IF;

  IF NEW.tin IS NOT NULL AND NEW.tin IS DISTINCT FROM NEW.tin_number THEN
    NEW.tin_number := NEW.tin;
  ELSIF NEW.tin_number IS NOT NULL AND NEW.tin IS NULL THEN
    NEW.tin := NEW.tin_number;
  END IF;

  IF NEW.daily_rate IS NOT NULL AND NEW.daily_rate IS DISTINCT FROM NEW.per_day THEN
    NEW.per_day := NEW.daily_rate;
    IF NEW.monthly_rate IS NULL OR NEW.monthly_rate = 0 THEN
      NEW.monthly_rate := NEW.daily_rate * 26;
    END IF;
  ELSIF NEW.per_day IS NOT NULL AND NEW.daily_rate IS NULL THEN
    NEW.daily_rate := NEW.per_day;
  END IF;

  IF NEW.status IS NOT NULL THEN
    NEW.is_active := (NEW.status = 'active');
  ELSIF NEW.is_active IS NOT NULL AND NEW.status IS NULL THEN
    NEW.status := CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END;
  END IF;

  IF NEW.position_id IS NOT NULL THEN
    SELECT p.job_title
    INTO NEW.position
    FROM directory.positions p
    WHERE p.id = NEW.position_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employees_201_legacy_columns ON public.employees;
CREATE TRIGGER trg_sync_employees_201_legacy_columns
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_employees_201_legacy_columns();

-- ---------------------------------------------------------------------------
-- Read model: office row in Directory 201 shape (for redesign / APIs)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.employees_as_201 AS
SELECT
  e.id,
  e.organization_id,
  e.directory_client_id AS client_id,
  e.branch_id,
  e.position_id,
  COALESCE(e.employee_code, e.employee_id) AS employee_code,
  e.last_name,
  e.first_name,
  e.middle_name,
  e.sex,
  e.birth_date,
  e.hire_date,
  e.regular_date,
  e.resign_date,
  e.status,
  e.daily_rate,
  e.billing_daily_rate,
  e.ecola,
  e.tin,
  e.sss_number,
  e.philhealth_number,
  e.pagibig_number,
  e.tax_status,
  e.bank_name,
  e.bank_account_no,
  e.gcash,
  e.pay_through,
  e.email,
  e.mobile,
  e.address,
  e.profile_picture_url,
  e.legacy_id,
  e.directory_employee_id,
  e.created_at,
  e.updated_at,
  e.full_name,
  e.job_level,
  e.employee_type,
  e.monthly_rate,
  e.portal_password,
  e.eligible_for_ot,
  e.overtime_group_id,
  e.overtime_approver_id,
  e.overtime_viewer_id,
  e.sil_credits,
  e.sil_allotted,
  e.sil_days_used,
  e.sil_balance_year,
  e.sil_last_accrual,
  e.maternity_credits,
  e.paternity_credits,
  e.transferred_from_employee_id,
  e.company_id
FROM public.employees e;

COMMENT ON VIEW public.employees_as_201 IS
  'Office employees in Directory 201 column names plus GP-HRIS clock/leave extensions.';
