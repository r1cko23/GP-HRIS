-- Restore daily rates truncated to 2dp that make daily×26 miss a whole-peso monthly.
-- UI shows daily at 2dp; storage/calc keep up to NUMERIC(12,4).
-- Also widen public.employees.per_day so office sync does not re-truncate.

ALTER TABLE public.employees
  ALTER COLUMN per_day TYPE NUMERIC(12, 4)
  USING round(per_day::numeric, 4);

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
      NEW.monthly_rate := round(NEW.daily_rate * 26, 2);
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

UPDATE directory.employees e
SET
  daily_rate = round(round(e.daily_rate * 26, 0) / 26, 4),
  updated_at = now()
WHERE e.daily_rate IS NOT NULL
  AND e.daily_rate > 0
  AND abs(e.daily_rate * 26 - round(e.daily_rate * 26, 0)) > 0.001
  AND abs(e.daily_rate * 26 - round(e.daily_rate * 26, 0)) < 0.05;

UPDATE directory.employees e
SET
  billing_daily_rate = round(round(e.billing_daily_rate * 26, 0) / 26, 4),
  updated_at = now()
WHERE e.billing_daily_rate IS NOT NULL
  AND e.billing_daily_rate > 0
  AND abs(e.billing_daily_rate * 26 - round(e.billing_daily_rate * 26, 0)) > 0.001
  AND abs(e.billing_daily_rate * 26 - round(e.billing_daily_rate * 26, 0)) < 0.05;

UPDATE directory.positions p
SET
  payroll_daily_rate = round(round(p.payroll_daily_rate * 26, 0) / 26, 4),
  updated_at = now()
WHERE p.payroll_daily_rate IS NOT NULL
  AND p.payroll_daily_rate > 0
  AND abs(p.payroll_daily_rate * 26 - round(p.payroll_daily_rate * 26, 0)) > 0.001
  AND abs(p.payroll_daily_rate * 26 - round(p.payroll_daily_rate * 26, 0)) < 0.05;

UPDATE directory.positions p
SET
  billing_daily_rate = round(round(p.billing_daily_rate * 26, 0) / 26, 4),
  updated_at = now()
WHERE p.billing_daily_rate IS NOT NULL
  AND p.billing_daily_rate > 0
  AND abs(p.billing_daily_rate * 26 - round(p.billing_daily_rate * 26, 0)) > 0.001
  AND abs(p.billing_daily_rate * 26 - round(p.billing_daily_rate * 26, 0)) < 0.05;

-- Mirror restored directory payroll daily onto linked office rows.
UPDATE public.employees o
SET
  daily_rate = d.daily_rate,
  per_day = d.daily_rate,
  monthly_rate = round(d.daily_rate * 26, 2),
  billing_daily_rate = COALESCE(d.billing_daily_rate, o.billing_daily_rate),
  updated_at = now()
FROM directory.employees d
WHERE o.directory_employee_id = d.id
  AND d.daily_rate IS NOT NULL
  AND d.daily_rate > 0
  AND (
    o.daily_rate IS DISTINCT FROM d.daily_rate
    OR o.per_day IS DISTINCT FROM d.daily_rate
    OR o.monthly_rate IS DISTINCT FROM round(d.daily_rate * 26, 2)
  );
