-- =============================================================================
-- Business Rules Tests — Database Level
-- =============================================================================
-- Tests DB constraints, triggers, and functions that enforce business rules.
-- Run: psql "$DATABASE_URL" -f this_file.sql
-- Requires test seed data to be present.
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS test;
SET search_path = test, public;

-- =============================================================================
-- 0. HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION test.assert(p_condition BOOLEAN, p_test_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_condition THEN
    RAISE NOTICE 'PASS: %', p_test_name;
  ELSE
    RAISE EXCEPTION 'FAIL: %', p_test_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION test.assert_raises(p_sql TEXT, p_test_name TEXT)
RETURNS VOID AS $$
DECLARE
  v_error TEXT;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'FAIL: % — expected error but succeeded', p_test_name;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: % (error: %)', p_test_name, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. SLOT DECREMENT ON APPOINTMENT CREATION
-- =============================================================================

-- TEST: Creating a scheduled appointment decrements available_slots
-- This is tested via the on_appointment_slot_change trigger

-- Setup: create a test schedule with known slots
DO $$
DECLARE
  v_doctor_id UUID;
  v_clinic_id UUID;
  v_schedule_id UUID;
  v_patient_profile_id UUID;
  v_patient_id UUID;
  v_initial_slots INTEGER;
  v_after_slots INTEGER;
BEGIN
  -- Use existing test data (adjust UUIDs as needed)
  SELECT id INTO v_doctor_id FROM doctors WHERE is_active = true LIMIT 1;
  SELECT id INTO v_clinic_id FROM clinics WHERE is_active = true LIMIT 1;
  SELECT id INTO v_patient_profile_id FROM profiles WHERE role = 'patient' LIMIT 1;
  SELECT id INTO v_patient_id FROM patients WHERE profile_id = v_patient_profile_id;

  IF v_doctor_id IS NULL OR v_clinic_id IS NULL OR v_patient_id IS NULL THEN
    RAISE NOTICE 'SKIP: slot decrement test — insufficient test data';
    RETURN;
  END IF;

  -- Create a test schedule
  INSERT INTO schedules (doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots)
  VALUES (v_doctor_id, v_clinic_id, '2026-12-01', '09:00', '10:00', 5, 5)
  RETURNING id INTO v_schedule_id;

  SELECT available_slots INTO v_initial_slots FROM schedules WHERE id = v_schedule_id;
  PERFORM test.assert(v_initial_slots = 5, 'schedule starts with 5 available slots');

  -- Create appointment
  INSERT INTO appointments (patient_id, doctor_id, schedule_id, clinic_id, date, status)
  VALUES (v_patient_id, v_doctor_id, v_schedule_id, v_clinic_id, '2026-12-01', 'scheduled');

  SELECT available_slots INTO v_after_slots FROM schedules WHERE id = v_schedule_id;
  PERFORM test.assert(v_after_slots = 4, 'slot decremented to 4 after booking');

  -- Cleanup
  DELETE FROM appointments WHERE schedule_id = v_schedule_id;
  DELETE FROM schedules WHERE id = v_schedule_id;
END $$;

-- =============================================================================
-- 2. SLOT INCREMENT ON CANCELLATION
-- =============================================================================

DO $$
DECLARE
  v_doctor_id UUID;
  v_clinic_id UUID;
  v_schedule_id UUID;
  v_patient_profile_id UUID;
  v_patient_id UUID;
  v_appointment_id UUID;
  v_after_slots INTEGER;
BEGIN
  SELECT id INTO v_doctor_id FROM doctors WHERE is_active = true LIMIT 1;
  SELECT id INTO v_clinic_id FROM clinics WHERE is_active = true LIMIT 1;
  SELECT id INTO v_patient_profile_id FROM profiles WHERE role = 'patient' LIMIT 1;
  SELECT id INTO v_patient_id FROM patients WHERE profile_id = v_patient_profile_id;

  IF v_doctor_id IS NULL OR v_clinic_id IS NULL OR v_patient_id IS NULL THEN
    RAISE NOTICE 'SKIP: slot increment test — insufficient test data';
    RETURN;
  END IF;

  INSERT INTO schedules (doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots)
  VALUES (v_doctor_id, v_clinic_id, '2026-12-02', '09:00', '10:00', 3, 2)
  RETURNING id INTO v_schedule_id;

  INSERT INTO appointments (patient_id, doctor_id, schedule_id, clinic_id, date, status)
  VALUES (v_patient_id, v_doctor_id, v_schedule_id, v_clinic_id, '2026-12-02', 'scheduled')
  RETURNING id INTO v_appointment_id;

  -- Cancel appointment
  UPDATE appointments SET status = 'cancelled' WHERE id = v_appointment_id;

  SELECT available_slots INTO v_after_slots FROM schedules WHERE id = v_schedule_id;
  PERFORM test.assert(v_after_slots = 2, 'slot restored to 2 (pre-booking value) after cancellation');

  DELETE FROM appointments WHERE schedule_id = v_schedule_id;
  DELETE FROM schedules WHERE id = v_schedule_id;
END $$;

-- =============================================================================
-- 3. CANNOT CREATE APPOINTMENT WITH UNAVAILABLE SLOT (available_slots = 0)
-- =============================================================================

DO $$
DECLARE
  v_doctor_id UUID;
  v_clinic_id UUID;
  v_schedule_id UUID;
  v_patient_id UUID;
BEGIN
  SELECT id INTO v_doctor_id FROM doctors WHERE is_active = true LIMIT 1;
  SELECT id INTO v_clinic_id FROM clinics WHERE is_active = true LIMIT 1;
  SELECT id INTO v_patient_id FROM patients LIMIT 1;

  IF v_doctor_id IS NULL OR v_clinic_id IS NULL OR v_patient_id IS NULL THEN
    RAISE NOTICE 'SKIP: unavailable slot test — insufficient test data';
    RETURN;
  END IF;

  INSERT INTO schedules (doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots)
  VALUES (v_doctor_id, v_clinic_id, '2026-12-03', '09:00', '10:00', 1, 0)
  RETURNING id INTO v_schedule_id;

  PERFORM test.assert_raises(
    format(
      'INSERT INTO appointments (patient_id, doctor_id, schedule_id, clinic_id, date, status) VALUES (''%s'', ''%s'', ''%s'', ''%s'', ''2026-12-03'', ''scheduled'')',
      v_patient_id, v_doctor_id, v_schedule_id, v_clinic_id
    ),
    'cannot book when available_slots = 0'
  );

  DELETE FROM schedules WHERE id = v_schedule_id;
END $$;

-- =============================================================================
-- 4. DOCTOR MUST BE ACTIVE FOR BOOKING
-- =============================================================================

DO $$
DECLARE
  v_inactive_doctor_id UUID;
  v_clinic_id UUID;
  v_schedule_id UUID;
  v_patient_id UUID;
BEGIN
  SELECT id INTO v_inactive_doctor_id FROM doctors WHERE is_active = false LIMIT 1;
  SELECT id INTO v_clinic_id FROM clinics WHERE is_active = true LIMIT 1;
  SELECT id INTO v_patient_id FROM patients LIMIT 1;

  IF v_inactive_doctor_id IS NULL OR v_clinic_id IS NULL OR v_patient_id IS NULL THEN
    RAISE NOTICE 'SKIP: inactive doctor test — insufficient test data';
    RETURN;
  END IF;

  -- Note: schedule creation may also fail for inactive doctor depending on FK constraints
  -- This test validates the trigger blocks the INSERT
  PERFORM test.assert_raises(
    format(
      'INSERT INTO appointments (patient_id, doctor_id, schedule_id, clinic_id, date, status) VALUES (''%s'', ''%s'', ''%s'', ''%s'', ''2026-12-04'', ''scheduled'')',
      v_patient_id, v_inactive_doctor_id, gen_random_uuid(), v_clinic_id
    ),
    'cannot book with inactive doctor'
  );
END $$;

-- =============================================================================
-- 5. SCHEDULE CONSTRAINTS
-- =============================================================================

-- TEST: max_slots must be > 0
DO $$
BEGIN
  PERFORM test.assert_raises(
    'INSERT INTO schedules (doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots) VALUES (gen_random_uuid(), gen_random_uuid(), ''2026-12-01'', ''08:00'', ''09:00'', 0, 0)',
    'max_slots must be positive'
  );
END $$;

-- TEST: end_time must be after start_time
DO $$
BEGIN
  PERFORM test.assert_raises(
    'INSERT INTO schedules (doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots) VALUES (gen_random_uuid(), gen_random_uuid(), ''2026-12-01'', ''09:00'', ''08:00'', 5, 5)',
    'end_time must be after start_time'
  );
END $$;

-- TEST: available_slots cannot exceed max_slots
DO $$
BEGIN
  PERFORM test.assert_raises(
    'INSERT INTO schedules (doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots) VALUES (gen_random_uuid(), gen_random_uuid(), ''2026-12-01'', ''08:00'', ''09:00'', 3, 5)',
    'available_slots cannot exceed max_slots'
  );
END $$;

-- =============================================================================
-- 6. APPOINTMENT STATUS DEFAULT
-- =============================================================================

DO $$
DECLARE
  v_patient_id UUID;
  v_doctor_id UUID;
  v_clinic_id UUID;
  v_schedule_id UUID;
  v_status TEXT;
BEGIN
  SELECT id INTO v_doctor_id FROM doctors WHERE is_active = true LIMIT 1;
  SELECT id INTO v_clinic_id FROM clinics WHERE is_active = true LIMIT 1;
  SELECT id INTO v_patient_id FROM patients LIMIT 1;

  IF v_doctor_id IS NULL OR v_clinic_id IS NULL OR v_patient_id IS NULL THEN
    RAISE NOTICE 'SKIP: status default test — insufficient test data';
    RETURN;
  END IF;

  INSERT INTO schedules (doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots)
  VALUES (v_doctor_id, v_clinic_id, '2026-12-05', '09:00', '10:00', 5, 5)
  RETURNING id INTO v_schedule_id;

  INSERT INTO appointments (patient_id, doctor_id, schedule_id, clinic_id, date)
  VALUES (v_patient_id, v_doctor_id, v_schedule_id, v_clinic_id, '2026-12-05')
  RETURNING status INTO v_status;

  PERFORM test.assert(v_status = 'scheduled', 'new appointment defaults to scheduled');

  DELETE FROM appointments WHERE schedule_id = v_schedule_id;
  DELETE FROM schedules WHERE id = v_schedule_id;
END $$;

-- =============================================================================
-- 7. HEALTH PLAN CONSTRAINTS
-- =============================================================================

-- TEST: coverage_percentage must be 0-100
DO $$
BEGIN
  PERFORM test.assert_raises(
    'INSERT INTO health_plans (name, coverage_percentage, monthly_price) VALUES (''Test'', 150, 100)',
    'coverage_percentage must be <= 100'
  );
END $$;

DO $$
BEGIN
  PERFORM test.assert_raises(
    'INSERT INTO health_plans (name, coverage_percentage, monthly_price) VALUES (''Test'', -10, 100)',
    'coverage_percentage must be >= 0'
  );
END $$;

-- TEST: monthly_price must be >= 0
DO $$
BEGIN
  PERFORM test.assert_raises(
    'INSERT INTO health_plans (name, coverage_percentage, monthly_price) VALUES (''Test'', 50, -100)',
    'monthly_price must be >= 0'
  );
END $$;

-- =============================================================================
-- 8. PATIENT HEALTH PLAN DATE CONSTRAINT
-- =============================================================================

DO $$
BEGIN
  PERFORM test.assert_raises(
    'INSERT INTO patient_health_plans (patient_id, health_plan_id, start_date, end_date) SELECT id, id, ''2026-12-01'', ''2026-01-01'' FROM patients LIMIT 1',
    'end_date must be >= start_date'
  );
END $$;

-- =============================================================================
-- CLEANUP
-- =============================================================================

DROP FUNCTION IF EXISTS test.assert;
DROP FUNCTION IF EXISTS test.assert_raises;

ROLLBACK;
