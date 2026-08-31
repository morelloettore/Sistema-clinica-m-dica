-- =============================================================================
-- Migration 001: Initial Schema — Sistema Clínica Médica
-- =============================================================================
-- Creates the complete database schema for the medical clinic management system.
-- Includes: enums, tables, indexes, triggers, RLS policies, and seed data.
--
-- Author: Agent 03 — Database Architect
-- Date: 2026-08-31
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =============================================================================
-- 2. ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM ('patient', 'employee', 'doctor', 'admin');
CREATE TYPE gender AS ENUM ('male', 'female', 'other');
CREATE TYPE blood_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- =============================================================================
-- 3. TABLES
-- =============================================================================

-- 3.1 profiles (extends auth.users)
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    cpf         TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    role        user_role NOT NULL DEFAULT 'patient',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD CONSTRAINT profiles_cpf_unique UNIQUE (cpf);

COMMENT ON TABLE profiles IS 'Base user profile, 1:1 with auth.users';
COMMENT ON COLUMN profiles.cpf IS 'Brazilian CPF tax ID, format: XXX.XXX.XXX-XX';

-- 3.2 specialties
CREATE TABLE specialties (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE specialties ADD CONSTRAINT specialties_name_unique UNIQUE (name);

-- 3.3 health_plans
CREATE TABLE health_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    description         TEXT,
    coverage_percentage NUMERIC(5,2) NOT NULL CHECK (coverage_percentage >= 0 AND coverage_percentage <= 100),
    monthly_price       NUMERIC(10,2) NOT NULL CHECK (monthly_price >= 0),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 clinics
CREATE TABLE clinics (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    address     TEXT NOT NULL,
    phone       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 doctors
CREATE TABLE doctors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    crm                 TEXT NOT NULL,
    bio                 TEXT,
    consultation_price  NUMERIC(10,2) CHECK (consultation_price >= 0),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE doctors ADD CONSTRAINT doctors_crm_unique UNIQUE (crm);

-- 3.6 doctor_specialties
CREATE TABLE doctor_specialties (
    doctor_id     UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    specialty_id  UUID NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (doctor_id, specialty_id)
);

-- 3.7 doctor_clinics
CREATE TABLE doctor_clinics (
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (doctor_id, clinic_id)
);

-- 3.8 patients
CREATE TABLE patients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    date_of_birth   DATE NOT NULL,
    gender          gender NOT NULL,
    address         TEXT,
    city            TEXT,
    state           TEXT CHECK (length(state) = 2),
    zip_code        TEXT CHECK (zip_code ~ '^\d{8}$'),
    blood_type      blood_type,
    allergies       TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9 patient_health_plans
CREATE TABLE patient_health_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    health_plan_id  UUID NOT NULL REFERENCES health_plans(id) ON DELETE CASCADE,
    start_date      DATE NOT NULL,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT patient_health_plans_date_check CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX idx_patient_health_plan_active
    ON patient_health_plans (patient_id, health_plan_id)
    WHERE end_date IS NULL;

-- 3.10 schedules
CREATE TABLE schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    max_slots       INTEGER NOT NULL CHECK (max_slots > 0),
    available_slots INTEGER NOT NULL CHECK (available_slots >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT schedules_time_check CHECK (end_time > start_time),
    CONSTRAINT schedules_available_check CHECK (available_slots <= max_slots)
);

ALTER TABLE schedules
    ADD CONSTRAINT schedules_no_overlap
    EXCLUDE USING gist (
        doctor_id WITH =,
        clinic_id WITH =,
        date WITH =,
        tsrange(
            (date || ' ' || start_time)::timestamp,
            (date || ' ' || end_time)::timestamp
        ) WITH &&
    ) WHERE (is_active = true);

-- 3.11 appointments
CREATE TABLE appointments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    doctor_id           UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    schedule_id         UUID NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
    clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    date                DATE NOT NULL,
    status              appointment_status NOT NULL DEFAULT 'scheduled',
    notes               TEXT,
    cancellation_reason TEXT,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.12 medical_records
CREATE TABLE medical_records (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    doctor_id             UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    appointment_id        UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
    chief_complaint       TEXT,
    history               TEXT,
    examination           TEXT,
    diagnosis             TEXT NOT NULL,
    treatment_plan        TEXT,
    prescription          TEXT,
    notes                 TEXT,
    next_appointment_date DATE,
    is_deleted            BOOLEAN NOT NULL DEFAULT false,
    created_by            UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.13 audit_logs
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action      audit_action NOT NULL,
    table_name  TEXT NOT NULL,
    record_id   UUID NOT NULL,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- 4.1 profiles
CREATE INDEX idx_profiles_cpf ON profiles (cpf);
CREATE INDEX idx_profiles_role ON profiles (role);
CREATE INDEX idx_profiles_email ON profiles (email);

-- 4.2 patients
CREATE INDEX idx_patients_profile_id ON patients (profile_id);
CREATE INDEX idx_patients_date_of_birth ON patients (date_of_birth);

-- 4.3 doctors
CREATE INDEX idx_doctors_profile_id ON doctors (profile_id);
CREATE INDEX idx_doctors_crm ON doctors (crm);
CREATE INDEX idx_doctors_is_active ON doctors (is_active) WHERE is_active = true;

-- 4.4 doctor_specialties
CREATE INDEX idx_doctor_specialties_specialty ON doctor_specialties (specialty_id);

-- 4.5 doctor_clinics
CREATE INDEX idx_doctor_clinics_clinic ON doctor_clinics (clinic_id);

-- 4.6 schedules
CREATE INDEX idx_schedules_doctor_date ON schedules (doctor_id, date);
CREATE INDEX idx_schedules_clinic_date ON schedules (clinic_id, date);
CREATE INDEX idx_schedules_date ON schedules (date);
CREATE INDEX idx_schedules_available ON schedules (doctor_id, date) WHERE available_slots > 0 AND is_active = true;

-- 4.7 appointments
CREATE INDEX idx_appointments_patient_id ON appointments (patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments (doctor_id);
CREATE INDEX idx_appointments_schedule_id ON appointments (schedule_id);
CREATE INDEX idx_appointments_status ON appointments (status);
CREATE INDEX idx_appointments_date ON appointments (date);
CREATE INDEX idx_appointments_doctor_date ON appointments (doctor_id, date);
CREATE INDEX idx_appointments_patient_date ON appointments (patient_id, date);
CREATE INDEX idx_appointments_status_date ON appointments (status, date);

-- 4.8 medical_records
CREATE INDEX idx_medical_records_patient_id ON medical_records (patient_id);
CREATE INDEX idx_medical_records_doctor_id ON medical_records (doctor_id);
CREATE INDEX idx_medical_records_appointment_id ON medical_records (appointment_id);
CREATE INDEX idx_medical_records_not_deleted ON medical_records (patient_id) WHERE is_deleted = false;

-- 4.9 audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs (table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs (record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_table_action ON audit_logs (table_name, action);

-- 4.10 patient_health_plans
CREATE INDEX idx_patient_health_plans_patient ON patient_health_plans (patient_id);
CREATE INDEX idx_patient_health_plans_health_plan ON patient_health_plans (health_plan_id);

-- =============================================================================
-- 5. FUNCTIONS AND TRIGGERS
-- =============================================================================

-- 5.1 Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_patients
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_doctors
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_appointments
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_medical_records
    BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5.2 Auto-create profile on auth user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, cpf, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'cpf', ''),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'patient')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5.3 Auto-create patient profile for patient role
CREATE OR REPLACE FUNCTION handle_new_patient_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'patient' THEN
        INSERT INTO public.patients (profile_id, date_of_birth, gender)
        VALUES (NEW.id, '2000-01-01', 'other')
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_patient
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION handle_new_patient_profile();

-- 5.3b Prevent self-role-escalation / self-deactivation on profiles
CREATE OR REPLACE FUNCTION prevent_profile_privilege_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only admins can change role or is_active
    IF auth.user_role() <> 'admin' THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Only administrators can change user roles';
        END IF;
        IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Only administrators can activate or deactivate users';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profiles_update_privilege_guard
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_change();

-- 5.4 Audit trail trigger
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id UUID;
    v_action audit_action;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_record_id := OLD.id;
        v_action := 'DELETE';
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
        VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_record_id, v_old_data);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
        v_action := 'UPDATE';
    ELSIF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
        v_action := 'INSERT';
    END IF;

    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_record_id, v_old_data, v_new_data);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_appointments
    AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_medical_records
    AFTER INSERT OR UPDATE OR DELETE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_doctors
    AFTER INSERT OR UPDATE OR DELETE ON doctors
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_health_plans
    AFTER INSERT OR UPDATE OR DELETE ON health_plans
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_patients
    AFTER UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_schedules
    AFTER UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 5.5 Doctor profile validation (prevents phantom doctor records -> privilege escalation)
CREATE OR REPLACE FUNCTION validate_doctor_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = NEW.profile_id AND role = 'doctor' AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Profile must have an active doctor role';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_doctor_profile_trigger
    BEFORE INSERT OR UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION validate_doctor_profile();

-- 5.5b Prevent doctors from modifying own identity fields (crm, profile_id)
CREATE OR REPLACE FUNCTION prevent_doctor_identity_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT auth.user_role() IN ('employee', 'admin') THEN
        IF NEW.crm IS DISTINCT FROM OLD.crm THEN
            RAISE EXCEPTION 'Only employees or administrators can change the CRM';
        END IF;
        IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
            RAISE EXCEPTION 'Only employees or administrators can change the linked profile';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_doctors_update_identity_guard
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION prevent_doctor_identity_change();

-- 5.5 Schedule booking validation trigger
CREATE OR REPLACE FUNCTION validate_schedule_booking()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'scheduled' THEN
        IF (SELECT available_slots FROM schedules WHERE id = NEW.schedule_id) <= 0 THEN
            RAISE EXCEPTION 'No available slots for this schedule';
        END IF;

        IF NOT (SELECT is_active FROM doctors WHERE id = NEW.doctor_id) THEN
            RAISE EXCEPTION 'Doctor is not active';
        END IF;

        IF NOT (
            SELECT p.is_active
            FROM profiles p
            JOIN patients pt ON pt.profile_id = p.id
            WHERE pt.id = NEW.patient_id
        ) THEN
            RAISE EXCEPTION 'Patient account is deactivated';
        END IF;

        IF NEW.date < CURRENT_DATE THEN
            RAISE EXCEPTION 'Cannot book appointment in the past';
        END IF;

        IF EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.patient_id = NEW.patient_id
              AND a.date = NEW.date
              AND a.status IN ('scheduled', 'confirmed')
        ) THEN
            RAISE EXCEPTION 'Patient already has an appointment on this date';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_appointment_booking
    BEFORE INSERT ON appointments
    FOR EACH ROW EXECUTE FUNCTION validate_schedule_booking();

-- 5.6 Slot decrement/increment on appointment status change
CREATE OR REPLACE FUNCTION handle_appointment_slot_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'scheduled' THEN
        UPDATE schedules
        SET available_slots = available_slots - 1
        WHERE id = NEW.schedule_id AND available_slots > 0;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Schedule slot not available';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'scheduled' AND NEW.status = 'cancelled' THEN
        UPDATE schedules
        SET available_slots = available_slots + 1
        WHERE id = NEW.schedule_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_appointment_slot_change
    AFTER INSERT OR UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION handle_appointment_slot_change();

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- 6.0 Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_health_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 6.1 Helper functions for RLS
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_patient_id()
RETURNS UUID AS $$
    SELECT id FROM patients WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_doctor_id()
RETURNS UUID AS $$
    SELECT id FROM doctors WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6.2 Profiles policies
CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "profiles_select_employee_admin"
    ON profiles FOR SELECT
    USING (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_employee"
    ON profiles FOR UPDATE
    USING (auth.user_role() = 'employee')
    WITH CHECK (auth.user_role() = 'employee');

CREATE POLICY "profiles_update_admin"
    ON profiles FOR UPDATE
    USING (auth.user_role() = 'admin')
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "profiles_delete_admin"
    ON profiles FOR DELETE
    USING (
        auth.user_role() = 'admin'
        AND id != auth.uid()
    );

-- 6.3 Patients policies
CREATE POLICY "patients_select_own"
    ON patients FOR SELECT
    USING (profile_id = auth.uid());

CREATE POLICY "patients_select_employee_admin"
    ON patients FOR SELECT
    USING (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "patients_select_doctor_own"
    ON patients FOR SELECT
    USING (
        auth.user_role() = 'doctor'
        AND id IN (
            SELECT patient_id FROM appointments
            WHERE doctor_id = auth.user_doctor_id()
        )
    );

CREATE POLICY "patients_update_own"
    ON patients FOR UPDATE
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

CREATE POLICY "patients_update_employee_admin"
    ON patients FOR UPDATE
    USING (auth.user_role() IN ('employee', 'admin'))
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "patients_insert_employee_admin"
    ON patients FOR INSERT
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "patients_delete_admin"
    ON patients FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.4 Doctors policies
CREATE POLICY "doctors_select_all"
    ON doctors FOR SELECT
    USING (true);

CREATE POLICY "doctors_insert_admin"
    ON doctors FOR INSERT
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "doctors_update_own"
    ON doctors FOR UPDATE
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

CREATE POLICY "doctors_update_admin"
    ON doctors FOR UPDATE
    USING (auth.user_role() = 'admin')
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "doctors_update_employee"
    ON doctors FOR UPDATE
    USING (auth.user_role() = 'employee')
    WITH CHECK (auth.user_role() = 'employee');

CREATE POLICY "doctors_delete_admin"
    ON doctors FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.5 Specialties policies
CREATE POLICY "specialties_select_all"
    ON specialties FOR SELECT
    USING (true);

CREATE POLICY "specialties_insert_admin"
    ON specialties FOR INSERT
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "specialties_update_admin"
    ON specialties FOR UPDATE
    USING (auth.user_role() = 'admin')
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "specialties_delete_admin"
    ON specialties FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.6 Clinics policies
CREATE POLICY "clinics_select_all"
    ON clinics FOR SELECT
    USING (true);

CREATE POLICY "clinics_insert_admin"
    ON clinics FOR INSERT
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "clinics_update_admin"
    ON clinics FOR UPDATE
    USING (auth.user_role() = 'admin')
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "clinics_delete_admin"
    ON clinics FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.7 Health plans policies
CREATE POLICY "health_plans_select_all"
    ON health_plans FOR SELECT
    USING (true);

CREATE POLICY "health_plans_insert_employee_admin"
    ON health_plans FOR INSERT
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "health_plans_update_employee_admin"
    ON health_plans FOR UPDATE
    USING (auth.user_role() IN ('employee', 'admin'))
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "health_plans_delete_admin"
    ON health_plans FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.8 Patient health plans policies
CREATE POLICY "patient_health_plans_select_own"
    ON patient_health_plans FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "patient_health_plans_select_employee_admin"
    ON patient_health_plans FOR SELECT
    USING (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "patient_health_plans_insert_employee_admin"
    ON patient_health_plans FOR INSERT
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "patient_health_plans_update_employee_admin"
    ON patient_health_plans FOR UPDATE
    USING (auth.user_role() IN ('employee', 'admin'))
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "patient_health_plans_delete_employee_admin"
    ON patient_health_plans FOR DELETE
    USING (auth.user_role() IN ('employee', 'admin'));

-- 6.9 Doctor specialties policies
CREATE POLICY "doctor_specialties_select_all"
    ON doctor_specialties FOR SELECT
    USING (true);

CREATE POLICY "doctor_specialties_insert_admin"
    ON doctor_specialties FOR INSERT
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "doctor_specialties_delete_admin"
    ON doctor_specialties FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.10 Doctor clinics policies
CREATE POLICY "doctor_clinics_select_all"
    ON doctor_clinics FOR SELECT
    USING (true);

CREATE POLICY "doctor_clinics_insert_admin"
    ON doctor_clinics FOR INSERT
    WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "doctor_clinics_delete_admin"
    ON doctor_clinics FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.11 Schedules policies
CREATE POLICY "schedules_select_all"
    ON schedules FOR SELECT
    USING (is_active = true);

CREATE POLICY "schedules_insert_employee_admin"
    ON schedules FOR INSERT
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "schedules_update_employee_admin"
    ON schedules FOR UPDATE
    USING (auth.user_role() IN ('employee', 'admin'))
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "schedules_delete_employee_admin"
    ON schedules FOR DELETE
    USING (auth.user_role() IN ('employee', 'admin'));

-- 6.12 Appointments policies
CREATE POLICY "appointments_select_own"
    ON appointments FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "appointments_select_doctor"
    ON appointments FOR SELECT
    USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "appointments_select_employee_admin"
    ON appointments FOR SELECT
    USING (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "appointments_insert_own"
    ON appointments FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE profile_id = auth.uid()
        )
        AND auth.user_role() = 'patient'
    );

CREATE POLICY "appointments_insert_employee"
    ON appointments FOR INSERT
    WITH CHECK (
        auth.user_role() = 'employee'
        AND patient_id IN (SELECT id FROM patients)
    );

CREATE POLICY "appointments_update_own"
    ON appointments FOR UPDATE
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "appointments_update_doctor"
    ON appointments FOR UPDATE
    USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        doctor_id IN (
            SELECT id FROM doctors WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "appointments_update_employee_admin"
    ON appointments FOR UPDATE
    USING (auth.user_role() IN ('employee', 'admin'))
    WITH CHECK (auth.user_role() IN ('employee', 'admin'));

CREATE POLICY "appointments_delete_admin"
    ON appointments FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.13 Medical records policies
CREATE POLICY "medical_records_select_own"
    ON medical_records FOR SELECT
    USING (
        is_deleted = false
        AND patient_id IN (
            SELECT id FROM patients WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "medical_records_select_doctor"
    ON medical_records FOR SELECT
    USING (
        is_deleted = false
        AND doctor_id IN (
            SELECT id FROM doctors WHERE profile_id = auth.uid()
        )
        AND (
            patient_id IN (
                SELECT patient_id FROM appointments
                WHERE doctor_id = (SELECT id FROM doctors WHERE profile_id = auth.uid())
            )
            OR created_by = auth.uid()
        )
    );

CREATE POLICY "medical_records_select_employee_admin"
    ON medical_records FOR SELECT
    USING (
        is_deleted = false
        AND auth.user_role() IN ('employee', 'admin')
    );

CREATE POLICY "medical_records_insert_doctor"
    ON medical_records FOR INSERT
    WITH CHECK (
        auth.user_role() = 'doctor'
        AND doctor_id = auth.user_doctor_id()
    );

CREATE POLICY "medical_records_update_doctor"
    ON medical_records FOR UPDATE
    USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        doctor_id IN (
            SELECT id FROM doctors WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "medical_records_delete_admin"
    ON medical_records FOR DELETE
    USING (auth.user_role() = 'admin');

-- 6.14 Audit logs policies
CREATE POLICY "audit_logs_select_admin"
    ON audit_logs FOR SELECT
    USING (auth.user_role() = 'admin');

-- =============================================================================
-- 7. SEED DATA (Commented out — run via supabase db seed)
-- =============================================================================

-- Uncomment the following to seed initial data:

/*
INSERT INTO specialties (name, description) VALUES
    ('Cardiologia', 'Estudo e tratamento do coração'),
    ('Dermatologia', 'Estudo e tratamento da pele'),
    ('Ortopedia', 'Estudo e tratamento do sistema musculoesquelético'),
    ('Pediatria', 'Estudo e tratamento de crianças'),
    ('Ginecologia', 'Estudo e tratamento do sistema reprodutor feminino'),
    ('Neurologia', 'Estudo e tratamento do sistema nervoso'),
    ('Oftalmologia', 'Estudo e tratamento dos olhos'),
    ('Otorrinolaringologia', 'Estudo e tratamento de ouvido, nariz e garganta'),
    ('Urologia', 'Estudo e tratamento do sistema urinário'),
    ('Endocrinologia', 'Estudo e tratamento de hormônios e metabolismo');

INSERT INTO clinics (name, address, phone) VALUES
    ('Clínica Central', 'Rua Principal, 100 - São Paulo, SP', '(11) 3000-1000'),
    ('Clínica Norte', 'Av. Norte, 200 - São Paulo, SP', '(11) 3000-2000'),
    ('Clínica Sul', 'Rua Sul, 300 - São Paulo, SP', '(11) 3000-3000');

INSERT INTO health_plans (name, description, coverage_percentage, monthly_price) VALUES
    ('Plano Básico', 'Cobertura básica para consultas', 50.00, 150.00),
    ('Plano Standard', 'Cobertura intermediária', 70.00, 300.00),
    ('Plano Premium', 'Cobertura completa', 90.00, 600.00);
*/

COMMIT;
