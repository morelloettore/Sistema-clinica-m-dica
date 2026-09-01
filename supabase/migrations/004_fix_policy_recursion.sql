-- =============================================================================
-- 004_fix_policy_recursion.sql
-- Fixes infinite-recursion in RLS policies caused by circular subqueries:
--   appointments_select_own       -> SELECT ... FROM patients ...
--   patients_select_doctor_own    -> SELECT ... FROM appointments ...
--   medical_records_select_*      -> SELECT ... FROM patients/appointments ...
-- The planner follows the cycle across policy subqueries and aborts with
-- "infinite recursion detected in policy for relation".
--
-- Fix: replace every cross-table lookup inside a policy with a call to a
-- SECURITY DEFINER helper function. SECURITY DEFINER bodies are opaque to the
-- planner (no inlining), so RLS on the referenced table is never re-entered
-- and the recursion cycle is broken.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. New SECURITY DEFINER helper functions (opaque to the planner)
-- ---------------------------------------------------------------------------

-- Patient ids of appointments owned by the *current* doctor (profile -> auth.uid()).
CREATE OR REPLACE FUNCTION public.user_doctor_patient_ids()
RETURNS SETOF UUID AS $$
    SELECT DISTINCT a.patient_id
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    WHERE d.profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Does a patient with this id exist? (used by employee appointment INSERT)
CREATE OR REPLACE FUNCTION public.patient_exists(p_patient_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM patients WHERE id = p_patient_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 1. Appointments policies (rewrite subqueries -> helper calls)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "appointments_select_own" ON appointments;
CREATE POLICY "appointments_select_own"
    ON appointments FOR SELECT
    USING (patient_id = public.user_patient_id());

DROP POLICY IF EXISTS "appointments_select_doctor" ON appointments;
CREATE POLICY "appointments_select_doctor"
    ON appointments FOR SELECT
    USING (doctor_id = public.user_doctor_id());

DROP POLICY IF EXISTS "appointments_insert_own" ON appointments;
CREATE POLICY "appointments_insert_own"
    ON appointments FOR INSERT
    WITH CHECK (
        public.user_role() = 'patient'
        AND patient_id = public.user_patient_id()
    );

DROP POLICY IF EXISTS "appointments_insert_employee" ON appointments;
CREATE POLICY "appointments_insert_employee"
    ON appointments FOR INSERT
    WITH CHECK (
        public.user_role() = 'employee'
        AND public.patient_exists(patient_id)
    );

DROP POLICY IF EXISTS "appointments_update_own" ON appointments;
CREATE POLICY "appointments_update_own"
    ON appointments FOR UPDATE
    USING (patient_id = public.user_patient_id())
    WITH CHECK (patient_id = public.user_patient_id());

DROP POLICY IF EXISTS "appointments_update_doctor" ON appointments;
CREATE POLICY "appointments_update_doctor"
    ON appointments FOR UPDATE
    USING (doctor_id = public.user_doctor_id())
    WITH CHECK (doctor_id = public.user_doctor_id());

-- ---------------------------------------------------------------------------
-- 2. Patients policies (doctor view -> helper call)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "patients_select_doctor_own" ON patients;
CREATE POLICY "patients_select_doctor_own"
    ON patients FOR SELECT
    USING (
        public.user_role() = 'doctor'
        AND id IN (SELECT public.user_doctor_patient_ids())
    );

-- ---------------------------------------------------------------------------
-- 3. Medical records policies (rewrite subqueries -> helper calls)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "medical_records_select_own" ON medical_records;
CREATE POLICY "medical_records_select_own"
    ON medical_records FOR SELECT
    USING (
        is_deleted = false
        AND patient_id = public.user_patient_id()
    );

DROP POLICY IF EXISTS "medical_records_select_doctor" ON medical_records;
CREATE POLICY "medical_records_select_doctor"
    ON medical_records FOR SELECT
    USING (
        is_deleted = false
        AND doctor_id = public.user_doctor_id()
        AND (
            patient_id IN (SELECT public.user_doctor_patient_ids())
            OR created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "medical_records_update_doctor" ON medical_records;
CREATE POLICY "medical_records_update_doctor"
    ON medical_records FOR UPDATE
    USING (doctor_id = public.user_doctor_id())
    WITH CHECK (doctor_id = public.user_doctor_id());