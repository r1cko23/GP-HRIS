-- Comprehensive Test Data for Payroll Calculation Verification
-- =============================================================
-- This migration creates test employees and time entries for Dec 1-15, 2025
-- to verify all payroll calculation logic across different employee types

-- Step 1: Create Test Employees for Each Job Level
-- ================================================

-- Test Employee 1: Rank and File (Office-based)
INSERT INTO employees (
  employee_id,
  first_name,
  last_name,
  full_name,
  position,
  employee_type,
  job_level,
  per_day,
  monthly_rate,
  eligible_for_ot,
  assigned_hotel,
  is_active,
  hire_date
) VALUES (
  'TEST001',
  'Juan',
  'Dela Cruz',
  'Juan P. Dela Cruz',
  'DATA ENCODER',
  'office-based',
  'RANK AND FILE',
  1200.00,  -- Daily rate: ₱1,200
  26400.00, -- Monthly: ₱26,400 (22 days × ₱1,200)
  true,
  'Green Pasture',
  true,
  '2024-01-01'
) ON CONFLICT (employee_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  position = EXCLUDED.position,
  employee_type = EXCLUDED.employee_type,
  job_level = EXCLUDED.job_level,
  per_day = EXCLUDED.per_day,
  monthly_rate = EXCLUDED.monthly_rate,
  eligible_for_ot = EXCLUDED.eligible_for_ot;

-- Test Employee 2: Supervisory Client-based (Account Supervisor)
INSERT INTO employees (
  employee_id,
  first_name,
  last_name,
  full_name,
  position,
  employee_type,
  job_level,
  per_day,
  monthly_rate,
  eligible_for_ot,
  assigned_hotel,
  is_active,
  hire_date
) VALUES (
  'TEST002',
  'Maria',
  'Santos',
  'Maria R. Santos',
  'ACCOUNT SUPERVISOR',
  'client-based',
  'SUPERVISORY',
  2000.00,  -- Daily rate: ₱2,000
  44000.00, -- Monthly: ₱44,000 (22 days × ₱2,000)
  true,
  'Green Pasture',
  true,
  '2024-01-01'
) ON CONFLICT (employee_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  position = EXCLUDED.position,
  employee_type = EXCLUDED.employee_type,
  job_level = EXCLUDED.job_level,
  per_day = EXCLUDED.per_day,
  monthly_rate = EXCLUDED.monthly_rate,
  eligible_for_ot = EXCLUDED.eligible_for_ot;

-- Test Employee 3: Supervisory Office-based (HR Supervisor)
INSERT INTO employees (
  employee_id,
  first_name,
  last_name,
  full_name,
  position,
  employee_type,
  job_level,
  per_day,
  monthly_rate,
  eligible_for_ot,
  assigned_hotel,
  is_active,
  hire_date
) VALUES (
  'TEST003',
  'Pedro',
  'Garcia',
  'Pedro M. Garcia',
  'HR OPERATIONS SUPERVISOR',
  'office-based',
  'SUPERVISORY',
  1800.00,  -- Daily rate: ₱1,800
  39600.00, -- Monthly: ₱39,600 (22 days × ₱1,800)
  true,
  'Green Pasture',
  true,
  '2024-01-01'
) ON CONFLICT (employee_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  position = EXCLUDED.position,
  employee_type = EXCLUDED.employee_type,
  job_level = EXCLUDED.job_level,
  per_day = EXCLUDED.per_day,
  monthly_rate = EXCLUDED.monthly_rate,
  eligible_for_ot = EXCLUDED.eligible_for_ot;

-- Test Employee 4: Managerial (Office-based)
INSERT INTO employees (
  employee_id,
  first_name,
  last_name,
  full_name,
  position,
  employee_type,
  job_level,
  per_day,
  monthly_rate,
  eligible_for_ot,
  assigned_hotel,
  is_active,
  hire_date
) VALUES (
  'TEST004',
  'Ana',
  'Reyes',
  'Ana L. Reyes',
  'HR MANAGER',
  'office-based',
  'MANAGERIAL',
  2500.00,  -- Daily rate: ₱2,500
  55000.00, -- Monthly: ₱55,000 (22 days × ₱2,500)
  true,
  'Green Pasture',
  true,
  '2024-01-01'
) ON CONFLICT (employee_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  position = EXCLUDED.position,
  employee_type = EXCLUDED.employee_type,
  job_level = EXCLUDED.job_level,
  per_day = EXCLUDED.per_day,
  monthly_rate = EXCLUDED.monthly_rate,
  eligible_for_ot = EXCLUDED.eligible_for_ot;

-- Step 2: Create Schedules for Test Employees (Dec 1-15, 2025)
-- =============================================================
-- Rest days: Dec 1 (Mon), Dec 7 (Sun), Dec 14 (Sun)

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

-- Step 3: Create Time Entries for Test Employees (Dec 1-15, 2025)
-- =================================================================
-- Test scenarios:
-- - Regular days with OT
-- - Regular days with ND
-- - Special holiday (Dec 8) - worked
-- - Rest days (Dec 1, 7, 14) - some worked, some not
-- - Regular days without OT/ND

DO $$
DECLARE
  test_emp_1_id UUID;
  test_emp_2_id UUID;
  test_emp_3_id UUID;
  test_emp_4_id UUID;
  jericko_id UUID := '00eae364-a755-4846-8d77-b72dfff422f1';
BEGIN
  -- Get employee IDs
  SELECT id INTO test_emp_1_id FROM employees WHERE employee_id = 'TEST001';
  SELECT id INTO test_emp_2_id FROM employees WHERE employee_id = 'TEST002';
  SELECT id INTO test_emp_3_id FROM employees WHERE employee_id = 'TEST003';
  SELECT id INTO test_emp_4_id FROM employees WHERE employee_id = 'TEST004';

  -- Delete existing entries for test period
  DELETE FROM time_clock_entries
  WHERE employee_id IN (test_emp_1_id, test_emp_2_id, test_emp_3_id, test_emp_4_id, jericko_id)
  AND clock_in_time >= '2025-12-01' AND clock_in_time < '2025-12-16';

  -- ===================================================================
  -- TEST EMPLOYEE 1: Rank and File (Office-based)
  -- ===================================================================
  -- Regular days with various OT/ND scenarios
  -- Dec 2 (Tue) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-02 00:00:00+00', '2025-12-02 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.101', 8.0, 0.0, 0.0);

  -- Dec 3 (Wed) - Regular day, 8 hours + 2 hours OT (with ND)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-03 00:00:00+00', '2025-12-03 11:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.102', 8.0, 2.0, 1.0);

  -- Dec 4 (Thu) - Regular day, 8 hours + 4 hours OT (no ND)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-04 00:00:00+00', '2025-12-04 13:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.103', 8.0, 4.0, 0.0);

  -- Dec 5 (Fri) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-05 00:00:00+00', '2025-12-05 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.104', 8.0, 0.0, 0.0);

  -- Dec 6 (Sat) - Half day, 4 hours
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-06 00:00:00+00', '2025-12-06 04:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.105', 4.0, 0.0, 0.0);

  -- Dec 8 (Mon) - SPECIAL HOLIDAY - 8 hours worked
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-08 00:00:00+00', '2025-12-08 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.106', 8.0, 0.0, 0.0);

  -- Dec 9 (Tue) - Regular day, 8 hours + 3 hours OT (with ND)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-09 00:00:00+00', '2025-12-09 12:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.107', 8.0, 3.0, 2.0);

  -- Dec 10 (Wed) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-10 00:00:00+00', '2025-12-10 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.108', 8.0, 0.0, 0.0);

  -- Dec 11 (Thu) - Regular day, 8 hours + 1 hour OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-11 00:00:00+00', '2025-12-11 10:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.109', 8.0, 1.0, 0.0);

  -- Dec 13 (Sat) - Half day, 4 hours
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-13 00:00:00+00', '2025-12-13 04:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.110', 4.0, 0.0, 0.0);

  -- Dec 15 (Mon) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_1_id, '2025-12-15 00:00:00+00', '2025-12-15 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.111', 8.0, 0.0, 0.0);

  -- ===================================================================
  -- TEST EMPLOYEE 2: Supervisory Client-based (Account Supervisor)
  -- ===================================================================
  -- Regular days with OT (fixed allowances: ₱500 for 3-4 hours, ₱0 for <3 hours)
  -- Dec 2 (Tue) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-02 00:00:00+00', '2025-12-02 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.101', 8.0, 0.0, 0.0);

  -- Dec 3 (Wed) - Regular day, 8 hours + 2 hours OT (should get ₱0 - less than 3 hours)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-03 00:00:00+00', '2025-12-03 11:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.102', 8.0, 2.0, 0.0);

  -- Dec 4 (Thu) - Regular day, 8 hours + 3 hours OT (should get ₱500)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-04 00:00:00+00', '2025-12-04 12:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.103', 8.0, 3.0, 0.0);

  -- Dec 5 (Fri) - Regular day, 8 hours + 5 hours OT (should get ₱500)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-05 00:00:00+00', '2025-12-05 14:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.104', 8.0, 5.0, 0.0);

  -- Dec 6 (Sat) - Half day, 4 hours
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-06 00:00:00+00', '2025-12-06 04:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.105', 4.0, 0.0, 0.0);

  -- Dec 8 (Mon) - SPECIAL HOLIDAY - 8 hours worked + 4 hours OT (should get ₱350 allowance)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-08 00:00:00+00', '2025-12-08 13:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.106', 8.0, 4.0, 0.0);

  -- Dec 9 (Tue) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-09 00:00:00+00', '2025-12-09 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.107', 8.0, 0.0, 0.0);

  -- Dec 10 (Wed) - Regular day, 8 hours + 8 hours OT (should get ₱500)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-10 00:00:00+00', '2025-12-10 17:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.108', 8.0, 8.0, 0.0);

  -- Dec 11 (Thu) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-11 00:00:00+00', '2025-12-11 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.109', 8.0, 0.0, 0.0);

  -- Dec 13 (Sat) - Half day, 4 hours
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-13 00:00:00+00', '2025-12-13 04:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.110', 4.0, 0.0, 0.0);

  -- Dec 15 (Mon) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_2_id, '2025-12-15 00:00:00+00', '2025-12-15 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.111', 8.0, 0.0, 0.0);

  -- ===================================================================
  -- TEST EMPLOYEE 3: Supervisory Office-based (HR Supervisor)
  -- ===================================================================
  -- Regular days with OT (fixed allowances: ₱200 + ₱100 × (hours - 2))
  -- Dec 2 (Tue) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-02 00:00:00+00', '2025-12-02 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.101', 8.0, 0.0, 0.0);

  -- Dec 3 (Wed) - Regular day, 8 hours + 1 hour OT (should get ₱0 - less than 2 hours)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-03 00:00:00+00', '2025-12-03 10:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.102', 8.0, 1.0, 0.0);

  -- Dec 4 (Thu) - Regular day, 8 hours + 2 hours OT (should get ₱200)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-04 00:00:00+00', '2025-12-04 11:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.103', 8.0, 2.0, 0.0);

  -- Dec 5 (Fri) - Regular day, 8 hours + 3 hours OT (should get ₱300 = ₱200 + ₱100)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-05 00:00:00+00', '2025-12-05 12:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.104', 8.0, 3.0, 0.0);

  -- Dec 6 (Sat) - Half day, 4 hours
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-06 00:00:00+00', '2025-12-06 04:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.105', 4.0, 0.0, 0.0);

  -- Dec 8 (Mon) - SPECIAL HOLIDAY - 8 hours worked + 2 hours OT (should get ₱200 allowance)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-08 00:00:00+00', '2025-12-08 11:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.106', 8.0, 2.0, 0.0);

  -- Dec 9 (Tue) - Regular day, 8 hours + 5 hours OT (should get ₱500 = ₱200 + ₱300)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-09 00:00:00+00', '2025-12-09 14:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.107', 8.0, 5.0, 0.0);

  -- Dec 10 (Wed) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-10 00:00:00+00', '2025-12-10 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.108', 8.0, 0.0, 0.0);

  -- Dec 11 (Thu) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-11 00:00:00+00', '2025-12-11 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.109', 8.0, 0.0, 0.0);

  -- Dec 13 (Sat) - Half day, 4 hours
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-13 00:00:00+00', '2025-12-13 04:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.110', 4.0, 0.0, 0.0);

  -- Dec 15 (Mon) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_3_id, '2025-12-15 00:00:00+00', '2025-12-15 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.111', 8.0, 0.0, 0.0);

  -- ===================================================================
  -- TEST EMPLOYEE 4: Managerial (Office-based)
  -- ===================================================================
  -- Same OT calculation as Supervisory Office-based
  -- Dec 2 (Tue) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-02 00:00:00+00', '2025-12-02 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.101', 8.0, 0.0, 0.0);

  -- Dec 3 (Wed) - Regular day, 8 hours + 2 hours OT (should get ₱200)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-03 00:00:00+00', '2025-12-03 11:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.102', 8.0, 2.0, 0.0);

  -- Dec 4 (Thu) - Regular day, 8 hours + 4 hours OT (should get ₱400 = ₱200 + ₱200)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-04 00:00:00+00', '2025-12-04 13:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.103', 8.0, 4.0, 0.0);

  -- Dec 5 (Fri) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-05 00:00:00+00', '2025-12-05 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.104', 8.0, 0.0, 0.0);

  -- Dec 6 (Sat) - Half day, 4 hours
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-06 00:00:00+00', '2025-12-06 04:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.105', 4.0, 0.0, 0.0);

  -- Dec 8 (Mon) - SPECIAL HOLIDAY - 8 hours worked + 8 hours OT (should get ₱600 allowance)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-08 00:00:00+00', '2025-12-08 17:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.106', 8.0, 8.0, 0.0);

  -- Dec 9 (Tue) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-09 00:00:00+00', '2025-12-09 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.107', 8.0, 0.0, 0.0);

  -- Dec 10 (Wed) - Regular day, 8 hours + 3 hours OT (should get ₱300)
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-10 00:00:00+00', '2025-12-10 12:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.108', 8.0, 3.0, 0.0);

  -- Dec 11 (Thu) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-11 00:00:00+00', '2025-12-11 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.109', 8.0, 0.0, 0.0);

  -- Dec 13 (Sat) - Half day, 4 hours
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-13 00:00:00+00', '2025-12-13 04:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.110', 4.0, 0.0, 0.0);

  -- Dec 15 (Mon) - Regular day, 8 hours, no OT
  INSERT INTO time_clock_entries (employee_id, clock_in_time, clock_out_time, status, clock_in_location, clock_in_device, clock_in_ip, clock_out_device, clock_out_ip, regular_hours, overtime_hours, total_night_diff_hours)
  VALUES (test_emp_4_id, '2025-12-15 00:00:00+00', '2025-12-15 09:00:00+00', 'auto_approved', NULL, 'Mozilla/5.0', '192.168.1.100', 'Mozilla/5.0', '192.168.1.111', 8.0, 0.0, 0.0);

  -- ===================================================================
  -- JERICKO RAZAL: Fix time entries (ensure Dec 8 has correct hours)
  -- ===================================================================
  -- Update Dec 8 entry to have correct regular_hours (9 hours from clock times)
  UPDATE time_clock_entries
  SET regular_hours = 9.0
  WHERE employee_id = jericko_id
  AND DATE(clock_in_time AT TIME ZONE 'Asia/Manila') = '2025-12-08';

END $$;

-- Step 4: Verify Test Data
-- =========================
SELECT 
  e.employee_id,
  e.full_name,
  e.position,
  e.employee_type,
  e.job_level,
  e.per_day,
  COUNT(tce.id) as time_entries_count,
  SUM(tce.regular_hours) as total_regular_hours,
  SUM(tce.overtime_hours) as total_overtime_hours
FROM employees e
LEFT JOIN time_clock_entries tce ON e.id = tce.employee_id
  AND tce.clock_in_time >= '2025-12-01' AND tce.clock_in_time < '2025-12-16'
WHERE e.employee_id IN ('TEST001', 'TEST002', 'TEST003', 'TEST004', '2025001')
GROUP BY e.employee_id, e.full_name, e.position, e.employee_type, e.job_level, e.per_day
ORDER BY e.employee_id;

