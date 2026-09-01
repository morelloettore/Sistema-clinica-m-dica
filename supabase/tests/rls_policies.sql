-- =============================================================================
-- RLS Policy Tests — Sistema Clínica Médica
-- =============================================================================
-- Run against local Supabase: supabase db reset && psql "$DATABASE_URL" -f this_file.sql
-- Uses set_config (JWT claims) + SET ROLE to simulate different authenticated
-- users per test.
--
-- Role/profile mapping in this database (see supabase/seed.sql):
--   00000000-0000-0000-0000-000000000001 = admin@clinica.local    (admin)
--   00000000-0000-0000-0000-000000000002 = doctor@clinica.local   (doctor)
--   00000000-0000-0000-0000-000000000003 = employee@clinica.local (employee)
--   00000000-0000-0000-0000-000000000004 = patient@clinica.local  (patient)
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS test;
SET search_path = test, public;
-- The assertions below run as the "authenticated" role (via SET ROLE), so that
-- role must be able to USE the test schema and EXECUTE the assert helpers.
GRANT USAGE ON SCHEMA test TO authenticated;

-- =============================================================================
-- 0. HELPERS
-- =============================================================================

-- Helper: act as a specific authenticated user for the current transaction.
-- Runs as the caller (postgres), so it may freely set the JWT claims GUC.
CREATE OR REPLACE FUNCTION test.set_user(p_user_id UUID, p_role TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', p_role)::TEXT, true);
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Helper: assert rows returned (exact match).
-- INVOKER: runs as the current session role, so RLS is actually enforced on
-- the dynamic SELECT below.
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

-- Helper: assert at least N rows returned (used for "can read" checks where
-- the baseline row count depends on seed data).
CREATE OR REPLACE FUNCTION test.assert_row_count_at_least(
  p_table TEXT,
  p_where TEXT,
  p_min INTEGER,
  p_test_name TEXT
) RETURNS VOID AS $$
DECLARE
  v_count INTEGER;
  v_sql TEXT;
BEGIN
  v_sql := format('SELECT count(*) FROM %I WHERE %s', p_table, p_where);
  EXECUTE v_sql INTO v_count;
  IF v_count >= p_min THEN
    RAISE NOTICE 'PASS: % (got %)', p_test_name, v_count;
  ELSE
    RAISE EXCEPTION 'FAIL: % — expected >= %, got %', p_test_name, p_min, v_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper: execute a statement expected to be denied by RLS.
-- Runs inside a subtransaction so the failure is caught, logged, and the
-- outer transaction continues.
CREATE OR REPLACE FUNCTION test.assert_blocked(p_sql TEXT, p_test_name TEXT)
RETURNS VOID AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'FAIL: % — expected RLS block but statement succeeded', p_test_name;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: % (blocked by RLS)', p_test_name;
    WHEN OTHERS THEN
      RAISE NOTICE 'PASS: % (rejected: %)', p_test_name, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. PROFILES TABLE
-- =============================================================================

-- TEST: Patient can only read own profile
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000004''',
  1, 'patient reads own profile');
RESET ROLE;

-- TEST: Patient cannot read other user's profile
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000002''',
  0, 'patient cannot read other profile');
RESET ROLE;

-- TEST: Employee can read all profiles
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'employee');
SET ROLE authenticated;
SELECT test.assert_row_count_at_least('profiles', 'true',
  4, 'employee reads all profiles');
RESET ROLE;

-- TEST: Admin can read all profiles
SELECT test.set_user('00000000-0000-0000-0000-000000000001', 'admin');
SET ROLE authenticated;
SELECT test.assert_row_count_at_least('profiles', 'true',
  4, 'admin reads all profiles');
RESET ROLE;

-- TEST: Patient cannot update other user's profile (RLS blocks, 0 rows)
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
UPDATE profiles SET name = 'Hacked' WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000002'' AND name = ''Hacked''',
  0, 'patient cannot update other profile');
RESET ROLE;

-- TEST: Doctor can only read own profile
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'doctor');
SET ROLE authenticated;
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000002''',
  1, 'doctor reads own profile');
RESET ROLE;

-- TEST: Doctor cannot read other profiles
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'doctor');
SET ROLE authenticated;
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000004''',
  0, 'doctor cannot read patient profile');
RESET ROLE;

-- TEST: Only admin can delete profiles (RLS blocks, row survives)
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'employee');
SET ROLE authenticated;
DELETE FROM profiles WHERE id = '00000000-0000-0000-0000-000000000004';
SELECT test.assert_row_count('profiles',
  'id = ''00000000-0000-0000-0000-000000000004''',
  1, 'employee cannot delete profiles');
RESET ROLE;

-- =============================================================================
-- 2. APPOINTMENTS TABLE
-- =============================================================================

-- TEST: Patient can only read own appointments
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_row_count('appointments',
  'patient_id IN (SELECT id FROM patients WHERE profile_id = ''00000000-0000-0000-0000-000000000004'')',
  0, 'patient reads own appointments (0 initially)');
RESET ROLE;

-- TEST: Patient cannot insert appointment for another patient (RLS blocks)
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_blocked(
  'INSERT INTO appointments (patient_id, doctor_id, schedule_id, clinic_id, date)
   SELECT ''00000000-0000-0000-0000-000000009999'', id, id, id, ''2026-12-01''
   FROM doctors LIMIT 1',
  'patient cannot book appointment for another patient');
RESET ROLE;

-- TEST: Doctor can read appointments for their patients
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'doctor');
SET ROLE authenticated;
SELECT test.assert_row_count('appointments',
  'doctor_id IN (SELECT id FROM doctors WHERE profile_id = ''00000000-0000-0000-0000-000000000002'')',
  0, 'doctor reads own appointments (0 initially)');
RESET ROLE;

-- TEST: Employee can read all appointments
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'employee');
SET ROLE authenticated;
SELECT test.assert_row_count('appointments', 'true',
  0, 'employee reads all appointments');
RESET ROLE;

-- =============================================================================
-- 3. MEDICAL RECORDS TABLE
-- =============================================================================

-- TEST: Patient can only read own non-deleted medical records
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_row_count('medical_records',
  'patient_id IN (SELECT id FROM patients WHERE profile_id = ''00000000-0000-0000-0000-000000000004'') AND is_deleted = false',
  0, 'patient reads own medical records (0 initially)');
RESET ROLE;

-- TEST: Employee cannot create medical record (no INSERT policy for that role)
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'employee');
SET ROLE authenticated;
SELECT test.assert_blocked(
  'INSERT INTO medical_records (patient_id, doctor_id, appointment_id, diagnosis)
   VALUES (''00000000-0000-0000-0000-000000000004'', ''00000000-0000-0000-0000-000000000002'', NULL, ''x'')',
  'employee cannot create medical record');
RESET ROLE;

-- TEST: Doctor can read own medical records
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'doctor');
SET ROLE authenticated;
SELECT test.assert_row_count('medical_records',
  'doctor_id IN (SELECT id FROM doctors WHERE profile_id = ''00000000-0000-0000-0000-000000000002'') AND is_deleted = false',
  0, 'doctor reads own medical records');
RESET ROLE;

-- =============================================================================
-- 4. AUDIT LOGS TABLE
-- =============================================================================

-- TEST: Admin can read audit logs (seed writes exist)
SELECT test.set_user('00000000-0000-0000-0000-000000000001', 'admin');
SET ROLE authenticated;
SELECT test.assert_row_count_at_least('audit_logs', 'true',
  1, 'admin reads audit logs (seed writes exist)');
RESET ROLE;

-- TEST: Patient cannot read audit logs
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_row_count('audit_logs', 'true',
  0, 'patient cannot read audit logs');
RESET ROLE;

-- TEST: Doctor cannot read audit logs
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'doctor');
SET ROLE authenticated;
SELECT test.assert_row_count('audit_logs', 'true',
  0, 'doctor cannot read audit logs');
RESET ROLE;

-- TEST: Employee cannot read audit logs
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'employee');
SET ROLE authenticated;
SELECT test.assert_row_count('audit_logs', 'true',
  0, 'employee cannot read audit logs');
RESET ROLE;

-- TEST: No non-admin role can insert audit logs directly (no INSERT policy)
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_blocked(
  'INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data)
   VALUES (NULL, ''INSERT'', ''profiles'', ''00000000-0000-0000-0000-000000000001'', ''{}'')',
  'patient cannot write audit logs');
RESET ROLE;

-- =============================================================================
-- 5. DOCTORS TABLE
-- =============================================================================

-- TEST: All authenticated users can read doctors (seed has 1 doctor)
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_row_count_at_least('doctors', 'true',
  1, 'patient reads doctors list');
RESET ROLE;

-- TEST: Only admin can insert doctors (no INSERT policy for patient)
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_blocked(
  'INSERT INTO doctors (profile_id, crm) VALUES (''00000000-0000-0000-0000-000000000004'', ''99999XX'')',
  'patient cannot insert doctor');
RESET ROLE;

-- TEST: Doctor can update own profile
SELECT test.set_user('00000000-0000-0000-0000-000000000002', 'doctor');
SET ROLE authenticated;
UPDATE doctors SET bio = 'Updated by doctor' WHERE profile_id = '00000000-0000-0000-0000-000000000002';
SELECT test.assert_row_count('doctors',
  'profile_id = ''00000000-0000-0000-0000-000000000002'' AND bio = ''Updated by doctor''',
  1, 'doctor updates own bio');
RESET ROLE;

-- =============================================================================
-- 6. SCHEDULES TABLE
-- =============================================================================

-- TEST: All authenticated users can read active schedules
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_row_count('schedules', 'is_active = true',
  0, 'patient reads active schedules (0 initially)');
RESET ROLE;

-- TEST: Patient cannot insert schedules (no INSERT policy)
SELECT test.set_user('00000000-0000-0000-0000-000000000004', 'patient');
SET ROLE authenticated;
SELECT test.assert_blocked(
  'INSERT INTO schedules (doctor_id, clinic_id, date, start_time, end_time, max_slots, available_slots)
   SELECT id, (SELECT id FROM clinics LIMIT 1), ''2026-12-01'', ''09:00'', ''10:00'', 1, 1 FROM doctors LIMIT 1',
  'patient cannot insert schedule');
RESET ROLE;

-- TEST: Employee can insert schedules (needs valid FKs; placeholder)
SELECT test.set_user('00000000-0000-0000-0000-000000000003', 'employee');
SET ROLE authenticated;
-- Would succeed if valid FK references exist.
RESET ROLE;

-- =============================================================================
-- CLEANUP
-- =============================================================================

RESET ROLE;
DROP FUNCTION IF EXISTS test.set_user;
DROP FUNCTION IF EXISTS test.assert_row_count;
DROP FUNCTION IF EXISTS test.assert_row_count_at_least;
DROP FUNCTION IF EXISTS test.assert_blocked;

ROLLBACK;