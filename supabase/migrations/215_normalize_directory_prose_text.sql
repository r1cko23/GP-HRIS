-- One-time backfill: title-case prose fields imported from legacy sources
-- (e.g. manila → Manila, AKASAKA HOSPITALITY → Akasaka Hospitality).
-- Mirrors lib/prose-text.ts normalizeProseText / shouldPreserveRawText.

CREATE OR REPLACE FUNCTION directory.should_preserve_raw_text(v text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IS NULL OR btrim(v) = '' THEN true
    WHEN v ~ '@' THEN true
    WHEN btrim(v) ~ '^[\d\s#\-./()+]+$' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION directory.normalize_prose_text(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN directory.should_preserve_raw_text(v) THEN btrim(v)
    ELSE initcap(lower(btrim(v)))
  END;
$$;

COMMENT ON FUNCTION directory.normalize_prose_text(text) IS
  'Title-case each word; skip emails and mostly-numeric identifiers.';

-- Helper: update column only when normalization would change the value.
CREATE OR REPLACE FUNCTION directory.prose_needs_normalize(v text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    v IS NOT NULL
    AND btrim(v) <> ''
    AND NOT directory.should_preserve_raw_text(v)
    AND v <> directory.normalize_prose_text(v);
$$;

-- ---------------------------------------------------------------------------
-- Clients / branches / positions
-- ---------------------------------------------------------------------------

UPDATE directory.clients
SET
  name = directory.normalize_prose_text(name),
  contact_person = CASE
    WHEN contact_person IS NULL THEN NULL
    ELSE directory.normalize_prose_text(contact_person)
  END,
  address = CASE
    WHEN address IS NULL THEN NULL
    ELSE directory.normalize_prose_text(address)
  END,
  statutory_schedule = CASE
    WHEN statutory_schedule IS NULL THEN NULL
    ELSE directory.normalize_prose_text(statutory_schedule)
  END,
  wtax_schedule = CASE
    WHEN wtax_schedule IS NULL THEN NULL
    ELSE directory.normalize_prose_text(wtax_schedule)
  END,
  sss_basis = CASE
    WHEN sss_basis IS NULL THEN NULL
    ELSE directory.normalize_prose_text(sss_basis)
  END,
  philhealth_basis = CASE
    WHEN philhealth_basis IS NULL THEN NULL
    ELSE directory.normalize_prose_text(philhealth_basis)
  END,
  wtax_basis = CASE
    WHEN wtax_basis IS NULL THEN NULL
    ELSE directory.normalize_prose_text(wtax_basis)
  END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(name)
  OR directory.prose_needs_normalize(contact_person)
  OR directory.prose_needs_normalize(address)
  OR directory.prose_needs_normalize(statutory_schedule)
  OR directory.prose_needs_normalize(wtax_schedule)
  OR directory.prose_needs_normalize(sss_basis)
  OR directory.prose_needs_normalize(philhealth_basis)
  OR directory.prose_needs_normalize(wtax_basis);

UPDATE directory.client_branches
SET
  name = directory.normalize_prose_text(name),
  location = CASE
    WHEN location IS NULL THEN NULL
    ELSE directory.normalize_prose_text(location)
  END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(name)
  OR directory.prose_needs_normalize(location);

UPDATE directory.positions
SET
  job_title = directory.normalize_prose_text(job_title),
  department = CASE
    WHEN department IS NULL THEN NULL
    ELSE directory.normalize_prose_text(department)
  END,
  group_name = CASE
    WHEN group_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(group_name)
  END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(job_title)
  OR directory.prose_needs_normalize(department)
  OR directory.prose_needs_normalize(group_name);

-- ---------------------------------------------------------------------------
-- Employees (201 file)
-- ---------------------------------------------------------------------------

UPDATE directory.employees
SET
  last_name = directory.normalize_prose_text(last_name),
  first_name = directory.normalize_prose_text(first_name),
  middle_name = CASE
    WHEN middle_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(middle_name)
  END,
  address = CASE
    WHEN address IS NULL THEN NULL
    ELSE directory.normalize_prose_text(address)
  END,
  tax_status = CASE
    WHEN tax_status IS NULL THEN NULL
    ELSE directory.normalize_prose_text(tax_status)
  END,
  bank_name = CASE
    WHEN bank_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(bank_name)
  END,
  pay_through = CASE
    WHEN pay_through IS NULL THEN NULL
    ELSE directory.normalize_prose_text(pay_through)
  END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(last_name)
  OR directory.prose_needs_normalize(first_name)
  OR directory.prose_needs_normalize(middle_name)
  OR directory.prose_needs_normalize(address)
  OR directory.prose_needs_normalize(tax_status)
  OR directory.prose_needs_normalize(bank_name)
  OR directory.prose_needs_normalize(pay_through);

-- ---------------------------------------------------------------------------
-- 201 child sheets
-- ---------------------------------------------------------------------------

UPDATE directory.employee_contacts
SET
  name = CASE WHEN name IS NULL THEN NULL ELSE directory.normalize_prose_text(name) END,
  relationship = CASE
    WHEN relationship IS NULL THEN NULL
    ELSE directory.normalize_prose_text(relationship)
  END,
  address = CASE
    WHEN address IS NULL THEN NULL
    ELSE directory.normalize_prose_text(address)
  END,
  city = CASE WHEN city IS NULL THEN NULL ELSE directory.normalize_prose_text(city) END
WHERE
  directory.prose_needs_normalize(name)
  OR directory.prose_needs_normalize(relationship)
  OR directory.prose_needs_normalize(address)
  OR directory.prose_needs_normalize(city);

UPDATE directory.employee_dependents
SET
  first_name = CASE
    WHEN first_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(first_name)
  END,
  last_name = CASE
    WHEN last_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(last_name)
  END,
  relationship = CASE
    WHEN relationship IS NULL THEN NULL
    ELSE directory.normalize_prose_text(relationship)
  END,
  gender = CASE WHEN gender IS NULL THEN NULL ELSE directory.normalize_prose_text(gender) END,
  occupation = CASE
    WHEN occupation IS NULL THEN NULL
    ELSE directory.normalize_prose_text(occupation)
  END
WHERE
  directory.prose_needs_normalize(first_name)
  OR directory.prose_needs_normalize(last_name)
  OR directory.prose_needs_normalize(relationship)
  OR directory.prose_needs_normalize(gender)
  OR directory.prose_needs_normalize(occupation);

UPDATE directory.employee_education
SET
  school = CASE WHEN school IS NULL THEN NULL ELSE directory.normalize_prose_text(school) END,
  degree = CASE WHEN degree IS NULL THEN NULL ELSE directory.normalize_prose_text(degree) END,
  level = CASE WHEN level IS NULL THEN NULL ELSE directory.normalize_prose_text(level) END,
  honors = CASE WHEN honors IS NULL THEN NULL ELSE directory.normalize_prose_text(honors) END
WHERE
  directory.prose_needs_normalize(school)
  OR directory.prose_needs_normalize(degree)
  OR directory.prose_needs_normalize(level)
  OR directory.prose_needs_normalize(honors);

UPDATE directory.employee_job_history
SET
  company = CASE WHEN company IS NULL THEN NULL ELSE directory.normalize_prose_text(company) END,
  position_held = CASE
    WHEN position_held IS NULL THEN NULL
    ELSE directory.normalize_prose_text(position_held)
  END,
  reason_for_leaving = CASE
    WHEN reason_for_leaving IS NULL THEN NULL
    ELSE directory.normalize_prose_text(reason_for_leaving)
  END,
  remarks = CASE WHEN remarks IS NULL THEN NULL ELSE directory.normalize_prose_text(remarks) END
WHERE
  directory.prose_needs_normalize(company)
  OR directory.prose_needs_normalize(position_held)
  OR directory.prose_needs_normalize(reason_for_leaving)
  OR directory.prose_needs_normalize(remarks);

UPDATE directory.employee_licenses
SET
  course = CASE WHEN course IS NULL THEN NULL ELSE directory.normalize_prose_text(course) END
WHERE directory.prose_needs_normalize(course);

UPDATE directory.employee_medical
SET
  medical_type = CASE
    WHEN medical_type IS NULL THEN NULL
    ELSE directory.normalize_prose_text(medical_type)
  END,
  medical_status = CASE
    WHEN medical_status IS NULL THEN NULL
    ELSE directory.normalize_prose_text(medical_status)
  END,
  remarks = CASE WHEN remarks IS NULL THEN NULL ELSE directory.normalize_prose_text(remarks) END
WHERE
  directory.prose_needs_normalize(medical_type)
  OR directory.prose_needs_normalize(medical_status)
  OR directory.prose_needs_normalize(remarks);

UPDATE directory.employee_movements
SET
  status = CASE WHEN status IS NULL THEN NULL ELSE directory.normalize_prose_text(status) END,
  department = CASE
    WHEN department IS NULL THEN NULL
    ELSE directory.normalize_prose_text(department)
  END,
  position = CASE WHEN position IS NULL THEN NULL ELSE directory.normalize_prose_text(position) END,
  remarks = CASE WHEN remarks IS NULL THEN NULL ELSE directory.normalize_prose_text(remarks) END
WHERE
  directory.prose_needs_normalize(status)
  OR directory.prose_needs_normalize(department)
  OR directory.prose_needs_normalize(position)
  OR directory.prose_needs_normalize(remarks);

UPDATE directory.employee_skills
SET
  skill = CASE WHEN skill IS NULL THEN NULL ELSE directory.normalize_prose_text(skill) END,
  proficiency = CASE
    WHEN proficiency IS NULL THEN NULL
    ELSE directory.normalize_prose_text(proficiency)
  END,
  remarks = CASE WHEN remarks IS NULL THEN NULL ELSE directory.normalize_prose_text(remarks) END
WHERE
  directory.prose_needs_normalize(skill)
  OR directory.prose_needs_normalize(proficiency)
  OR directory.prose_needs_normalize(remarks);

UPDATE directory.barred_employees
SET
  last_name = CASE
    WHEN last_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(last_name)
  END,
  first_name = CASE
    WHEN first_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(first_name)
  END,
  middle_name = CASE
    WHEN middle_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(middle_name)
  END,
  client_name = CASE
    WHEN client_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(client_name)
  END,
  department_name = CASE
    WHEN department_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(department_name)
  END
WHERE
  directory.prose_needs_normalize(last_name)
  OR directory.prose_needs_normalize(first_name)
  OR directory.prose_needs_normalize(middle_name)
  OR directory.prose_needs_normalize(client_name)
  OR directory.prose_needs_normalize(department_name);

-- ---------------------------------------------------------------------------
-- Office clock employees (public schema)
-- ---------------------------------------------------------------------------

UPDATE public.employees
SET
  last_name = directory.normalize_prose_text(last_name),
  first_name = directory.normalize_prose_text(first_name),
  middle_name = CASE
    WHEN middle_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(middle_name)
  END,
  full_name = CASE
    WHEN full_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(full_name)
  END,
  address = CASE WHEN address IS NULL THEN NULL ELSE directory.normalize_prose_text(address) END,
  position = CASE WHEN position IS NULL THEN NULL ELSE directory.normalize_prose_text(position) END,
  assigned_hotel = CASE
    WHEN assigned_hotel IS NULL THEN NULL
    ELSE directory.normalize_prose_text(assigned_hotel)
  END,
  hmo_provider = CASE
    WHEN hmo_provider IS NULL THEN NULL
    ELSE directory.normalize_prose_text(hmo_provider)
  END,
  bank_name = CASE
    WHEN bank_name IS NULL THEN NULL
    ELSE directory.normalize_prose_text(bank_name)
  END,
  tax_status = CASE
    WHEN tax_status IS NULL THEN NULL
    ELSE directory.normalize_prose_text(tax_status)
  END,
  pay_through = CASE
    WHEN pay_through IS NULL THEN NULL
    ELSE directory.normalize_prose_text(pay_through)
  END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(last_name)
  OR directory.prose_needs_normalize(first_name)
  OR directory.prose_needs_normalize(middle_name)
  OR directory.prose_needs_normalize(full_name)
  OR directory.prose_needs_normalize(address)
  OR directory.prose_needs_normalize(position)
  OR directory.prose_needs_normalize(assigned_hotel)
  OR directory.prose_needs_normalize(hmo_provider)
  OR directory.prose_needs_normalize(bank_name)
  OR directory.prose_needs_normalize(tax_status)
  OR directory.prose_needs_normalize(pay_through);

UPDATE public.office_locations
SET
  name = directory.normalize_prose_text(name),
  updated_at = now()
WHERE directory.prose_needs_normalize(name);
