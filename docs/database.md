# Database Documentation — Sistema Clínica Médica

## Overview

Complete PostgreSQL database schema for the medical clinic management system. Managed via Supabase with Row Level Security (RLS) enforced at the database level.

## Migration

**File**: `supabase/migrations/001_initial_schema.sql`

Single migration file that creates the entire schema on a clean database. Wrapped in a transaction for atomicity.

## Enums

| Enum | Values |
|------|--------|
| `user_role` | `patient`, `employee`, `doctor`, `admin` |
| `gender` | `male`, `female`, `other` |
| `blood_type` | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `appointment_status` | `scheduled`, `completed`, `cancelled`, `no_show` |
| `audit_action` | `INSERT`, `UPDATE`, `DELETE` |

## Tables

### Core

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `profiles` | Extends `auth.users` (1:1) | `id` (FK→auth.users), `name`, `cpf`, `email`, `role` |
| `doctors` | Doctor profile data | `profile_id` (FK→profiles), `crm`, `consultation_price` |
| `patients` | Patient data | `profile_id` (FK→profiles), `date_of_birth`, `gender`, `blood_type` |
| `specialties` | Medical specialties | `name`, `description` |
| `clinics` | Physical locations | `name`, `address`, `phone` |
| `health_plans` | Insurance plans | `name`, `coverage_percentage`, `monthly_price` |

### Junction

| Table | Description | PK |
|-------|-------------|----|
| `doctor_specialties` | Doctor ↔ Specialty | `(doctor_id, specialty_id)` |
| `doctor_clinics` | Doctor ↔ Clinic | `(doctor_id, clinic_id)` |
| `patient_health_plans` | Patient ↔ Health Plan | `(patient_id, health_plan_id)` |

### Business

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `schedules` | Available time slots | `doctor_id`, `clinic_id`, `date`, `start_time`, `end_time`, `max_slots`, `available_slots` |
| `appointments` | Patient bookings | `patient_id`, `doctor_id`, `schedule_id`, `clinic_id`, `status` |
| `medical_records` | Consultation records | `patient_id`, `doctor_id`, `appointment_id`, `diagnosis`, `is_deleted` |

### Audit

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `audit_logs` | Change tracking | `user_id`, `action`, `table_name`, `record_id`, `old_data`, `new_data` |

## Indexes (26)

- **profiles**: `cpf`, `role`, `email`
- **patients**: `profile_id`, `date_of_birth`
- **doctors**: `profile_id`, `crm`, `is_active` (partial)
- **schedules**: `(doctor_id, date)`, `(clinic_id, date)`, `date`, `(doctor_id, date) WHERE available_slots > 0 AND is_active`
- **appointments**: `patient_id`, `doctor_id`, `schedule_id`, `status`, `date`, `(doctor_id, date)`, `(patient_id, date)`, `(status, date)`
- **medical_records**: `patient_id`, `doctor_id`, `appointment_id`, `(patient_id) WHERE is_deleted = false`
- **audit_logs**: `user_id`, `table_name`, `record_id`, `created_at`, `action`, `(table_name, action)`
- **patient_health_plans**: `patient_id`, `health_plan_id`, unique partial `(patient_id, health_plan_id) WHERE end_date IS NULL`

## Triggers (12)

| Trigger | Table | Event | Function |
|---------|-------|-------|----------|
| `set_updated_at_profiles` | profiles | BEFORE UPDATE | `update_updated_at_column()` |
| `set_updated_at_patients` | patients | BEFORE UPDATE | `update_updated_at_column()` |
| `set_updated_at_doctors` | doctors | BEFORE UPDATE | `update_updated_at_column()` |
| `set_updated_at_appointments` | appointments | BEFORE UPDATE | `update_updated_at_column()` |
| `set_updated_at_medical_records` | medical_records | BEFORE UPDATE | `update_updated_at_column()` |
| `on_auth_user_created` | auth.users | AFTER INSERT | `handle_new_user()` |
| `on_profile_created_patient` | profiles | AFTER INSERT | `handle_new_patient_profile()` |
| `audit_profiles` | profiles | AFTER INSERT/UPDATE/DELETE | `audit_trigger_func()` |
| `audit_appointments` | appointments | AFTER INSERT/UPDATE/DELETE | `audit_trigger_func()` |
| `audit_medical_records` | medical_records | AFTER INSERT/UPDATE/DELETE | `audit_trigger_func()` |
| `audit_doctors` | doctors | AFTER INSERT/UPDATE/DELETE | `audit_trigger_func()` |
| `audit_health_plans` | health_plans | AFTER INSERT/UPDATE/DELETE | `audit_trigger_func()` |
| `audit_patients` | patients | AFTER UPDATE/DELETE | `audit_trigger_func()` |
| `audit_schedules` | schedules | AFTER UPDATE | `audit_trigger_func()` |
| `validate_appointment_booking` | appointments | BEFORE INSERT | `validate_schedule_booking()` |
| `on_appointment_slot_change` | appointments | AFTER INSERT/UPDATE | `handle_appointment_slot_change()` |

## RLS Policies (56)

### Helper Functions
- `auth.user_role()` — Returns current user's role
- `auth.user_patient_id()` — Returns current user's patient ID
- `auth.user_doctor_id()` — Returns current user's doctor ID

### Policies by Table

| Table | Policies | Count |
|-------|----------|-------|
| profiles | select_own, select_employee_admin, update_own, update_employee, update_admin, delete_admin | 6 |
| patients | select_own, select_employee_admin, select_doctor_own, update_own, update_employee_admin, insert_employee_admin, delete_admin | 7 |
| doctors | select_all, insert_admin, update_own, update_admin, update_employee, delete_admin | 6 |
| specialties | select_all, insert_admin, update_admin, delete_admin | 4 |
| clinics | select_all, insert_admin, update_admin, delete_admin | 4 |
| health_plans | select_all, insert_employee_admin, update_employee_admin, delete_admin | 4 |
| patient_health_plans | select_own, select_employee_admin, insert_employee_admin, update_employee_admin, delete_employee_admin | 5 |
| doctor_specialties | select_all, insert_admin, delete_admin | 3 |
| doctor_clinics | select_all, insert_admin, delete_admin | 3 |
| schedules | select_all, insert_employee_admin, update_employee_admin, delete_employee_admin | 4 |
| appointments | select_own, select_doctor, select_employee_admin, insert_own, insert_employee, update_own, update_doctor, update_employee_admin, delete_admin | 9 |
| medical_records | select_own, select_doctor, select_employee_admin, insert_doctor, update_doctor, delete_admin | 6 |
| audit_logs | select_admin | 1 |
| **Total** | | **62** |

## Seed Data

10 specialties, 3 clinics, 3 health plans (commented out in migration, run via `supabase db seed`).

## Running

```bash
# Apply migration locally
supabase db reset

# Seed data
supabase db seed

# Push to production
supabase db push
```

## Security

- All tables have RLS enabled
- `audit_logs` only readable by admins
- `medical_records` support soft delete (`is_deleted`)
- Sensitive tables (`profiles`, `appointments`, `medical_records`, `doctors`, `health_plans`) have audit triggers
- Foreign keys use `RESTRICT` on business tables to prevent accidental data loss
