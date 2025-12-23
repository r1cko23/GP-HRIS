-- Part 2: Create Schedules and Time Entries for Test Employees
-- =============================================================

DO $$
DECLARE
  test_emp_1_id UUID;
  test_emp_2_id UUID;
  test_emp_3_id UUID;
  test_emp_4_id UUID;
  jericko_id UUID := '00eae364-a755-4846-8d77-b72dfff422f1';
  current_date DATE;
  week_start DATE := '2025-12-01';
BEGIN
  -- Get employee IDs
  SELECT id INTO test_emp_1_id FROM employees WHERE employee_id = 'TEST001';
  SELECT id INTO test_emp_2_id FROM employees WHERE employee_id = 'TEST002';
  SELECT id INTO test_emp_3_id FROM employees WHERE employee_id = 'TEST003';
  SELECT id INTO test_emp_4_id FROM employees WHERE employee_id = 'TEST004';

  -- Create schedules for all test employees and Jericko
  FOR current_date IN SELECT generate_series('2025-12-01'::date, '2025-12-15'::date, '1 day'::interval)::date
  LOOP
    -- Rest days: Dec 1 (Mon), Dec 7 (Sun), Dec 14 (Sun)
    IF current_date IN ('2025-12-01', '2025-12-07', '2025-12-14') THEN
      -- Rest days - day_off = true
      INSERT INTO employee_week_schedules (employee_id, week_start, schedule_date, day_off, start_time, end_time)
      VALUES
        (test_emp_1_id, week_start, current_date, true, NULL, NULL),
        (test_emp_2_id, week_start, current_date, true, NULL, NULL),
        (test_emp_3_id, week_start, current_date, true, NULL, NULL),
        (test_emp_4_id, week_start, current_date, true, NULL, NULL),
        (jericko_id, week_start, current_date, true, NULL, NULL)
      ON CONFLICT DO NOTHING;
    ELSE
      -- Regular work days - day_off = false, 8AM-5PM
      INSERT INTO employee_week_schedules (employee_id, week_start, schedule_date, day_off, start_time, end_time)
      VALUES
        (test_emp_1_id, week_start, current_date, false, '08:00:00', '17:00:00'),
        (test_emp_2_id, week_start, current_date, false, '08:00:00', '17:00:00'),
        (test_emp_3_id, week_start, current_date, false, '08:00:00', '17:00:00'),
        (test_emp_4_id, week_start, current_date, false, '08:00:00', '17:00:00'),
        (jericko_id, week_start, current_date, false, '08:00:00', '17:00:00')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

