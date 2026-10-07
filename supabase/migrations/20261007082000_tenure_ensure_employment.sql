-- Hire / rehire still insert employment_tenures from app code that predated
-- directory.employments. When employment_id is omitted, create or reuse the
-- Employment row so NOT NULL does not block Add employee.

CREATE OR REPLACE FUNCTION directory.ensure_tenure_employment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = directory, public
AS $$
DECLARE
  v_employment_id UUID;
  v_status TEXT;
BEGIN
  IF NEW.employment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_employment_id
  FROM directory.employments
  WHERE organization_id = NEW.organization_id
    AND employee_id = NEW.employee_id;

  IF v_employment_id IS NULL THEN
    v_status := CASE
      WHEN NEW.status = 'for_verification' THEN 'pending'
      WHEN NEW.status IN ('inactive', 'barred') THEN 'inactive'
      ELSE 'active'
    END;

    INSERT INTO directory.employments (
      organization_id,
      employee_id,
      status,
      original_hire_date
    )
    VALUES (
      NEW.organization_id,
      NEW.employee_id,
      v_status,
      NEW.hire_date
    )
    RETURNING id INTO v_employment_id;
  END IF;

  NEW.employment_id := v_employment_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employment_tenures_ensure_employment
  ON directory.employment_tenures;

CREATE TRIGGER employment_tenures_ensure_employment
  BEFORE INSERT OR UPDATE OF employment_id
  ON directory.employment_tenures
  FOR EACH ROW
  EXECUTE FUNCTION directory.ensure_tenure_employment();

NOTIFY pgrst, 'reload schema';
