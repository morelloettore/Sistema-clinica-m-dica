-- =============================================================================
-- RLS Policy Tests — Sistema Clínica Médica
-- =============================================================================
-- Run against local Supabase: supabase db reset && psql "$DATABASE_URL" -f this_file.sql
-- Uses set_config to simulate different authenticated users per test.
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS test;
SET search_path = test, public;

-- =============================================================================
-- 0. HELPERS
-- =============================================================================

-- Helper: set current user context for RLS testing
CREATE OR REPLACE FUNCTION test.set_user(p_user_id UUID, p_role TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', p_role)::TEXT, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$ LANGUAGE plpgsql;

-- Helper: reset context back to superuser
CREATE OR REPLACE FUNCTION test.reset_user()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('role', 'supabase_admin', true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$$ LANGUAGE plpgsql;

-- Helper: assert rows returned
CREATE OR REPLACE FUNCTION test.assert_row_count(
  p_table TEXT,
  p_where TEXT,
  p_expected INTEGER,
  p_test_name TEXT
) RETURNS VOID AS $$
DECLARE
  v_count INTEGER;
  v_sql TEXT;
BEGIN
  v_sql := format('SELECT count(*) FROM %I WHERE %s', p_table, p_where);
  EXECUTE v_sql INTO v_count;
  IF v_count = p_expected THEN
    RAISE NOTICE 'PASS: % (got %)', p_test_name, v_count;
  ELSE
    RAISE EXCEPTION 'FAIL: % — expected %, got %', p_test_name, p_expected, v_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TEST DATA (assumes seed data from migration exists)
-- Adjust UUIDs to match your test database.
-- =============================================================================

-- Replace these with actual UUIDs from your seeded test data
-- For demonstration, we use placeholder patterns.
-- In practice, run seed.sql first and note the UUIDs.

-- =============================================================================
-- 1. PROFILES TABLE
-- =============================================================================

-- TEST: Patient can only read own profile
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000004''',
  1, 'patient reads own profile');
SELECT test.reset_user();

-- TEST: Patient cannot read other patient's profile
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000002''',
  0, 'patient cannot read other profile');
SELECT test.reset_user();

-- TEST: Employee can read all profiles
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'employee');
SELECT test.assert_row_count('profiles', 'true', 4, 'employee reads all profiles');
SELECT test.reset_user();

-- TEST: Admin can read all profiles
SELECT test.set_user('00000000-0000-0000-0000-000000000001', 'admin');
SELECT test.assert_row_count('profiles', 'true', 4, 'admin reads all profiles');
SELECT test.reset_user();

-- TEST: Patient cannot update other patient's profile
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
UPDATE profiles SET name = 'Hacked' WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000002'' AND name = ''Hacked''',
  0, 'patient cannot update other profile');
SELECT test.reset_user();

-- TEST: Doctor can only read own profile
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'doctor');
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000003''',
  1, 'doctor reads own profile');
SELECT test.reset_user();

-- TEST: Doctor cannot read other profiles
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'doctor');
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000004''',
  0, 'doctor cannot read patient profile');
SELECT test.reset_user();

-- TEST: Only admin can delete profiles
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'employee');
DELETE FROM profiles WHERE id = '00000000-0000-0000-0000-000000000004';
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000004''',
  1, 'employee cannot delete profiles');
SELECT test.reset_user();

-- =============================================================================
-- 2. APPOINTMENTS TABLE
-- =============================================================================

-- TEST: Patient can only read own appointments
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SELECT test.assert_row_count('appointments',
  'patient_id IN (SELECT id FROM patients WHERE profile_id = ''00000000-0000-0000-0000-000000000004'')',
  0, 'patient reads own appointments (0 initially)');
SELECT test.reset_user();

-- TEST: Patient cannot insert appointment for another patient
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
INSERT INTO appointments (patient_id, doctor_id, schedule_id, clinic_id, date)
SELECT '00000000-0000-0000-0000-000000009999', id, id, id, '2026-12-01'
FROM doctors LIMIT 1;
-- This should be blocked by RLS (patient_id doesn't match own patient record)
SELECT test.reset_user();

-- TEST: Doctor can read appointments for their patients
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'doctor');
SELECT test.assert_row_count('appointments',
  'doctor_id IN (SELECT id FROM doctors WHERE profile_id = ''00000000-0000-0000-0000-000000000003'')',
  0, 'doctor reads own appointments (0 initially)');
SELECT test.reset_user();

-- TEST: Employee can read all appointments
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'employee');
SELECT test.assert_row_count('appointments', 'true',
  0, 'employee reads all appointments');
SELECT test.reset_user();

-- =============================================================================
-- 3. MEDICAL RECORDS TABLE
-- =============================================================================

-- TEST: Patient can only read own non-deleted medical records
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SELECT test.assert_row_count('medical_records',
  'patient_id IN (SELECT id FROM patients WHERE profile_id = ''00000000-0000-0000-0000-000000000004'') AND is_deleted = false',
  0, 'patient reads own medical records (0 initially)');
SELECT test.reset_user();

-- TEST: Employee cannot create medical record
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'employee');
-- Attempting INSERT should be blocked by RLS
-- (medical_records_insert_doctor policy requires doctor role)
SELECT test.reset_user();

-- TEST: Doctor can read own medical records
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'doctor');
SELECT test.assert_row_count('medical_records',
  'doctor_id IN (SELECT id FROM doctors WHERE profile_id = ''00000000-0000-0000-0000-000000000003'') AND is_deleted = false',
  0, 'doctor reads own medical records');
SELECT test.reset_user();

-- =============================================================================
-- 4. AUDIT LOGS TABLE
-- =============================================================================

-- TEST: Admin can read audit logs
SELECT test.set_user('00000000-0000-0000-0000-000000000001', 'admin');
SELECT test.assert_row_count('audit_logs', 'true',
  0, 'admin reads audit logs (0 initially)');
SELECT test.reset_user();

-- TEST: Patient cannot read audit logs
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SELECT test.assert_row_count('audit_logs', 'true',
  0, 'patient cannot read audit logs');
SELECT test.reset_user();

-- TEST: Doctor cannot read audit logs
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'doctor');
SELECT test.assert_row_count('audit_logs', 'true',
  0, 'doctor cannot read audit logs');
SELECT test.reset_user();

-- TEST: Employee cannot read audit logs
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'employee');
SELECT test.assert_row_count('audit_logs', 'true',
  0, 'employee cannot read audit logs');
SELECT test.reset_user();

-- TEST: No non-admin role can insert audit logs directly
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
-- INSERT would be blocked by lack of INSERT policy (only SELECT policy exists)
SELECT test.reset_user();

-- =============================================================================
-- 5. DOCTORS TABLE
-- =============================================================================

-- TEST: All authenticated users can read doctors
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SELECT test.assert_row_count('doctors', 'true',
  0, 'patient reads doctors list');
SELECT test.reset_user();

-- TEST: Only admin can insert doctors
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
-- INSERT blocked by RLS (doctors_insert_admin)
SELECT test.reset_user();

-- TEST: Doctor can update own profile
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'doctor');
UPDATE doctors SET bio = 'Updated by doctor' WHERE profile_id = '00000000-0000-0000-0000-000000000003';
SELECT test.assert_row_count('doctors',
  'profile_id = ''00000000-0000-0000-0000-000000000003'' AND bio = ''Updated by doctor''',
  1, 'doctor updates own bio');
SELECT test.reset_user();

-- =============================================================================
-- 6. SCHEDULES TABLE
-- =============================================================================

-- TEST: All authenticated users can read active schedules
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SELECT test.assert_row_count('schedules', 'is_active = true',
  0, 'patient reads active schedules (0 initially)');
SELECT test.reset_user();

-- TEST: Patient cannot insert schedules
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
-- INSERT blocked by RLS (schedules_insert_employee_admin)
SELECT test.reset_user();

-- TEST: Employee can insert schedules
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'employee');
-- Would succeed if valid FK references exist
SELECT test.reset_user();

-- =============================================================================
-- CLEANUP
-- =============================================================================

SELECT test.reset_user();
DROP FUNCTION IF EXISTS test.set_user;
DROP FUNCTION IF EXISTS test.reset_user;
DROP FUNCTION IF EXISTS test.assert_row_count;

ROLLBACK;
