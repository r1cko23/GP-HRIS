-- Employee codes are year+month + sequence: YYYYMM-##### (e.g. 202601-00001).

CREATE OR REPLACE FUNCTION directory.allocate_employee_code(
  p_org uuid,
  p_hire_date date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = directory
AS $$
DECLARE
  v_prefix text := to_char(COALESCE(p_hire_date, CURRENT_DATE), 'YYYYMM');
  v_next int;
  v_code text;
BEGIN
  SELECT COALESCE(MAX(seq), 0) + 1
  INTO v_next
  FROM (
    SELECT CAST(substring(employee_code FROM 8) AS int) AS seq
    FROM directory.employees
    WHERE organization_id = p_org
      AND employee_code ~ ('^' || v_prefix || '-[0-9]{5}$')
    UNION ALL
    SELECT CAST(substring(alias_code FROM 8) AS int) AS seq
    FROM directory.employee_code_aliases
    WHERE organization_id = p_org
      AND alias_code ~ ('^' || v_prefix || '-[0-9]{5}$')
  ) s;

  v_code := v_prefix || '-' || lpad(v_next::text, 5, '0');
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION directory.allocate_employee_code(uuid, date) TO service_role;

COMMENT ON FUNCTION directory.allocate_employee_code(uuid, date) IS
  'Issues immutable Directory employee_code: YYYYMM-##### from first hire year-month.';

COMMENT ON COLUMN directory.employees.employee_code_source IS
  'legacy = GREENHRISMAIN / kept code; directory = YYYYMM-##### issued by Directory.';

NOTIFY pgrst, 'reload schema';
