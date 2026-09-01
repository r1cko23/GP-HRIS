-- Fix normalize_prose_text (initcap-based) and re-run backfill after 215 regex bug.

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

UPDATE directory.clients
SET
  name = directory.normalize_prose_text(name),
  contact_person = CASE WHEN contact_person IS NULL THEN NULL ELSE directory.normalize_prose_text(contact_person) END,
  address = CASE WHEN address IS NULL THEN NULL ELSE directory.normalize_prose_text(address) END,
  statutory_schedule = CASE WHEN statutory_schedule IS NULL THEN NULL ELSE directory.normalize_prose_text(statutory_schedule) END,
  wtax_schedule = CASE WHEN wtax_schedule IS NULL THEN NULL ELSE directory.normalize_prose_text(wtax_schedule) END,
  sss_basis = CASE WHEN sss_basis IS NULL THEN NULL ELSE directory.normalize_prose_text(sss_basis) END,
  philhealth_basis = CASE WHEN philhealth_basis IS NULL THEN NULL ELSE directory.normalize_prose_text(philhealth_basis) END,
  wtax_basis = CASE WHEN wtax_basis IS NULL THEN NULL ELSE directory.normalize_prose_text(wtax_basis) END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(name) OR directory.prose_needs_normalize(contact_person)
  OR directory.prose_needs_normalize(address) OR directory.prose_needs_normalize(statutory_schedule)
  OR directory.prose_needs_normalize(wtax_schedule) OR directory.prose_needs_normalize(sss_basis)
  OR directory.prose_needs_normalize(philhealth_basis) OR directory.prose_needs_normalize(wtax_basis);

UPDATE directory.client_branches
SET
  name = directory.normalize_prose_text(name),
  location = CASE WHEN location IS NULL THEN NULL ELSE directory.normalize_prose_text(location) END,
  updated_at = now()
WHERE directory.prose_needs_normalize(name) OR directory.prose_needs_normalize(location);

UPDATE directory.positions
SET
  job_title = directory.normalize_prose_text(job_title),
  department = CASE WHEN department IS NULL THEN NULL ELSE directory.normalize_prose_text(department) END,
  group_name = CASE WHEN group_name IS NULL THEN NULL ELSE directory.normalize_prose_text(group_name) END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(job_title)
  OR directory.prose_needs_normalize(department)
  OR directory.prose_needs_normalize(group_name);

UPDATE directory.employees
SET
  last_name = directory.normalize_prose_text(last_name),
  first_name = directory.normalize_prose_text(first_name),
  middle_name = CASE WHEN middle_name IS NULL THEN NULL ELSE directory.normalize_prose_text(middle_name) END,
  address = CASE WHEN address IS NULL THEN NULL ELSE directory.normalize_prose_text(address) END,
  tax_status = CASE WHEN tax_status IS NULL THEN NULL ELSE directory.normalize_prose_text(tax_status) END,
  bank_name = CASE WHEN bank_name IS NULL THEN NULL ELSE directory.normalize_prose_text(bank_name) END,
  pay_through = CASE WHEN pay_through IS NULL THEN NULL ELSE directory.normalize_prose_text(pay_through) END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(last_name) OR directory.prose_needs_normalize(first_name)
  OR directory.prose_needs_normalize(middle_name) OR directory.prose_needs_normalize(address)
  OR directory.prose_needs_normalize(tax_status) OR directory.prose_needs_normalize(bank_name)
  OR directory.prose_needs_normalize(pay_through);

UPDATE directory.employee_contacts
SET
  name = CASE WHEN name IS NULL THEN NULL ELSE directory.normalize_prose_text(name) END,
  relationship = CASE WHEN relationship IS NULL THEN NULL ELSE directory.normalize_prose_text(relationship) END,
  address = CASE WHEN address IS NULL THEN NULL ELSE directory.normalize_prose_text(address) END,
  city = CASE WHEN city IS NULL THEN NULL ELSE directory.normalize_prose_text(city) END
WHERE
  directory.prose_needs_normalize(name) OR directory.prose_needs_normalize(relationship)
  OR directory.prose_needs_normalize(address) OR directory.prose_needs_normalize(city);

UPDATE public.employees
SET
  last_name = directory.normalize_prose_text(last_name),
  first_name = directory.normalize_prose_text(first_name),
  middle_name = CASE WHEN middle_name IS NULL THEN NULL ELSE directory.normalize_prose_text(middle_name) END,
  full_name = CASE WHEN full_name IS NULL THEN NULL ELSE directory.normalize_prose_text(full_name) END,
  address = CASE WHEN address IS NULL THEN NULL ELSE directory.normalize_prose_text(address) END,
  position = CASE WHEN position IS NULL THEN NULL ELSE directory.normalize_prose_text(position) END,
  assigned_hotel = CASE WHEN assigned_hotel IS NULL THEN NULL ELSE directory.normalize_prose_text(assigned_hotel) END,
  hmo_provider = CASE WHEN hmo_provider IS NULL THEN NULL ELSE directory.normalize_prose_text(hmo_provider) END,
  bank_name = CASE WHEN bank_name IS NULL THEN NULL ELSE directory.normalize_prose_text(bank_name) END,
  tax_status = CASE WHEN tax_status IS NULL THEN NULL ELSE directory.normalize_prose_text(tax_status) END,
  pay_through = CASE WHEN pay_through IS NULL THEN NULL ELSE directory.normalize_prose_text(pay_through) END,
  updated_at = now()
WHERE
  directory.prose_needs_normalize(last_name) OR directory.prose_needs_normalize(first_name)
  OR directory.prose_needs_normalize(middle_name) OR directory.prose_needs_normalize(full_name)
  OR directory.prose_needs_normalize(address) OR directory.prose_needs_normalize(position)
  OR directory.prose_needs_normalize(assigned_hotel) OR directory.prose_needs_normalize(hmo_provider)
  OR directory.prose_needs_normalize(bank_name) OR directory.prose_needs_normalize(tax_status)
  OR directory.prose_needs_normalize(pay_through);

UPDATE public.office_locations
SET name = directory.normalize_prose_text(name), updated_at = now()
WHERE directory.prose_needs_normalize(name);
