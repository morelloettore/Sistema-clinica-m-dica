# Database Specification — Sistema Clínica Médica

## 1. Complete ER Diagram (Text)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│  auth.users   │       │    profiles       │       │   patients    │
│──────────────│  1:1  │──────────────────│  1:1  │──────────────│
│ id (uuid)    │◄─────▶│ id (uuid)        │◄─────▶│ id (uuid)    │
│ email        │       │ name (text)      │       │ profile_id   │
│ ...          │       │ cpf (text)       │       │ date_of_birth│
└──────────────┘       │ role (enum)      │       │ gender       │
                       │ is_active (bool) │       │ address      │
                       │ created_at       │       │ blood_type   │
                       │ updated_at       │       │ allergies    │
                       └────────┬─────────┘       └──────┬───────┘
                                │                         │
                                │              ┌──────────┼──────────┐
                                │              │          │          │
                                │              ▼          ▼          ▼
                                │   ┌──────────────┐ ┌─────────────────┐ ┌──────────────────┐
                                │   │  appointments │ │  patient_health  │ │ medical_records   │
                                │   │──────────────│ │  _plans          │ │──────────────────│
                                │   │ id (uuid)    │ │─────────────────│ │ id (uuid)        │
                                │   │ patient_id ──┼─│ patient_id     │ │ patient_id ──────┼──▶ patients
                                │   │ doctor_id  ──┼─┤ health_plan_id │ │ doctor_id ───────┼──▶ doctors
                                │   │ schedule_id ─┼─┤ start_date     │ │ appointment_id ──┼──▶ appointments
                                │   │ clinic_id  ──┼─┤ end_date       │ │ diagnosis        │
                                │   │ date         │ └─────────────────┘ │ notes            │
                                │   │ status       │                     │ prescription     │
                                │   │ notes        │                     │ is_deleted       │
                                │   │ created_at   │                     │ created_by       │
                                │   └──────┬───────┘                     └──────────────────┘
                                │          │
                                │          ▼
                                │   ┌──────────────┐
                                │   │  schedules    │
                                │   │──────────────│
                                │   │ id (uuid)    │
                                │   │ doctor_id  ──┼──▶ doctors
                                │   │ clinic_id  ──┼──▶ clinics
                                │   │ date         │
                                │   │ start_time   │
                                │   │ end_time     │
                                │   │ max_slots    │
                                │   │ available_slots│
                                │   └──────────────┘
                                │
                       ┌────────┴─────────┐
                       │     doctors       │
                       │──────────────────│
                       │ id (uuid)        │
                       │ profile_id       │
                       │ crm (text)       │
                       │ bio (text)       │
                       │ consultation_price│
                       │ is_active        │
                       └────┬───────┬─────┘
                            │       │
              ┌─────────────┘       └──────────────┐
              ▼                                    ▼
   ┌──────────────────┐              ┌──────────────────┐
   │ doctor_specialties│              │  doctor_clinics   │
   │──────────────────│              │──────────────────│
   │ doctor_id       │              │ doctor_id        │
   │ specialty_id    │              │ clinic_id        │
   └────────┬─────────┘              └────────┬─────────┘
            ▼                                 ▼
   ┌──────────────┐                   ┌──────────────┐
   │ specialties   │                   │   clinics     │
   │──────────────│                   │──────────────│
   │ id (uuid)    │                   │ id (uuid)    │
   │ name (text)  │                   │ name (text)  │
   │ description  │                   │ address      │
   │ is_active    │                   │ phone        │
   └──────────────┘                   │ is_active    │
                                      └──────────────┘

   ┌──────────────┐
   │ health_plans  │
   │──────────────│
   │ id (uuid)    │
   │ name (text)  │
   │ description  │
   │ coverage_pct │
   │ monthly_price│
   │ is_active    │
   └──────────────┘

   ┌──────────────┐
   │ audit_logs    │
   │──────────────│
   │ id (uuid)    │
   │ user_id      │──▶ profiles
   │ action       │
   │ table_name   │
   │ record_id    │
   │ old_data     │
   │ new_data     │
   │ ip_address   │
   │ created_at   │
   └──────────────┘
```

## 2. Enums

```sql
CREATE TYPE user_role AS ENUM ('patient', 'employee', 'doctor', 'admin');

CREATE TYPE gender AS ENUM ('male', 'female', 'other');

CREATE TYPE blood_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

CREATE TYPE appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
```

## 3. Table Definitions (Exact SQL)

### Migration 001: Create Enums

```sql
-- supabase/migrations/20260101000001_create_enums.sql

CREATE TYPE user_role AS ENUM ('patient', 'employee', 'doctor', 'admin');
CREATE TYPE gender AS ENUM ('male', 'female', 'other');
CREATE TYPE blood_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
```

### Migration 002: Create Profiles

```sql
-- supabase/migrations/20260101000002_create_profiles.sql

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
```

### Migration 003: Create Specialties

```sql
-- supabase/migrations/20260101000003_create_specialties.sql

CREATE TABLE specialties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE specialties ADD CONSTRAINT specialties_name_unique UNIQUE (name);
```

### Migration 004: Create Health Plans

```sql
-- supabase/migrations/20260101000004_create_health_plans.sql

CREATE TABLE health_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  coverage_percentage NUMERIC(5,2) NOT NULL CHECK (coverage_percentage >= 0 AND coverage_percentage <= 100),
  monthly_price       NUMERIC(10,2) NOT NULL CHECK (monthly_price >= 0),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration 005: Create Clinics

```sql
-- supabase/migrations/20260101000005_create_clinics.sql

CREATE TABLE clinics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration 006: Create Doctors

```sql
-- supabase/migrations/20260101000006_create_doctors.sql

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

CREATE TABLE doctor_specialties (
  doctor_id     UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  specialty_id  UUID NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, specialty_id)
);

CREATE TABLE doctor_clinics (
  doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, clinic_id)
);
```

### Migration 007: Create Patients

```sql
-- supabase/migrations/20260101000007_create_patients.sql

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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
```

### Migration 008: Create Schedules

```sql
-- supabase/migrations/20260101000008_create_schedules.sql

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
    date WITH =,
    tsrange(
      (date || ' ' || start_time)::timestamp,
      (date || ' ' || end_time)::timestamp
    ) WITH &&
  ) WHERE (is_active = true);
```

**Note**: The exclusion constraint requires the `btree_gist` extension:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

### Migration 009: Create Appointments

```sql
-- supabase/migrations/20260101000009_create_appointments.sql

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
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration 010: Create Medical Records

```sql
-- supabase/migrations/20260101000010_create_medical_records.sql

CREATE TABLE medical_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id             UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  appointment_id        UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
  diagnosis             TEXT NOT NULL,
  notes                 TEXT,
  prescription          TEXT,
  next_appointment_date DATE,
  is_deleted            BOOLEAN NOT NULL DEFAULT false,
  created_by            UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration 011: Create Audit Logs

```sql
-- supabase/migrations/20260101000011_create_audit_logs.sql

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      audit_action NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partitioning strategy for audit_logs (optional, for scale):
-- If > 10M rows expected, partition by created_at (monthly).
-- For MVP, single table with proper indexes is sufficient.
```

## 4. All Indexes (with Rationale)

```sql
-- supabase/migrations/20260101000014_create_indexes.sql

-- Profiles
CREATE INDEX idx_profiles_cpf ON profiles (cpf);
CREATE INDEX idx_profiles_role ON profiles (role);
CREATE INDEX idx_profiles_email ON profiles (email);

-- Patients
CREATE INDEX idx_patients_profile_id ON patients (profile_id);
CREATE INDEX idx_patients_date_of_birth ON patients (date_of_birth);

-- Doctors
CREATE INDEX idx_doctors_profile_id ON doctors (profile_id);
CREATE INDEX idx_doctors_crm ON doctors (crm);
CREATE INDEX idx_doctors_is_active ON doctors (is_active) WHERE is_active = true;

-- Doctor Specialties (junction)
CREATE INDEX idx_doctor_specialties_specialty ON doctor_specialties (specialty_id);

-- Doctor Clinics (junction)
CREATE INDEX idx_doctor_clinics_clinic ON doctor_clinics (clinic_id);

-- Schedules
CREATE INDEX idx_schedules_doctor_date ON schedules (doctor_id, date);
CREATE INDEX idx_schedules_clinic_date ON schedules (clinic_id, date);
CREATE INDEX idx_schedules_date ON schedules (date);
CREATE INDEX idx_schedules_available ON schedules (doctor_id, date) WHERE available_slots > 0 AND is_active = true;

-- Appointments
CREATE INDEX idx_appointments_patient_id ON appointments (patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments (doctor_id);
CREATE INDEX idx_appointments_schedule_id ON appointments (schedule_id);
CREATE INDEX idx_appointments_status ON appointments (status);
CREATE INDEX idx_appointments_date ON appointments (date);
CREATE INDEX idx_appointments_doctor_date ON appointments (doctor_id, date);
CREATE INDEX idx_appointments_patient_date ON appointments (patient_id, date);
CREATE INDEX idx_appointments_status_date ON appointments (status, date);

-- Medical Records
CREATE INDEX idx_medical_records_patient_id ON medical_records (patient_id);
CREATE INDEX idx_medical_records_doctor_id ON medical_records (doctor_id);
CREATE INDEX idx_medical_records_appointment_id ON medical_records (appointment_id);
CREATE INDEX idx_medical_records_not_deleted ON medical_records (patient_id) WHERE is_deleted = false;

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs (table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs (record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_table_action ON audit_logs (table_name, action);

-- Patient Health Plans
CREATE INDEX idx_patient_health_plans_patient ON patient_health_plans (patient_id);
CREATE INDEX idx_patient_health_plans_health_plan ON patient_health_plans (health_plan_id);
```

### Index Rationale

| Index | Rationale |
|-------|-----------|
| `idx_profiles_cpf` | Login by CPF, duplicate check on registration |
| `idx_profiles_role` | Filter users by role (admin dashboard) |
| `idx_profiles_email` | Login by email, duplicate check |
| `idx_doctors_is_active` | Filter active doctors (doctor listing) |
| `idx_schedules_doctor_date` | **Critical**: Load doctor availability for booking |
| `idx_schedules_available` | **Critical**: Filter slots with availability |
| `idx_appointments_doctor_date` | Doctor's daily view |
| `idx_appointments_patient_date` | Patient's appointment list |
| `idx_appointments_status_date` | Filter by status + date range |
| `idx_medical_records_not_deleted` | Soft-delete filtering |
| `idx_audit_logs_table_action` | Admin audit log filtering |

## 5. Foreign Keys Summary

| Table | Column | References | On Delete |
|-------|--------|------------|-----------|
| profiles | id | auth.users(id) | CASCADE |
| patients | profile_id | profiles(id) | CASCADE |
| doctors | profile_id | profiles(id) | CASCADE |
| doctor_specialties | doctor_id | doctors(id) | CASCADE |
| doctor_specialties | specialty_id | specialties(id) | CASCADE |
| doctor_clinics | doctor_id | doctors(id) | CASCADE |
| doctor_clinics | clinic_id | clinics(id) | CASCADE |
| patient_health_plans | patient_id | patients(id) | CASCADE |
| patient_health_plans | health_plan_id | health_plans(id) | CASCADE |
| schedules | doctor_id | doctors(id) | CASCADE |
| schedules | clinic_id | clinics(id) | CASCADE |
| appointments | patient_id | patients(id) | RESTRICT |
| appointments | doctor_id | doctors(id) | RESTRICT |
| appointments | schedule_id | schedules(id) | RESTRICT |
| appointments | clinic_id | clinics(id) | RESTRICT |
| medical_records | patient_id | patients(id) | RESTRICT |
| medical_records | doctor_id | doctors(id) | RESTRICT |
| medical_records | appointment_id | appointments(id) | SET NULL |
| medical_records | created_by | profiles(id) | RESTRICT |
| audit_logs | user_id | profiles(id) | SET NULL |

**Design decisions**:
- `RESTRICT` on appointments/medical_records: Prevent accidental cascade deletion of historical data.
- `CASCADE` on junction tables: Cleanup when parent is deleted.
- `SET NULL` on audit_logs.user_id: Preserve audit trail even if user is deleted.

## 6. Triggers and Functions

### 6.1 Auto-Update `updated_at`

```sql
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
```

### 6.2 Auto-Create Profile on Auth User Creation

```sql
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
```

### 6.3 Auto-Create Patient/Doctor Profile

```sql
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
```

### 6.4 Audit Trail Trigger

```sql
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

-- Apply audit trigger to sensitive tables
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
```

### 6.5 Schedule Slot Validation Trigger

```sql
CREATE OR REPLACE FUNCTION validate_schedule_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'scheduled' THEN
    -- Check available_slots > 0
    IF (SELECT available_slots FROM schedules WHERE id = NEW.schedule_id) <= 0 THEN
      RAISE EXCEPTION 'No available slots for this schedule';
    END IF;

    -- Check doctor is active
    IF NOT (SELECT is_active FROM doctors WHERE id = NEW.doctor_id) THEN
      RAISE EXCEPTION 'Doctor is not active';
    END IF;

    -- Check patient is active
    IF NOT (
      SELECT p.is_active
      FROM profiles p
      JOIN patients pt ON pt.profile_id = p.id
      WHERE pt.id = NEW.patient_id
    ) THEN
      RAISE EXCEPTION 'Patient account is deactivated';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_appointment_booking
  BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION validate_schedule_booking();
```

### 6.6 Slot Decrement/Increment on Appointment Status Change

```sql
CREATE OR REPLACE FUNCTION handle_appointment_slot_change()
RETURNS TRIGGER AS $$
BEGIN
  -- On new scheduled appointment: decrement available_slots
  IF TG_OP = 'INSERT' AND NEW.status = 'scheduled' THEN
    UPDATE schedules
    SET available_slots = available_slots - 1
    WHERE id = NEW.schedule_id AND available_slots > 0;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Schedule slot not available';
    END IF;
  END IF;

  -- On cancellation: increment available_slots
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
```

## 7. RLS Policies (Exact SQL)

### 7.1 Enable RLS on All Tables

```sql
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
```

### 7.2 Helper Function: Get User Role

```sql
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
```

### 7.3 Profiles Policies

```sql
-- supabase/policies/profiles.sql

-- Everyone can read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Employees and admins can read all profiles
CREATE POLICY "profiles_select_employee_admin"
  ON profiles FOR SELECT
  USING (auth.user_role() IN ('employee', 'admin'));

-- Patients can update their own profile (limited fields enforced in app)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Employees can update any profile
CREATE POLICY "profiles_update_employee"
  ON profiles FOR UPDATE
  USING (auth.user_role() = 'employee')
  WITH CHECK (auth.user_role() = 'employee');

-- Admins can update any profile
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (auth.user_role() = 'admin')
  WITH CHECK (auth.user_role() = 'admin');

-- Only admins can delete (deactivate) profiles
CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE
  USING (auth.user_role() = 'admin');
```

### 7.4 Patients Policies

```sql
-- supabase/policies/patients.sql

-- Patients can read their own data
CREATE POLICY "patients_select_own"
  ON patients FOR SELECT
  USING (profile_id = auth.uid());

-- Employees and admins can read all patients
CREATE POLICY "patients_select_employee_admin"
  ON patients FOR SELECT
  USING (auth.user_role() IN ('employee', 'admin'));

-- Doctors can read their patients (via appointments)
CREATE POLICY "patients_select_doctor_own"
  ON patients FOR SELECT
  USING (
    auth.user_role() = 'doctor'
    AND id IN (
      SELECT patient_id FROM appointments
      WHERE doctor_id = auth.user_doctor_id()
    )
  );

-- Patients can update their own data
CREATE POLICY "patients_update_own"
  ON patients FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Employees and admins can update any patient
CREATE POLICY "patients_update_employee_admin"
  ON patients FOR UPDATE
  USING (auth.user_role() IN ('employee', 'admin'))
  WITH CHECK (auth.user_role() IN ('employee', 'admin'));

-- Employees and admins can insert patients
CREATE POLICY "patients_insert_employee_admin"
  ON patients FOR INSERT
  WITH CHECK (auth.user_role() IN ('employee', 'admin'));

-- Only admins can delete patients
CREATE POLICY "patients_delete_admin"
  ON patients FOR DELETE
  USING (auth.user_role() = 'admin');
```

### 7.5 Doctors Policies

```sql
-- supabase/policies/doctors.sql

-- Everyone can read active doctors
CREATE POLICY "doctors_select_all"
  ON doctors FOR SELECT
  USING (true);

-- Only admins can insert doctors
CREATE POLICY "doctors_insert_admin"
  ON doctors FOR INSERT
  WITH CHECK (auth.user_role() = 'admin');

-- Doctors can update their own profile; admins can update any
CREATE POLICY "doctors_update_own"
  ON doctors FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "doctors_update_admin"
  ON doctors FOR UPDATE
  USING (auth.user_role() = 'admin')
  WITH CHECK (auth.user_role() = 'admin');

-- Employees can update doctors (scheduling purposes)
CREATE POLICY "doctors_update_employee"
  ON doctors FOR UPDATE
  USING (auth.user_role() = 'employee')
  WITH CHECK (auth.user_role() = 'employee');

-- Only admins can delete doctors
CREATE POLICY "doctors_delete_admin"
  ON doctors FOR DELETE
  USING (auth.user_role() = 'admin');
```

### 7.6 Specialties Policies

```sql
-- supabase/policies/specialties.sql

-- Everyone can read specialties
CREATE POLICY "specialties_select_all"
  ON specialties FOR SELECT
  USING (true);

-- Only admins can modify
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
```

### 7.7 Clinics Policies

```sql
-- supabase/policies/clinics.sql

-- Everyone can read clinics
CREATE POLICY "clinics_select_all"
  ON clinics FOR SELECT
  USING (true);

-- Only admins can modify
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
```

### 7.8 Health Plans Policies

```sql
-- supabase/policies/health_plans.sql

-- Everyone can read active health plans
CREATE POLICY "health_plans_select_all"
  ON health_plans FOR SELECT
  USING (true);

-- Employees and admins can modify
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
```

### 7.9 Patient Health Plans Policies

```sql
-- supabase/policies/patient_health_plans.sql

-- Patients can read their own plan assignments
CREATE POLICY "patient_health_plans_select_own"
  ON patient_health_plans FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );

-- Employees and admins can read all
CREATE POLICY "patient_health_plans_select_employee_admin"
  ON patient_health_plans FOR SELECT
  USING (auth.user_role() IN ('employee', 'admin'));

-- Employees and admins can modify
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
```

### 7.10 Doctor Specialties Policies

```sql
-- supabase/policies/doctor_specialties.sql

-- Everyone can read
CREATE POLICY "doctor_specialties_select_all"
  ON doctor_specialties FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "doctor_specialties_insert_admin"
  ON doctor_specialties FOR INSERT
  WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "doctor_specialties_delete_admin"
  ON doctor_specialties FOR DELETE
  USING (auth.user_role() = 'admin');
```

### 7.11 Doctor Clinics Policies

```sql
-- supabase/policies/doctor_clinics.sql

-- Everyone can read
CREATE POLICY "doctor_clinics_select_all"
  ON doctor_clinics FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "doctor_clinics_insert_admin"
  ON doctor_clinics FOR INSERT
  WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "doctor_clinics_delete_admin"
  ON doctor_clinics FOR DELETE
  USING (auth.user_role() = 'admin');
```

### 7.12 Schedules Policies

```sql
-- supabase/policies/schedules.sql

-- Everyone can read active schedules
CREATE POLICY "schedules_select_all"
  ON schedules FOR SELECT
  USING (is_active = true);

-- Employees and admins can modify
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
```

### 7.13 Appointments Policies

```sql
-- supabase/policies/appointments.sql

-- Patients can read their own appointments
CREATE POLICY "appointments_select_own"
  ON appointments FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );

-- Doctors can read their own appointments
CREATE POLICY "appointments_select_doctor"
  ON appointments FOR SELECT
  USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE profile_id = auth.uid()
    )
  );

-- Employees and admins can read all
CREATE POLICY "appointments_select_employee_admin"
  ON appointments FOR SELECT
  USING (auth.user_role() IN ('employee', 'admin'));

-- Patients can insert their own appointments
CREATE POLICY "appointments_insert_own"
  ON appointments FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    AND auth.user_role() = 'patient'
  );

-- Employees can insert on behalf of patients
CREATE POLICY "appointments_insert_employee"
  ON appointments FOR INSERT
  WITH CHECK (auth.user_role() = 'employee');

-- Patients can update (cancel) their own
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

-- Doctors can update their own appointments (mark complete)
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

-- Employees and admins can update any appointment
CREATE POLICY "appointments_update_employee_admin"
  ON appointments FOR UPDATE
  USING (auth.user_role() IN ('employee', 'admin'))
  WITH CHECK (auth.user_role() IN ('employee', 'admin'));

-- Admins can delete appointments
CREATE POLICY "appointments_delete_admin"
  ON appointments FOR DELETE
  USING (auth.user_role() = 'admin');
```

### 7.14 Medical Records Policies

```sql
-- supabase/policies/medical_records.sql

-- Patients can read their own non-deleted records
CREATE POLICY "medical_records_select_own"
  ON medical_records FOR SELECT
  USING (
    is_deleted = false
    AND patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );

-- Doctors can read records for their patients
CREATE POLICY "medical_records_select_doctor"
  ON medical_records FOR SELECT
  USING (
    is_deleted = false
    AND doctor_id IN (
      SELECT id FROM doctors WHERE profile_id = auth.uid()
    )
  );

-- Employees and admins can read all
CREATE POLICY "medical_records_select_employee_admin"
  ON medical_records FOR SELECT
  USING (
    is_deleted = false
    AND auth.user_role() IN ('employee', 'admin')
  );

-- Doctors can insert records for their patients
CREATE POLICY "medical_records_insert_doctor"
  ON medical_records FOR INSERT
  WITH CHECK (
    auth.user_role() = 'doctor'
    AND doctor_id = auth.user_doctor_id()
  );

-- Doctors can update their own records
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

-- Admins can delete (soft delete) records
CREATE POLICY "medical_records_delete_admin"
  ON medical_records FOR DELETE
  USING (auth.user_role() = 'admin');
```

### 7.15 Audit Logs Policies

```sql
-- supabase/policies/audit_logs.sql

-- Only admins can read audit logs
CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT
  USING (auth.user_role() = 'admin');

-- System handles inserts via SECURITY DEFINER functions (bypass RLS)
-- No INSERT/UPDATE/DELETE policies for users
```

## 8. Audit Strategy

### What Gets Audited

| Table | INSERT | UPDATE | DELETE | Rationale |
|-------|--------|--------|--------|-----------|
| profiles | ✅ | ✅ | ✅ | User account changes |
| appointments | ✅ | ✅ | ✅ | Critical business data |
| medical_records | ✅ | ✅ | ✅ | Sensitive health data |
| doctors | ✅ | ✅ | ✅ | Staff changes |
| health_plans | ✅ | ✅ | ✅ | Financial data |
| patients | ❌ | ✅ | ✅ | Patient data changes |
| schedules | ❌ | ✅ | ❌ | Schedule modifications |
| audit_logs | ❌ | ❌ | ❌ | Never audit the audit |

### Audit Log Contents

```typescript
interface AuditLog {
  id: string;
  user_id: string | null;    // null = system action
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;  // null on INSERT
  new_data: Record<string, unknown> | null;  // null on DELETE
  ip_address: string | null;
  created_at: Date;
}
```

### Audit Retention

- Audit logs are **never deleted** (no DELETE policy).
- Partition by month if table exceeds 10M rows.
- Consider archiving to cold storage after 2 years.

## 9. Migration Strategy

### Naming Convention

```
YYYYMMDDHHMMSS_description.sql
```

### Migration Rules

1. **Never modify applied migrations**. Create a new migration instead.
2. **Every migration must be reversible** (include DOWN section as comment).
3. **Test migrations locally** with `supabase db reset` before pushing.
4. **RLS policies go in separate migration** after tables are created.
5. **Seed data** goes in `supabase/seed.sql` (run with `supabase db seed`).

### Migration Execution Order

```
001_create_enums.sql
002_create_profiles.sql
003_create_specialties.sql
004_create_health_plans.sql
005_create_clinics.sql
006_create_doctors.sql (includes junction tables)
007_create_patients.sql (includes patient_health_plans)
008_create_schedules.sql
009_create_appointments.sql
010_create_medical_records.sql
011_create_audit_logs.sql
012_create_rls_policies.sql
013_create_functions.sql
014_create_indexes.sql
```

### Rollback Strategy

```bash
# Reset local database
supabase db reset

# Push migrations to remote
supabase db push

# If migration fails in production:
# 1. Create a fix-forward migration (NEVER modify applied migration)
# 2. Test locally
# 3. Push fix
```

### Seed Data (supabase/seed.sql)

```sql
-- Admin user (pre-created in auth.users via Supabase dashboard or script)
-- Specialty seeds
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

-- Clinic seeds
INSERT INTO clinics (name, address, phone) VALUES
  ('Clínica Central', 'Rua Principal, 100 - São Paulo, SP', '(11) 3000-1000'),
  ('Clínica Norte', 'Av. Norte, 200 - São Paulo, SP', '(11) 3000-2000'),
  ('Clínica Sul', 'Rua Sul, 300 - São Paulo, SP', '(11) 3000-3000');

-- Health plan seeds
INSERT INTO health_plans (name, description, coverage_percentage, monthly_price) VALUES
  ('Plano Básico', 'Cobertura básica para consultas', 50.00, 150.00),
  ('Plano Standard', 'Cobertura intermediária', 70.00, 300.00),
  ('Plano Premium', 'Cobertura completa', 90.00, 600.00);
```
