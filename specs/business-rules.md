# Business Rules Specification — Sistema Clínica Médica

## 1. Appointment Scheduling Rules

### BR-APT-001: Slot Availability
- **Rule**: An appointment can only be booked if `schedules.available_slots > 0`.
- **Enforcement**: Database trigger `validate_appointment_booking` + Edge Function `SELECT FOR UPDATE`.
- **Error**: `SLOT_UNAVAILABLE` — "Este horário não está mais disponível."

### BR-APT-002: No Double Booking (Same Patient)
- **Rule**: A patient cannot have two appointments at the same time.
- **Check**: `SELECT COUNT(*) FROM appointments WHERE patient_id = ? AND schedule_id = ? AND status = 'scheduled'`.
- **Enforcement**: Edge Function `book-appointment`.
- **Error**: `DUPLICATE_BOOKING` — "Você já possui uma consulta agendada neste horário."

### BR-APT-003: No Time Conflict (Same Patient, Different Schedules)
- **Rule**: A patient cannot have overlapping appointments on the same date, even with different doctors.
- **Check**: For each existing scheduled appointment of the patient on the same date, verify no time overlap with the new schedule.
- **Overlap detection**:
  ```
  existing.start_time < new.end_time AND existing.end_time > new.start_time
  ```
- **Enforcement**: Edge Function `book-appointment`.
- **Error**: `TIME_CONFLICT` — "Conflito com outra consulta agendada."

### BR-APT-004: Doctor Active Check
- **Rule**: Appointments can only be booked with active doctors (`doctors.is_active = true`).
- **Enforcement**: Trigger `validate_appointment_booking` + Edge Function.
- **Error**: `DOCTOR_INACTIVE` — "Este médico não está disponível para agendamento."

### BR-APT-005: Patient Active Check
- **Rule**: Appointments can only be booked for active patients (`profiles.is_active = true`).
- **Enforcement**: Trigger `validate_appointment_booking` + Edge Function.
- **Error**: `PATIENT_INACTIVE` — "Conta do paciente está desativada."

### BR-APT-006: Idempotent Booking
- **Rule**: If a booking request is retried (e.g., network timeout), the system should detect and return the existing appointment instead of creating a duplicate.
- **Detection**: Before INSERT, check for existing appointment with same `patient_id + schedule_id + status = 'scheduled'`.
- **Enforcement**: Edge Function `book-appointment` step 6.
- **Behavior**: Return existing appointment (200 OK) instead of creating duplicate.

### BR-APT-007: Patient Can Only Book for Self
- **Rule**: A patient can only create appointments where `patient_id` matches their own patient record.
- **Enforcement**: Edge Function checks `auth.uid()` → patient record → `patient_id`.
- **Error**: `UNAUTHORIZED` — "Não é possível agendar para outro paciente."

### BR-APT-008: Future Date Only
- **Rule**: Appointments can only be booked for dates >= today.
- **Check**: `date >= CURRENT_DATE`.
- **Enforcement**: Zod schema validation + Edge Function.
- **Error**: `VALIDATION_ERROR` — "Não é possível agendar consultas para datas passadas."

### BR-APT-009: Appointment Status Defaults to Scheduled
- **Rule**: New appointments always start with `status = 'scheduled'`.
- **Enforcement**: Column default `DEFAULT 'scheduled'`.

---

## 2. Appointment Cancellation Rules

### BR-CAN-001: Only Scheduled Appointments Can Be Cancelled
- **Rule**: Only appointments with `status = 'scheduled'` can be cancelled.
- **Enforcement**: Edge Function `cancel-appointment`.
- **Error**: `CANNOT_CANCEL` — "Esta consulta não pode ser cancelada."

### BR-CAN-002: Patient Cancels Own Only
- **Rule**: Patients can only cancel their own appointments.
- **Enforcement**: Edge Function checks `auth.uid()` → patient record → `patient_id`.
- **Error**: `UNAUTHORIZED` — "Não é possível cancelar esta consulta."

### BR-CAN-003: Slot Released on Cancellation
- **Rule**: When an appointment is cancelled, `schedules.available_slots` is incremented by 1.
- **Enforcement**: Trigger `on_appointment_slot_change`.
- **Behavior**: Automatic. No manual intervention.

### BR-CAN-004: Cancellation is Idempotent
- **Rule**: Cancelling an already-cancelled appointment returns success (no error).
- **Enforcement**: Edge Function checks `status` before update.
- **Behavior**: If `status = 'cancelled'`, return success without changes.

### BR-CAN-005: Past Appointments Cannot Be Cancelled
- **Rule**: If `date < CURRENT_DATE`, the appointment cannot be cancelled.
- **Enforcement**: Edge Function.
- **Error**: `CANNOT_CANCEL` — "Não é possível cancelar consultas passadas."

### BR-CAN-006: Employee/Admin Can Cancel Any
- **Rule**: Employees and admins can cancel any appointment without patient restriction.
- **Enforcement**: Edge Function + RLS policy `appointments_update_employee_admin`.

---

## 3. Appointment Completion Rules

### BR-CMP-001: Doctor Marks Complete
- **Rule**: Only the doctor assigned to the appointment can mark it as completed.
- **Enforcement**: RLS policy `appointments_update_doctor` (checks `doctor_id` matches `auth.uid()`).
- **Behavior**: Status changes to `'completed'`. Slot is NOT released.

### BR-CMP-002: No Double Completion
- **Rule**: An appointment already marked as completed cannot be changed again.
- **Enforcement**: Frontend validation (button disabled) + DB check.
- **Behavior**: Terminal state.

### BR-CMP-003: Completion Not Restricted by Date
- **Rule**: A doctor can mark an appointment as completed on or after the appointment date.
- **Behavior**: Allows backdating completion if needed.

---

## 4. No-Show Rules

### BR-NS-001: Employee Marks No-Show
- **Rule**: Employees or admins can mark a scheduled appointment as 'no_show' if the appointment date has passed.
- **Enforcement**: Edge Function or direct update with RLS.
- **Condition**: `date < CURRENT_DATE AND status = 'scheduled'`.
- **Slot behavior**: Slot is NOT released (the slot was used, patient just didn't show).

### BR-NS-002: No-Show Cannot Be Reverted
- **Rule**: Once marked as 'no_show', the status cannot be changed.
- **Behavior**: Terminal state.

---

## 5. Schedule Management Rules

### BR-SCH-001: No Overlapping Schedules
- **Rule**: A doctor cannot have overlapping schedules on the same date at the same clinic.
- **Overlap definition**: `existing.start_time < new.end_time AND existing.end_time > new.start_time`.
- **Enforcement**: PostgreSQL exclusion constraint `schedules_no_overlap` + application-level check.
- **Error**: "Médico já possui horário agendado neste período."

### BR-SCH-002: Future Dates Only
- **Rule**: Schedules cannot be created for past dates.
- **Enforcement**: Zod validation + application check.
- **Error**: "Não é possível criar agenda para datas passadas."

### BR-SCH-003: End Time After Start Time
- **Rule**: `end_time > start_time` for all schedules.
- **Enforcement**: CHECK constraint `schedules_time_check`.
- **Error**: "Horário de término deve ser após o horário de início."

### BR-SCH-004: Max Slots Positive
- **Rule**: `max_slots > 0` for all schedules.
- **Enforcement**: CHECK constraint.

### BR-SCH-005: Available Slots Cannot Exceed Max
- **Rule**: `available_slots <= max_slots` at all times.
- **Enforcement**: CHECK constraint `schedules_available_check`.

### BR-SCH-006: Cannot Reduce Capacity Below Bookings
- **Rule**: When editing a schedule, `new_max_slots >= (max_slots - available_slots)` (i.e., cannot reduce below number of booked appointments).
- **Calculation**: `booked = max_slots - available_slots`. `new_max_slots >= booked`.
- **Enforcement**: Application-level check in Edge Function or frontend.
- **Error**: "Não é possível reduzir a capacidade. {booked} consultas já estão agendadas."

### BR-SCH-007: Cannot Delete Schedule with Bookings
- **Rule**: A schedule can only be deleted if `available_slots = max_slots` (no appointments booked).
- **Enforcement**: Application-level check.
- **Error**: "Não é possível excluir agenda com consultas agendadas. Cancele-as primeiro."

### BR-SCH-008: Schedule Requires Active Doctor
- **Rule**: Schedules can only be created for active doctors.
- **Enforcement**: Foreign key + application check.

### BR-SCH-009: Schedule Requires Active Clinic
- **Rule**: Schedules can only be created for active clinics.
- **Enforcement**: Foreign key + application check.

---

## 6. Medical Record Rules

### BR-MCR-001: Doctor Creates Own Records
- **Rule**: A doctor can only create medical records where `doctor_id` matches their own doctor record.
- **Enforcement**: RLS policy `medical_records_insert_doctor`.
- **Error**: Access denied (RLS returns empty or 403).

### BR-MCR-002: Diagnosis Required
- **Rule**: `diagnosis` is a required field when creating a medical record.
- **Enforcement**: NOT NULL constraint + Zod schema.
- **Error**: "Diagnóstico é obrigatório."

### BR-MCR-003: Linked to Appointment (Optional)
- **Rule**: A medical record can optionally link to an appointment via `appointment_id`.
- **Constraint**: `UNIQUE(appointment_id)` — at most one record per appointment.
- **Behavior**: If linked, the appointment cannot be deleted (RESTRICT).

### BR-MCR-004: Soft Delete by Admin Only
- **Rule**: Only admins can soft-delete medical records.
- **Enforcement**: RLS policy `medical_records_delete_admin`.
- **Behavior**: Sets `is_deleted = true`. Record still exists but is hidden from normal views.

### BR-MCR-005: Cannot Soft Delete Twice
- **Rule**: Attempting to soft-delete an already deleted record is a no-op.
- **Enforcement**: Application check.

### BR-MCR-006: Doctor Edits Own Records Only
- **Rule**: A doctor can only update medical records they created.
- **Enforcement**: RLS policy checks `doctor_id = auth.user_doctor_id()`.

### BR-MCR-007: Patient Views Own Non-Deleted Records
- **Rule**: Patients can only see their own records where `is_deleted = false`.
- **Enforcement**: RLS policy `medical_records_select_own`.

---

## 7. Health Plan Rules

### BR-HP-001: Coverage Percentage Range
- **Rule**: `coverage_percentage` must be between 0 and 100.
- **Enforcement**: CHECK constraint.

### BR-HP-002: Monthly Price Non-Negative
- **Rule**: `monthly_price >= 0`.
- **Enforcement**: CHECK constraint.

### BR-HP-003: Active Plans Only Shown
- **Rule**: Only plans with `is_active = true` are displayed to patients.
- **Enforcement**: Application filter.

### BR-HP-004: Plan Assignment Date Validation
- **Rule**: `end_date` must be null or >= `start_date`.
- **Enforcement**: CHECK constraint `patient_health_plans_date_check`.

### BR-HP-005: Unique Active Plan per Patient
- **Rule**: A patient can have at most one active (no end_date) assignment per health plan.
- **Enforcement**: Partial unique index `idx_patient_health_plan_active`.
- **Behavior**: Patient can have historical plans with end dates.

---

## 8. Doctor Management Rules

### BR-DOC-001: Unique CRM
- **Rule**: Each doctor has a unique CRM number.
- **Enforcement**: UNIQUE constraint on `doctors.crm`.
- **Error**: "CRM já cadastrado."

### BR-DOC-002: CRM Format
- **Rule**: CRM must be 4-10 alphanumeric characters, optionally followed by state suffix.
- **Enforcement**: Zod regex validation.

### BR-DOC-003: One Profile Per Doctor
- **Rule**: Each profile can only be linked to one doctor record.
- **Enforcement**: UNIQUE constraint on `doctors.profile_id`.

### BR-DOC-004: Consultation Price Non-Negative
- **Rule**: `consultation_price >= 0` or null.
- **Enforcement**: CHECK constraint.

### BR-DOC-005: Active Doctor Filtering
- **Rule**: Only doctors with `is_active = true` appear in booking flows.
- **Enforcement**: Application filter.

---

## 9. Patient Management Rules

### BR-PAT-001: Unique CPF
- **Rule**: Each patient has a unique CPF.
- **Enforcement**: UNIQUE constraint on `profiles.cpf`.
- **Error**: "CPF já cadastrado."

### BR-PAT-002: CPF Validation (Mod 11)
- **Rule**: CPF must pass the Brazilian CPF checksum algorithm.
- **Algorithm**:
  ```
  Step 1: Remove non-digits
  Step 2: Check length = 11
  Step 3: Reject all-same-digit CPFs (000.000.000-00, etc.)
  Step 4: Calculate first verification digit:
    sum = Σ (digit[i] × (10 - i)) for i = 0..8
    remainder = sum % 11
    digit = remainder < 2 ? 0 : 11 - remainder
  Step 5: Calculate second verification digit:
    sum = Σ (digit[i] × (11 - i)) for i = 0..9
    remainder = sum % 11
    digit = remainder < 2 ? 0 : 11 - remainder
  Step 6: Verify last two digits match
  ```
- **Enforcement**: Zod custom validation.

### BR-PAT-003: One Profile Per Patient
- **Rule**: Each profile can only be linked to one patient record.
- **Enforcement**: UNIQUE constraint on `patients.profile_id`.

### BR-PAT-004: Date of Birth Validation
- **Rule**: `date_of_birth` must be in the past and within reasonable range (0-150 years).
- **Enforcement**: Zod validation.

### BR-PAT-005: State Validation
- **Rule**: `state` must be a valid 2-letter Brazilian state code.
- **Enforcement**: CHECK constraint `length(state) = 2`.

### BR-PAT-006: CEP Validation
- **Rule**: `zip_code` must be exactly 8 digits.
- **Enforcement**: CHECK constraint `zip_code ~ '^\d{8}$'`.

---

## 10. Access Control Rules (Summary)

### RB-001: Patient Access
- Can view: own profile, own appointments, own medical records (non-deleted), own health plans, doctor list, schedule availability, specialties, clinics
- Can edit: own profile (limited fields), own appointments (cancel only)
- Can create: own appointments only
- Cannot: view other patients' data, create/edit/delete any entity other than own profile/appointments

### RB-002: Employee Access
- Can view: all patients, all doctors, all appointments, all schedules, all health plans, all medical records
- Can edit: any patient, any doctor (limited fields), any appointment, any schedule, health plans
- Can create: patients, appointments (on behalf of patients), schedules, health plan assignments
- Cannot: create doctor accounts, view audit logs, delete patients, manage specialties/clinics

### RB-003: Doctor Access
- Can view: own profile, own appointments, own patients (via appointments), own medical records, doctor list, schedule availability
- Can edit: own profile (limited fields), own appointments (mark complete), own medical records
- Can create: medical records (own patients only)
- Cannot: view other doctors' patients, manage schedules, view audit logs, manage health plans

### RB-004: Admin Access
- Can view: everything (all profiles, patients, doctors, appointments, schedules, medical records, audit logs, health plans, specialties, clinics)
- Can edit: everything
- Can create: everything
- Can delete: everything (soft delete for patients and medical records)
- Constraint: Cannot delete own admin account (prevents lockout)

---

## 11. Validation Rules per Entity

### Profiles

| Field | Rule | Error |
|-------|------|-------|
| name | Required, 2-200 chars, no `<>&"` | "Nome deve ter entre 2 e 200 caracteres" |
| cpf | Required, valid CPF format + checksum | "CPF inválido" |
| email | Required, valid email format | "Email inválido" |
| phone | Optional, `\d{10,11}` after removing non-digits | "Telefone inválido" |
| role | Required, one of enum values | "Papel inválido" |

### Patients

| Field | Rule | Error |
|-------|------|-------|
| date_of_birth | Required, past date | "Data de nascimento deve ser no passado" |
| gender | Required, one of enum values | "Gênero inválido" |
| address | Optional, max 500 chars | - |
| city | Optional, max 100 chars | - |
| state | Optional, 2 chars | "UF inválido" |
| zip_code | Optional, 8 digits | "CEP inválido" |
| blood_type | Optional, one of enum values | "Tipo sanguíneo inválido" |
| allergies | Optional, max 2000 chars | - |

### Doctors

| Field | Rule | Error |
|-------|------|-------|
| crm | Required, 4-10 chars, unique | "CRM inválido" / "CRM já cadastrado" |
| bio | Optional, max 2000 chars | - |
| consultation_price | Optional, >= 0 | "Preço deve ser positivo" |

### Schedules

| Field | Rule | Error |
|-------|------|-------|
| doctor_id | Required, valid UUID, active doctor | "Médico inválido" |
| clinic_id | Required, valid UUID, active clinic | "Clínica inválida" |
| date | Required, format YYYY-MM-DD, >= today | "Data inválida" / "Data não pode ser no passado" |
| start_time | Required, format HH:MM, < end_time | "Horário inválido" |
| end_time | Required, format HH:MM, > start_time | "Horário de término deve ser após início" |
| max_slots | Required, integer > 0 | "Capacidade deve ser maior que 0" |
| (no overlap) | Check against existing schedules | "Médico já possui horário neste período" |

### Appointments

| Field | Rule | Error |
|-------|------|-------|
| patient_id | Required, valid UUID, active patient | "Paciente inválido" |
| doctor_id | Required, valid UUID, active doctor | "Médico inválido" |
| schedule_id | Required, valid UUID, available slot | "Horário inválido" |
| clinic_id | Required, valid UUID | "Clínica inválida" |
| date | Required, matches schedule date | "Data não corresponde ao horário" |
| notes | Optional, max 500 chars | - |
| cancellation_reason | Optional, max 500 chars | - |

### Medical Records

| Field | Rule | Error |
|-------|------|-------|
| patient_id | Required, valid UUID | "Paciente inválido" |
| doctor_id | Required, matches auth user | "Médico inválido" |
| appointment_id | Optional, valid UUID, unique | "Consulta já possui prontuário" |
| diagnosis | Required, 1-5000 chars | "Diagnóstico é obrigatório" |
| notes | Optional, max 10000 chars | - |
| prescription | Optional, max 5000 chars | - |
| next_appointment_date | Optional, format YYYY-MM-DD | - |

### Health Plans

| Field | Rule | Error |
|-------|------|-------|
| name | Required, 1-200 chars | "Nome é obrigatório" |
| description | Optional, max 2000 chars | - |
| coverage_percentage | Required, 0-100 | "Percentual de cobertura deve estar entre 0 e 100" |
| monthly_price | Required, >= 0 | "Preço deve ser positivo" |

### Specialties

| Field | Rule | Error |
|-------|------|-------|
| name | Required, 1-200 chars, unique | "Nome é obrigatório" / "Especialidade já cadastrada" |
| description | Optional, max 2000 chars | - |

### Clinics

| Field | Rule | Error |
|-------|------|-------|
| name | Required, 1-200 chars | "Nome é obrigatório" |
| address | Required, 1-500 chars | "Endereço é obrigatório" |
| phone | Optional, max 20 chars | - |

---

## 12. Conflict Resolution Rules

### CR-001: Appointment Slot Conflict
- **Scenario**: Two patients try to book the same last slot simultaneously.
- **Resolution**: Row-level locking (`SELECT FOR UPDATE`) in Edge Function. First transaction wins. Second receives `SLOT_UNAVAILABLE`.
- **Database behavior**: PostgreSQL serialization ensures one INSERT succeeds, the other's UPDATE on `available_slots` affects 0 rows → triggers exception.

### CR-002: Schedule Edit During Booking
- **Scenario**: Employee reduces max_slots while patient is booking.
- **Resolution**: `SELECT FOR UPDATE` on schedule row in booking Edge Function. Schedule edit waits for booking transaction to complete (or fails if row is locked too long).

### CR-003: Concurrent Profile Updates
- **Scenario**: Patient and employee edit the same profile simultaneously.
- **Resolution**: Last write wins. Acceptable for profile data. `updated_at` reflects latest change.

### CR-004: Appointment Cancel + Complete Race
- **Scenario**: Patient cancels while doctor tries to mark complete.
- **Resolution**: Database row lock. First operation wins. Second receives conflict error.

---

## 13. Race Condition Prevention

### RC-001: Schedule Slot Atomicity
- **Implementation**: `UPDATE schedules SET available_slots = available_slots - 1 WHERE id = ? AND available_slots > 0`.
- **Check**: `ROW_COUNT() = 1`. If 0, slot was taken → rollback.

### RC-002: Appointment Status Atomicity
- **Implementation**: `UPDATE appointments SET status = ? WHERE id = ? AND status = ?` (with expected current status in WHERE).
- **Check**: `ROW_COUNT() = 1`. If 0, status already changed → handle gracefully.

### RC-003: Profile Upsert Safety
- **Implementation**: Use `INSERT ... ON CONFLICT DO NOTHING` for profile creation.
- **Check**: Return value indicates whether insert occurred.

### RC-004: Database-Level Guarantees
- **PostgreSQL transaction isolation**: SERIALIZABLE for Edge Functions (highest isolation).
- **Row locking**: `SELECT FOR UPDATE` on critical rows.
- **CHECK constraints**: Catch invariant violations at DB level.
- **Exclusion constraints**: Prevent overlapping schedules.
- **Unique constraints**: Prevent duplicate data.
