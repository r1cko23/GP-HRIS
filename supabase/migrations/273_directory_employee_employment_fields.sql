-- GREENHRISMAIN Employee encode fields for Directory 201 / Add employee.
-- employee_status → employment_type
-- typeofcontract → contract_type
-- contractend → contract_end_date
-- pstatus → civil_status
-- dateregular already lives as regular_date

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS employment_type TEXT,
  ADD COLUMN IF NOT EXISTS contract_type TEXT,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS civil_status TEXT;

COMMENT ON COLUMN directory.employees.employment_type IS
  'GREENHRISMAIN Employee.employee_status (Probationary, Regular, Contractual, On-Call, …).';
COMMENT ON COLUMN directory.employees.contract_type IS
  'GREENHRISMAIN Employee.typeofcontract.';
COMMENT ON COLUMN directory.employees.contract_end_date IS
  'GREENHRISMAIN Employee.contractend (when present).';
COMMENT ON COLUMN directory.employees.civil_status IS
  'GREENHRISMAIN Employee.pstatus (civil / marital status).';

-- Promote already-scrubbed legacy employment type onto the writable encode column.
UPDATE directory.employees
SET employment_type = NULLIF(btrim(legacy_employee_status), '')
WHERE employment_type IS NULL
  AND legacy_employee_status IS NOT NULL
  AND btrim(legacy_employee_status) <> '';

CREATE INDEX IF NOT EXISTS employees_employment_type_idx
  ON directory.employees (organization_id, employment_type)
  WHERE employment_type IS NOT NULL;
