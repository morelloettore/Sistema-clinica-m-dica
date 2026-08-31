# Business Rules Specification

> Canonical reference for the Sistema Clínica Médica. Supersedes `specs/business-rules.md`.

---

## 1. Appointment Scheduling Rules

### BR-APT-001: Slot Availability
- **Rule**: Appointment requires `schedules.available_slots > 0`.
- **Enforcement**: Edge Function `book-appointment` uses `SELECT FOR UPDATE` + atomic `UPDATE ... WHERE available_slots > 0`.
- **Error**: `SLOT_UNAVAILABLE` — "Este horário não está mais disponível."

### BR-APT-002: No Double Booking (Same Patient, Same Slot)
- **Rule**: Patient cannot have two appointments on the same `schedule_id` with status `scheduled`.
- **Check**: `SELECT COUNT(*) FROM appointments WHERE patient_id = ? AND schedule_id = ? AND status = 'scheduled'`.
- **Enforcement**: Edge Function `book-appointment`.
- **Error**: `DUPLICATE_BOOKING` — "Você já possui uma consulta agendada neste horário."

### BR-APT-003: No Time Conflict (Same Patient, Different Schedules)
- **Rule**: Patient cannot have overlapping appointments on the same date, even with different doctors/schedules.
- **Overlap detection**: `existing.start_time < new.end_time AND existing.end_time > new.start_time`.
- **Enforcement**: Edge Function `book-appointment`.
- **Error**: `TIME_CONFLICT` — "Conflito com outra consulta agendada."

### BR-APT-004: Doctor Active Check
- **Rule**: Appointments require `doctors.is_active = true`.
- **Enforcement**: Edge Function + database trigger.
- **Error**: `DOCTOR_INACTIVE` — "Este médico não está disponível para agendamento."

### BR-APT-005: Patient Active Check
- **Rule**: Appointments require `profiles.is_active = true` for the patient.
- **Enforcement**: Edge Function + database trigger.
- **Error**: `PATIENT_INACTIVE` — "Conta do paciente está desativada."

### BR-APT-006: Idempotent Booking
- **Rule**: Retried booking requests (network timeout) must not create duplicates.
- **Detection**: Before INSERT, check for existing appointment with same `patient_id + schedule_id + status = 'scheduled'`.
- **Behavior**: Return existing appointment (200 OK) instead of creating duplicate.

### BR-APT-007: Patient Books for Self Only
- **Rule**: Patient's booking request must match `auth.uid()` → patient record → `patient_id`.
- **Enforcement**: Edge Function checks auth context.
- **Error**: `UNAUTHORIZED` — "Não é possível agendar para outro paciente."

### BR-APT-008: Future Date Only
- **Rule**: Appointment `date >= CURRENT_DATE`.
- **Enforcement**: Zod validation + Edge Function check.
- **Error**: `VALIDATION_ERROR` — "Não é possível agendar consultas para datas passadas."

### BR-APT-009: Default Status
- **Rule**: New appointments start with `status = 'scheduled'`.
- **Enforcement**: Column default `DEFAULT 'scheduled'`.

### BR-APT-010: Schedule Must Exist and Be Active
- **Rule**: `schedule_id` must reference an active (`is_active = true`) schedule with `available_slots > 0`.
- **Enforcement**: FK constraint + Edge Function check.

---

## 2. Appointment Cancellation Rules

### BR-CAN-001: Only Scheduled Appointments Cancelable
- **Rule**: Only appointments with `status = 'scheduled'` can be cancelled.
- **Enforcement**: Edge Function `cancel-appointment`.
- **Error**: `CANNOT_CANCEL` — "Esta consulta não pode ser cancelada."

### BR-CAN-002: Patient Cancels Own Only
- **Rule**: Patients can only cancel appointments where `patient_id` matches their own record.
- **Enforcement**: Edge Function + RLS.
- **Error**: `UNAUTHORIZED` — "Não é possível cancelar esta consulta."

### BR-CAN-003: Slot Released on Cancellation
- **Rule**: Cancellation increments `schedules.available_slots` by 1.
- **Enforcement**: Trigger `on_appointment_slot_change`. Automatic.

### BR-CAN-004: Idempotent Cancellation
- **Rule**: Cancelling an already-cancelled appointment returns success (no error).
- **Enforcement**: Edge Function checks status before update.

### BR-CAN-005: Past Appointments Not Cancelable
- **Rule**: If `date < CURRENT_DATE`, appointment cannot be cancelled.
- **Enforcement**: Edge Function.
- **Error**: `CANNOT_CANCEL` — "Não é possível cancelar consultas passadas."

### BR-CAN-006: Employee/Admin Can Cancel Any
- **Rule**: Employees and admins can cancel any appointment regardless of patient ownership.
- **Enforcement**: RLS policy `appointments_update_employee_admin`.

### BR-CAN-007: Doctor Cannot Cancel
- **Rule**: Doctors cannot cancel appointments. They can only mark as completed.
- **Enforcement**: RLS policy. No UPDATE permission for doctor role on appointments (except status → completed).

---

## 3. Appointment Completion Rules

### BR-CMP-001: Doctor Marks Complete
- **Rule**: Only the assigned doctor can mark an appointment as `completed`.
- **Enforcement**: RLS policy checks `doctor_id` matches `auth.uid()` (via doctor profile lookup).
- **Behavior**: Status → `completed`. Slot is NOT released (consultation occurred).

### BR-CMP-002: No Double Completion
- **Rule**: Already-completed appointments cannot be changed.
- **Enforcement**: Frontend disables button. DB check: `UPDATE ... WHERE status = 'scheduled' OR status = 'in_progress'` — returns 0 rows if already completed.

### BR-CMP-003: Completion Date Flexible
- **Rule**: Doctor can mark completion on or after appointment date. Backdating allowed.

---

## 4. No-Show Rules

### BR-NS-001: Employee/Admin Marks No-Show
- **Rule**: Employees or admins can mark `scheduled` appointment as `no_show` if `date < CURRENT_DATE`.
- **Condition**: `date < CURRENT_DATE AND status = 'scheduled'`.
- **Slot behavior**: Slot is NOT released (slot was reserved, patient didn't attend).

### BR-NS-002: No-Show is Terminal
- **Rule**: Once `no_show`, status cannot be changed.
- **Behavior**: Terminal state.

---

## 5. Schedule Management Rules

### BR-SCH-001: No Overlapping Schedules
- **Rule**: Doctor cannot have overlapping schedules on the same date at the same clinic.
- **Overlap**: `existing.start_time < new.end_time AND existing.end_time > new.start_time`.
- **Enforcement**: PostgreSQL exclusion constraint `schedules_no_overlap` + application-level check.
- **Error**: "Médico já possui horário agendado neste período."

### BR-SCH-002: Future Dates Only
- **Rule**: Schedules cannot be created for past dates.
- **Enforcement**: Zod validation + application check.
- **Error**: "Não é possível criar agenda para datas passadas."

### BR-SCH-003: End Time After Start Time
- **Rule**: `end_time > start_time`.
- **Enforcement**: CHECK constraint `schedules_time_check`.
- **Error**: "Horário de término deve ser após o horário de início."

### BR-SCH-004: Max Slots Positive
- **Rule**: `max_slots > 0`.
- **Enforcement**: CHECK constraint.

### BR-SCH-005: Available Slots Bounded
- **Rule**: `0 ≤ available_slots ≤ max_slots` at all times.
- **Enforcement**: CHECK constraint `schedules_available_check`.

### BR-SCH-006: Cannot Reduce Capacity Below Bookings
- **Rule**: When editing, `new_max_slots ≥ (max_slots - available_slots)`.
- **Calculation**: `booked = max_slots - available_slots`. `new_max_slots ≥ booked`.
- **Enforcement**: Application-level check.
- **Error**: "Não é possível reduzir a capacidade. {booked} consultas já estão agendadas."

### BR-SCH-007: Cannot Delete Schedule with Bookings
- **Rule**: Deletion requires `available_slots = max_slots` (no bookings).
- **Enforcement**: Application-level check.
- **Error**: "Não é possível excluir agenda com consultas agendadas. Cancele-as primeiro."

### BR-SCH-008: Active Doctor Required
- **Rule**: Schedules require `doctors.is_active = true`.
- **Enforcement**: FK + application check.

### BR-SCH-009: Active Clinic Required
- **Rule**: Schedules require `clinics.is_active = true`.
- **Enforcement**: FK + application check.

### BR-SCH-010: Only Employee/Admin Create
- **Rule**: Only employee and admin roles can create/edit/delete schedules.
- **Enforcement**: RLS policy.

---

## 6. Medical Record Rules

### BR-MCR-001: Doctor Creates Own Records
- **Rule**: Doctor can only create records where `doctor_id` matches their own doctor record.
- **Enforcement**: RLS policy `medical_records_insert_doctor`.
- **Error**: Access denied (RLS 403).

### BR-MCR-002: Diagnosis Required
- **Rule**: `diagnosis` is mandatory (NOT NULL + min 1 char).
- **Enforcement**: DB constraint + Zod schema.
- **Error**: "Diagnóstico é obrigatório."

### BR-MCR-003: One Record Per Appointment
- **Rule**: `appointment_id` is UNIQUE — at most one medical record per appointment.
- **Enforcement**: UNIQUE constraint.
- **Behavior**: If linked, appointment cannot be deleted (RESTRICT).

### BR-MCR-004: Soft Delete by Admin Only
- **Rule**: Only admins can set `is_deleted = true`.
- **Enforcement**: RLS policy `medical_records_delete_admin`.
- **Behavior**: Record hidden from normal views but exists in DB.

### BR-MCR-005: No Double Soft-Delete
- **Rule**: Attempting to soft-delete an already-deleted record is a no-op.
- **Enforcement**: Application check.

### BR-MCR-006: Doctor Edits Own Records Only
- **Rule**: Doctor can only update records they created (`doctor_id = auth.uid()` via doctor profile).
- **Enforcement**: RLS policy.

### BR-MCR-007: Patient Views Own Non-Deleted Records
- **Rule**: Patients see only their own records where `is_deleted = false`.
- **Enforcement**: RLS policy `medical_records_select_own`.

### BR-MCR-008: Employee Reads All Records
- **Rule**: Employees can read all medical records (for administrative purposes).
- **Enforcement**: RLS policy grants unrestricted read for employee role.

---

## 7. Health Plan Rules

### BR-HP-001: Coverage Range
- **Rule**: `coverage_percentage` must be 0.00–100.00.
- **Enforcement**: CHECK constraint.

### BR-HP-002: Non-Negative Price
- **Rule**: `monthly_price ≥ 0`.
- **Enforcement**: CHECK constraint.

### BR-HP-003: Active Plans Only Shown
- **Rule**: Patients see only `is_active = true` plans.
- **Enforcement**: Application filter.

### BR-HP-004: Date Validation
- **Rule**: `end_date` must be null or ≥ `start_date`.
- **Enforcement**: CHECK constraint `patient_health_plans_date_check`.

### BR-HP-005: Unique Active Assignment
- **Rule**: At most one active (end_date IS NULL) assignment per patient per plan.
- **Enforcement**: Partial unique index `idx_patient_health_plan_active`.
- **Behavior**: Historical plans with end_dates coexist.

### BR-HP-006: Employee Manages Plans
- **Rule**: Employees can CRUD health plans and assign them to patients.
- **Enforcement**: RLS policy.

### BR-HP-007: Admin Manages Assignments
- **Rule**: Admin can assign/remove health plans from patients.
- **Enforcement**: RLS policy.

---

## 8. Doctor Management Rules

### BR-DOC-001: Unique CRM
- **Rule**: Each doctor has a unique CRM.
- **Enforcement**: UNIQUE constraint on `doctors.crm`.
- **Error**: "CRM já cadastrado."

### BR-DOC-002: CRM Format
- **Rule**: 4-10 alphanumeric characters, optionally followed by state suffix (e.g., `12345SP`).
- **Enforcement**: Zod regex: `/^[A-Z0-9]{4,10}([A-Z]{2})?$/i`.
- **Error**: "CRM inválido."

### BR-DOC-003: One Profile Per Doctor
- **Rule**: Each profile links to at most one doctor record.
- **Enforcement**: UNIQUE constraint on `doctors.profile_id`.

### BR-DOC-004: Non-Negative Price
- **Rule**: `consultation_price ≥ 0` or null.
- **Enforcement**: CHECK constraint.

### BR-DOC-005: Active Filtering
- **Rule**: Only `is_active = true` doctors appear in booking flows.
- **Enforcement**: Application filter + Edge Function check.

### BR-DOC-006: Admin Creates Doctor Accounts
- **Rule**: Only admins can create doctor user accounts (with CRM, specialty, clinic assignments).
- **Enforcement**: RLS + application role check.

---

## 9. Patient Management Rules

### BR-PAT-001: Unique CPF
- **Rule**: Each profile has a unique CPF.
- **Enforcement**: UNIQUE constraint on `profiles.cpf`.
- **Error**: "CPF já cadastrado."

### BR-PAT-002: CPF Validation (Mod 11)
- **Rule**: CPF must pass the Brazilian CPF checksum algorithm.
- **Algorithm**:
  1. Remove non-digits.
  2. Verify length = 11.
  3. Reject all-same-digit CPFs (000.000.000-00 through 999.999.999-99).
  4. Calculate first check digit: `sum = Σ(digit[i] × (10 - i))` for i=0..8. `remainder = sum % 11`. `digit = remainder < 2 ? 0 : 11 - remainder`.
  5. Calculate second check digit: `sum = Σ(digit[i] × (11 - i))` for i=0..9. Same remainder logic.
  6. Verify last two digits match.
- **Enforcement**: Zod custom validator.
- **Error**: "CPF inválido."

### BR-PAT-003: One Profile Per Patient
- **Rule**: Each profile links to at most one patient record.
- **Enforcement**: UNIQUE constraint on `patients.profile_id`.

### BR-PAT-004: Date of Birth in Past
- **Rule**: `date_of_birth < CURRENT_DATE` and within 0-150 years.
- **Enforcement**: Zod validation.

### BR-PAT-005: State Code
- **Rule**: `state` is exactly 2 characters (UF code).
- **Enforcement**: CHECK constraint `length(state) = 2`.

### BR-PAT-006: CEP Format
- **Rule**: `zip_code` is exactly 8 digits.
- **Enforcement**: CHECK constraint `zip_code ~ '^\d{8}$'`.

### BR-PAT-007: Patient Self-Registration
- **Rule**: Patients can self-register. Role is hardcoded to `patient` — cannot self-assign other roles.
- **Enforcement**: Trigger `on_auth_user_created` always inserts `role = 'patient'`. Application never sends role during self-registration.

### BR-PAT-008: Profile Edit Restrictions
- **Rule**: Patients can edit only: name, phone, date_of_birth, gender, address, city, state, zip_code.
- **Non-editable by patients**: email, CPF, role, is_active.
- **Enforcement**: Application-level field filtering. RLS allows update on own row.

---

## 10. Access Control Rules (RBAC Summary)

### Patient
| Action | Allowed |
|--------|---------|
| View own profile | Yes |
| Edit own profile (limited fields) | Yes |
| Book own appointment | Yes |
| Cancel own appointment | Yes |
| View own appointments | Yes |
| View own medical records (non-deleted) | Yes |
| View own health plans | Yes |
| View doctor list, specialties, clinics | Yes |
| View schedule availability | Yes |
| View other patients' data | **No** |
| Manage any entity | **No** |

### Employee
| Action | Allowed |
|--------|---------|
| View all patients, doctors, appointments, schedules, health plans, medical records | Yes |
| Create patient records | Yes |
| Edit any patient (limited fields) | Yes |
| Create/edit/delete schedules | Yes |
| Book appointments on behalf of patients | Yes |
| Cancel/edit any appointment | Yes |
| Mark no-shows | Yes |
| Manage health plans (CRUD + assignments) | Yes |
| Create doctor accounts | **No** |
| Deactivate patients/doctors | **No** |
| Manage specialties/clinics | **No** |
| View audit logs | **No** |

### Doctor
| Action | Allowed |
|--------|---------|
| View own profile | Yes |
| Edit own profile (phone, bio only) | Yes |
| View own appointments | Yes |
| View own patients (via appointments) | Yes |
| Create/edit own medical records | Yes |
| Mark own appointments as completed | Yes |
| View doctor list, specialties, clinics | Yes |
| View other doctors' patients | **No** |
| Manage schedules | **No** |
| Manage health plans | **No** |
| Book/cancel appointments | **No** |
| View audit logs | **No** |

### Admin
| Action | Allowed |
|--------|---------|
| View everything | Yes |
| Edit everything | Yes |
| Create everything | Yes |
| Soft-delete patients, medical records | Yes |
| Deactivate/reactivate accounts | Yes |
| View audit logs | Yes |
| Delete own admin account | **No** (prevents lockout) |

---

## 11. Validation Rules per Entity

### profiles

| Field | Rule | Error |
|-------|------|-------|
| name | Required, 2-200 chars, no `<>&"` | "Nome deve ter entre 2 e 200 caracteres" |
| cpf | Required, valid CPF format + checksum | "CPF inválido" |
| email | Required, valid email | "Email inválido" |
| phone | Optional, `\d{10,11}` after stripping non-digits | "Telefone inválido" |
| role | Required, one of enum values | "Papel inválido" |

### patients

| Field | Rule | Error |
|-------|------|-------|
| date_of_birth | Required, past date | "Data de nascimento deve ser no passado" |
| gender | Required, one of enum values | "Gênero inválido" |
| address | Optional, max 500 chars | — |
| city | Optional, max 100 chars | — |
| state | Optional, 2 chars | "UF inválido" |
| zip_code | Optional, 8 digits | "CEP inválido" |
| blood_type | Optional, one of enum values | "Tipo sanguíneo inválido" |
| allergies | Optional, max 2000 chars | — |

### doctors

| Field | Rule | Error |
|-------|------|-------|
| crm | Required, 4-10 alphanumeric + optional state, unique | "CRM inválido" / "CRM já cadastrado" |
| bio | Optional, max 2000 chars | — |
| consultation_price | Optional, ≥ 0 | "Preço deve ser positivo" |

### schedules

| Field | Rule | Error |
|-------|------|-------|
| doctor_id | Required, valid UUID, active doctor | "Médico inválido" |
| clinic_id | Required, valid UUID, active clinic | "Clínica inválida" |
| date | Required, YYYY-MM-DD, ≥ today | "Data inválida" / "Data não pode ser no passado" |
| start_time | Required, HH:MM, < end_time | "Horário inválido" |
| end_time | Required, HH:MM, > start_time | "Horário de término deve ser após início" |
| max_slots | Required, integer > 0 | "Capacidade deve ser maior que 0" |
| no overlap | Exclusion constraint | "Médico já possui horário neste período" |

### appointments

| Field | Rule | Error |
|-------|------|-------|
| patient_id | Required, valid UUID, active patient | "Paciente inválido" |
| doctor_id | Required, valid UUID, active doctor | "Médico inválido" |
| schedule_id | Required, valid UUID, available slot | "Horário inválido" |
| clinic_id | Required, valid UUID | "Clínica inválida" |
| date | Required, matches schedule date | "Data não corresponde ao horário" |
| notes | Optional, max 500 chars | — |
| cancellation_reason | Optional, max 500 chars | — |

### medical_records

| Field | Rule | Error |
|-------|------|-------|
| patient_id | Required, valid UUID | "Paciente inválido" |
| doctor_id | Required, matches auth user | "Médico inválido" |
| appointment_id | Optional, valid UUID, unique | "Consulta já possui prontuário" |
| diagnosis | Required, 1-5000 chars | "Diagnóstico é obrigatório" |
| notes | Optional, max 10000 chars | — |
| prescription | Optional, max 5000 chars | — |
| next_appointment_date | Optional, YYYY-MM-DD | — |

### health_plans

| Field | Rule | Error |
|-------|------|-------|
| name | Required, 1-200 chars | "Nome é obrigatório" |
| description | Optional, max 2000 chars | — |
| coverage_percentage | Required, 0-100 | "Percentual de cobertura deve estar entre 0 e 100" |
| monthly_price | Required, ≥ 0 | "Preço deve ser positivo" |

### specialties

| Field | Rule | Error |
|-------|------|-------|
| name | Required, 1-200 chars, unique | "Nome é obrigatório" / "Especialidade já cadastrada" |
| description | Optional, max 2000 chars | — |

### clinics

| Field | Rule | Error |
|-------|------|-------|
| name | Required, 1-200 chars | "Nome é obrigatório" |
| address | Required, 1-500 chars | "Endereço é obrigatório" |
| phone | Optional, max 20 chars | — |

---

## 12. Conflict Resolution Rules

### CR-001: Appointment Slot Conflict
- **Scenario**: Two patients book the last slot simultaneously.
- **Resolution**: Row-level locking (`SELECT FOR UPDATE`) in Edge Function. First transaction commits, second's `UPDATE available_slots` affects 0 rows → exception → 409 error.
- **Database**: PostgreSQL SERIALIZABLE isolation for Edge Functions.

### CR-002: Schedule Edit During Booking
- **Scenario**: Employee reduces `max_slots` while patient is booking.
- **Resolution**: `SELECT FOR UPDATE` on schedule row. Schedule edit blocks until booking transaction completes (or fails on lock timeout).

### CR-003: Concurrent Profile Updates
- **Scenario**: Patient and employee edit the same profile simultaneously.
- **Resolution**: Last write wins. Acceptable for profile data. `updated_at` reflects latest change.

### CR-004: Cancel + Complete Race
- **Scenario**: Patient cancels while doctor marks complete.
- **Resolution**: Database row lock. First operation wins. Second receives conflict error.

---

## 13. Race Condition Prevention

### RC-001: Schedule Slot Atomicity
- **Implementation**: `UPDATE schedules SET available_slots = available_slots - 1 WHERE id = ? AND available_slots > 0`.
- **Check**: `ROW_COUNT() = 1`. If 0, slot was taken → rollback with error.

### RC-002: Appointment Status Atomicity
- **Implementation**: `UPDATE appointments SET status = ? WHERE id = ? AND status = ?` (expected current status in WHERE).
- **Check**: `ROW_COUNT() = 1`. If 0, status already changed → handle gracefully.

### RC-003: Profile Upsert Safety
- **Implementation**: `INSERT ... ON CONFLICT DO NOTHING` for profile creation.
- **Check**: Return value indicates whether insert occurred.

### RC-004: Database-Level Guarantees
- **Transaction isolation**: SERIALIZABLE for Edge Functions.
- **Row locking**: `SELECT FOR UPDATE` on critical rows (schedules during booking).
- **CHECK constraints**: Catch invariant violations at DB level.
- **Exclusion constraints**: Prevent overlapping schedules.
- **Unique constraints**: Prevent duplicate CRM, CPF, active health plan assignments.
- **Foreign key constraints**: Ensure referential integrity across all entities.
