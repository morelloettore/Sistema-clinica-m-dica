# Functional Requirements Specification

> Canonical reference for the Sistema Clínica Médica. Supersedes `specs/requirements.md`.

---

## 1. User Roles and Permissions

### 1.1 Patient

- Self-register (email + password + CPF).
- View/edit own profile (limited fields: name, phone, date_of_birth, gender, address).
- Book appointments for self only.
- Cancel own scheduled appointments.
- View own appointments, medical records (non-deleted), health plans.
- View doctor list, specialties, clinics, schedule availability.
- **Cannot**: view other patients' data, manage schedules, manage doctors, view audit logs.

### 1.2 Employee

- View/search all patients, doctors, appointments, schedules, health plans, medical records.
- Create patient records.
- Edit any patient data (except role, active status).
- Create/edit/delete schedules for active doctors/clinics.
- Book appointments on behalf of patients.
- Cancel/edit any appointment.
- Mark appointments as no_show.
- Manage health plans (CRUD on `health_plans`, assign plans to patients).
- **Cannot**: create doctor accounts, deactivate patients, manage specialties/clinics, view audit logs.

### 1.3 Doctor

- View own profile; edit limited fields (phone, bio).
- View own appointments (filtered by `doctor_id`).
- View own patients (via appointments).
- Create/edit own medical records.
- Mark own appointments as completed.
- View doctor list, specialties, clinics.
- **Cannot**: view other doctors' patients, manage schedules, manage health plans, view audit logs, book/cancel appointments.

### 1.4 Admin

- Full CRUD on all entities: profiles, patients, doctors, specialties, clinics, health_plans, schedules, appointments, medical_records.
- Create doctor accounts (with CRM, specialty assignment).
- Deactivate/reactivate patients and doctors.
- Soft-delete medical records.
- Assign health plans to patients.
- View all audit logs with filters (date, action, table, user).
- **Cannot**: delete own admin account (prevents lockout).

---

## 2. Entity Definitions

### 2.1 profiles

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK, FK→auth.users.id | Auth user reference |
| name | text | NO | 2-200 chars, no HTML entities | Full name |
| cpf | text | NO | UNIQUE, valid CPF format + checksum | Brazilian tax ID |
| email | text | NO | UNIQUE, valid email | = auth.users.email |
| phone | text | YES | 10-11 digits after stripping non-digits | Phone number |
| role | user_role enum | NO | patient, employee, doctor, admin | RBAC role |
| is_active | boolean | NO | Default: true | Account active flag |
| created_at | timestamptz | NO | Auto-generated | Row creation time |
| updated_at | timestamptz | NO | Auto-generated | Last update time |

### 2.2 patients

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| profile_id | uuid | NO | UNIQUE, FK→profiles.id | One-to-one |
| date_of_birth | date | NO | Must be in past | Birth date |
| gender | gender enum | NO | male, female, other | Gender |
| address | text | YES | Max 500 chars | Street address |
| city | text | YES | Max 100 chars | City |
| state | text | YES | Exactly 2 chars (UF code) | State |
| zip_code | text | YES | Exactly 8 digits (CEP) | Postal code |
| blood_type | blood_type enum | YES | A+, A-, B+, B-, AB+, AB-, O+, O- | Blood type |
| allergies | text | YES | Max 2000 chars | Free-text allergies |
| created_at | timestamptz | NO | Auto-generated | Row creation time |
| updated_at | timestamptz | NO | Auto-generated | Last update time |

### 2.3 doctors

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| profile_id | uuid | NO | UNIQUE, FK→profiles.id | One-to-one |
| crm | text | NO | UNIQUE, 4-10 alphanumeric chars + optional state suffix | Medical registration |
| bio | text | YES | Max 2000 chars | Professional biography |
| consultation_price | numeric(10,2) | YES | ≥ 0 | Price in BRL |
| is_active | boolean | NO | Default: true | Active flag |
| created_at | timestamptz | NO | Auto-generated | Row creation time |
| updated_at | timestamptz | NO | Auto-generated | Last update time |

### 2.4 specialties

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| name | text | NO | UNIQUE, 1-200 chars | Specialty name |
| description | text | YES | Max 2000 chars | Description |
| is_active | boolean | NO | Default: true | Active flag |
| created_at | timestamptz | NO | Auto-generated | Row creation time |

### 2.5 clinics

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| name | text | NO | 1-200 chars | Clinic name |
| address | text | NO | 1-500 chars | Full address |
| phone | text | YES | Max 20 chars | Phone |
| is_active | boolean | NO | Default: true | Active flag |
| created_at | timestamptz | NO | Auto-generated | Row creation time |

### 2.6 health_plans

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| name | text | NO | 1-200 chars | Plan name |
| description | text | YES | Max 2000 chars | Description |
| coverage_percentage | numeric(5,2) | NO | 0.00–100.00 | Coverage percentage |
| monthly_price | numeric(10,2) | NO | ≥ 0 | Monthly price in BRL |
| is_active | boolean | NO | Default: true | Active flag |
| created_at | timestamptz | NO | Auto-generated | Row creation time |

### 2.7 patient_health_plans

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| patient_id | uuid | NO | FK→patients.id | Patient reference |
| health_plan_id | uuid | NO | FK→health_plans.id | Plan reference |
| start_date | date | NO | Required | Coverage start |
| end_date | date | YES | Must be null or ≥ start_date | Coverage end (null = indefinite) |
| created_at | timestamptz | NO | Auto-generated | Row creation time |

**Unique constraint**: One active (end_date IS NULL) assignment per patient per plan. Historical records with end_dates allowed.

### 2.8 doctor_specialties

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| doctor_id | uuid | NO | Composite PK, FK→doctors.id | Doctor reference |
| specialty_id | uuid | NO | Composite PK, FK→specialties.id | Specialty reference |
| created_at | timestamptz | NO | Auto-generated | Row creation time |

### 2.9 doctor_clinics

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| doctor_id | uuid | NO | Composite PK, FK→doctors.id | Doctor reference |
| clinic_id | uuid | NO | Composite PK, FK→clinics.id | Clinic reference |
| created_at | timestamptz | NO | Auto-generated | Row creation time |

### 2.10 schedules

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| doctor_id | uuid | NO | FK→doctors.id | Doctor reference |
| clinic_id | uuid | NO | FK→clinics.id | Clinic reference |
| date | date | NO | ≥ CURRENT_DATE | Slot date |
| start_time | time | NO | < end_time | Slot start |
| end_time | time | NO | > start_time | Slot end |
| max_slots | integer | NO | > 0 | Maximum concurrent patients |
| available_slots | integer | NO | 0 ≤ available_slots ≤ max_slots | Remaining capacity |
| is_active | boolean | NO | Default: true | Active flag |
| created_at | timestamptz | NO | Auto-generated | Row creation time |

**Constraints**:
- Exclusion constraint: no overlapping schedules for same doctor + clinic + date.
- CHECK: `available_slots <= max_slots`.
- CHECK: `available_slots >= 0`.

### 2.11 appointments

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| patient_id | uuid | NO | FK→patients.id | Patient reference |
| doctor_id | uuid | NO | FK→doctors.id | Doctor reference |
| schedule_id | uuid | NO | FK→schedules.id | Schedule slot reference |
| clinic_id | uuid | NO | FK→clinics.id | Clinic reference |
| date | date | NO | Must match schedule date | Appointment date |
| status | appointment_status enum | NO | Default: 'scheduled' | Current status |
| notes | text | YES | Max 500 chars | Patient-provided notes |
| cancellation_reason | text | YES | Max 500 chars | Why cancelled |
| created_at | timestamptz | NO | Auto-generated | Row creation time |
| updated_at | timestamptz | NO | Auto-generated | Last update time |

### 2.12 medical_records

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| patient_id | uuid | NO | FK→patients.id | Patient reference |
| doctor_id | uuid | NO | FK→doctors.id | Doctor reference |
| appointment_id | uuid | YES | UNIQUE, FK→appointments.id | Optional linked appointment |
| diagnosis | text | NO | 1-5000 chars | Clinical diagnosis |
| notes | text | YES | Max 10000 chars | Clinical notes |
| prescription | text | YES | Max 5000 chars | Medication details |
| next_appointment_date | date | YES | Optional | Follow-up date |
| is_deleted | boolean | NO | Default: false | Soft-delete flag |
| created_by | uuid | NO | FK→profiles.id | Creator reference |
| created_at | timestamptz | NO | Auto-generated | Row creation time |
| updated_at | timestamptz | NO | Auto-generated | Last update time |

### 2.13 audit_logs

| Field | Type | Nullable | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Auto-generated |
| user_id | uuid | YES | FK→profiles.id (NULL = system) | Acting user |
| action | audit_action enum | NO | INSERT, UPDATE, DELETE | Action type |
| table_name | text | NO | | Affected table |
| record_id | uuid | NO | | Affected row PK |
| old_data | jsonb | YES | | Previous state |
| new_data | jsonb | YES | | New state |
| ip_address | inet | YES | | Client IP |
| created_at | timestamptz | NO | Auto-generated | Row creation time |

---

## 3. Entity Relationships

```
profiles (1) ──────< (1) patients
profiles (1) ──────< (1) doctors
patients (1) ──────< (N) patient_health_plans
health_plans (1) ───< (N) patient_health_plans
doctors (1) ──────< (N) doctor_specialties
specialties (1) ──< (N) doctor_specialties
doctors (1) ──────< (N) doctor_clinics
clinics (1) ──────< (N) doctor_clinics
doctors (1) ──────< (N) schedules
doctors (1) ──────< (N) appointments
patients (1) ──────< (N) appointments
schedules (1) ────< (N) appointments
doctors (1) ──────< (N) medical_records
patients (1) ──────< (N) medical_records
appointments (1) ──< (0..1) medical_records  (UNIQUE on appointment_id)
```

---

## 4. Appointment Status State Machine

### 4.1 States

| State | Description |
|-------|-------------|
| `scheduled` | Appointment created, awaiting consultation |
| `confirmed` | Patient checked in (optional intermediate state) |
| `checked_in` | Patient arrived at clinic |
| `in_progress` | Consultation underway |
| `completed` | Consultation finished |
| `cancelled` | Cancelled by patient/employee/admin |
| `no_show` | Patient did not attend |

### 4.2 Valid Transitions

```
                     ┌────────────┐
                     │ scheduled  │
                     └─────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   ┌────────────┐   ┌───────────┐   ┌──────────┐
   │ confirmed  │   │ cancelled │   │ no_show  │
   └─────┬──────┘   └───────────┘   └──────────┘
         │            (terminal)     (terminal)
         ▼
   ┌─────────────┐
   │ checked_in  │
   └──────┬──────┘
          │
          ▼
   ┌──────────────┐
   │ in_progress  │
   └──────┬───────┘
          │
          ▼
   ┌────────────┐
   │ completed  │
   └────────────┘
   (terminal)
```

### 4.3 Transition Rules

| From | To | Trigger | Allowed Roles | Preconditions |
|------|----|---------|---------------|---------------|
| — | `scheduled` | Booking created | system (Edge Function) | Slot available, doctor/patient active |
| `scheduled` | `confirmed` | Check-in | employee, admin | Appointment date = today |
| `scheduled` | `cancelled` | Cancel | patient (own), employee, admin | Date ≥ today |
| `scheduled` | `no_show` | Mark no-show | employee, admin | Date < today |
| `confirmed` | `checked_in` | Arrival | employee, admin | — |
| `confirmed` | `cancelled` | Cancel | patient (own), employee, admin | — |
| `checked_in` | `in_progress` | Start consultation | doctor (own), employee, admin | — |
| `checked_in` | `cancelled` | Cancel | employee, admin | — |
| `in_progress` | `completed` | Finish consultation | doctor (own) | — |

**Terminal states**: `completed`, `cancelled`, `no_show`. No further transitions from terminal states.

---

## 5. User Flows

### 5.1 Patient: Book Appointment

1. Navigate to `/patient/appointments/new`.
2. **Step 1** — Select specialty from list (fetched from `specialties` where `is_active = true`).
3. **Step 2** — Select doctor from filtered list (doctors with chosen specialty, `is_active = true`).
4. **Step 3** — Select date (calendar shows dates with available slots). Pick time slot from `schedules` where `available_slots > 0`.
5. **Step 4** — Review summary: specialty, doctor, date, time, clinic. Add optional notes.
6. Confirm → Edge Function `book-appointment` executes transaction.
7. Success → toast + redirect to appointments list. Failure → error message, return to step 3.

**Edge cases**:
- Slot taken during selection (race) → 409 "Este horário não está mais disponível." Return to step 3.
- Patient already has overlapping appointment → 409 "Conflito com outra consulta agendada."
- Doctor deactivated between selection and booking → "Este médico não está disponível para agendamento."
- Network timeout after server committed → retry triggers idempotency check; existing appointment returned.

### 5.2 Patient: Cancel Appointment

1. Navigate to `/patient/appointments`.
2. Click "Cancel" on a scheduled appointment.
3. Confirmation dialog with optional reason field.
4. Confirm → Edge Function `cancel-appointment`.
5. Status → `cancelled`, slot incremented, audit logged.

**Edge cases**:
- Already cancelled → idempotent success (no error).
- Past date → "Não é possível cancelar consultas passadas."
- Race: two cancellations on same appointment → atomic UPDATE WHERE status='scheduled' returns 0 rows → treat as already cancelled.

### 5.3 Employee: Create Schedule

1. Navigate to `/employee/schedules/new`.
2. Select doctor, clinic, date, start time, end time, max slots.
3. Validate: no overlap for same doctor+date+clinic (exclusion constraint). End > start. Date ≥ today.
4. Insert → schedule row created, `available_slots = max_slots`.

**Edge cases**:
- Overlapping time → "Médico já possui horário agendado neste período."
- Past date → "Não é possível criar agenda para datas passadas."
- Doctor inactive → "Médico não está ativo."

### 5.4 Doctor: Complete Consultation

1. Navigate to today's appointments.
2. Select appointment → view patient info, reason, history.
3. Click "Complete Consultation."
4. Fill medical record form: diagnosis (required), notes, prescription, next appointment date.
5. Save → medical record inserted, appointment status → `completed`.

**Edge cases**:
- Appointment already completed → button disabled.
- No patient linked → FK constraint error (should not reach UI).
- RLS blocks if doctor doesn't own the appointment → 403.

### 5.5 Admin: Create Doctor Account

1. Navigate to `/admin/doctors/new`.
2. Fill form: name, CPF, email, CRM, specialty(ies), phone, bio, consultation price.
3. Validate: unique CRM, valid CPF, valid email.
4. Create Supabase Auth user with `role = 'doctor'`. Insert into `doctors`. Link specialties via `doctor_specialties`.

**Edge cases**:
- Duplicate CRM → "CRM já cadastrado."
- Duplicate email → "An account with this email already exists."
- Duplicate CPF → "CPF já cadastrado."

### 5.6 Employee: Reschedule Appointment

1. Open appointment detail → click "Reschedule."
2. Select new doctor/date/time.
3. System validates new slot availability.
4. Transaction: increment old slot, decrement new slot, update appointment.

**Edge cases**:
- New slot unavailable → error, original appointment unchanged.
- Doctor changed to different specialty → allowed (doctor may cover multiple specialties).

### 5.7 Employee: Mark No-Show

1. View appointments list, filter past dates.
2. Select `scheduled` appointment with `date < today`.
3. Click "Mark No-Show."
4. Status → `no_show`. Slot NOT released (slot was used, patient didn't attend).

---

## 6. Non-Functional Requirements

### 6.1 Performance

- **NFR-P01**: Page load < 2s on 3G connection.
- **NFR-P02**: API response < 500ms at 95th percentile.
- **NFR-P03**: Appointment booking completes < 3s.
- **NFR-P04**: Support 100 concurrent users without degradation.

### 6.2 Security

- **NFR-S01**: All data in transit encrypted (HTTPS/TLS 1.3).
- **NFR-S02**: Passwords hashed via Supabase Auth (bcrypt).
- **NFR-S03**: No sensitive data in URL parameters.
- **NFR-S04**: JWT tokens expire in 1 hour; refresh tokens in 7 days.
- **NFR-S05**: RLS enforced on every table — no exceptions.
- **NFR-S06**: CPF validated against Brazilian format (XXX.XXX.XXX-XX) with mod-11 checksum.
- **NFR-S07**: CRM validated against medical council format (4-10 alphanumeric + state suffix).
- **NFR-S08**: No `v-html` on user-generated content (XSS prevention).

### 6.3 Usability

- **NFR-U01**: Responsive design (mobile-first).
- **NFR-U02**: All forms provide inline validation feedback.
- **NFR-U03**: Loading states shown for all async operations.
- **NFR-U04**: Error messages human-readable, not technical.
- **NFR-U05**: Consistent navigation across all role views.
- **NFR-U06**: WCAG 2.1 AA compliant — keyboard navigation, screen reader support, color contrast.

### 6.4 Reliability

- **NFR-R01**: 99.9% uptime target (Supabase SLA).
- **NFR-R02**: Data never lost — Supabase daily backups + point-in-time recovery.
- **NFR-R03**: Graceful degradation if Supabase temporarily unavailable.

### 6.5 Maintainability

- **NFR-M01**: TypeScript strict mode.
- **NFR-M02**: 100% Zod validation coverage on all inputs.
- **NFR-M03**: No `any` types in production code.
- **NFR-M04**: ESLint + Prettier enforced in CI.
- **NFR-M05**: All database changes via named migrations (no manual SQL).

### 6.6 Internationalization

- **NFR-I01**: UI in Brazilian Portuguese (pt-BR).
- **NFR-I02**: Date format DD/MM/YYYY.
- **NFR-I03**: Currency format R$ X.XXX,XX.

---

## 7. Edge Cases Reference

### 7.1 Registration

| Case | Handling |
|------|----------|
| Duplicate email | Supabase Auth rejects → map to "An account with this email already exists." |
| Duplicate CPF | Check via Edge Function before signUp → "CPF já cadastrado." |
| Invalid CPF | Zod custom validation (mod-11) rejects before submission. |
| Concurrent registration (same CPF) | DB unique constraint catches race condition. |
| Weak password | Zod schema: min 8 chars. |
| Email delivery fails | User can request resend. |

### 7.2 Appointment Booking

| Case | Handling |
|------|----------|
| Double booking (same patient, same slot) | Edge Function check before INSERT → 409 DUPLICATE_BOOKING |
| Time conflict (same patient, different slot) | Edge Function overlap detection → 409 TIME_CONFLICT |
| Slot exhaustion during booking | `SELECT FOR UPDATE` on schedule row. First transaction wins. |
| Doctor deactivated mid-booking | Edge Function checks `doctors.is_active` → DOCTOR_INACTIVE |
| Schedule deleted mid-booking | Edge Function checks `schedules.is_active` → error |
| Patient deactivated | Edge Function checks `profiles.is_active` → PATIENT_INACTIVE |
| Network timeout after commit | Idempotency: check existing appointment before INSERT, return existing if found |

### 7.3 Cancellation

| Case | Handling |
|------|----------|
| Already cancelled | Idempotent: return success |
| Past appointment | Reject: "Não é possível cancelar consultas passadas." |
| Race (two cancellations) | Atomic `UPDATE ... WHERE status = 'scheduled'` → 0 rows = already cancelled |

### 7.4 Schedule Management

| Case | Handling |
|------|----------|
| Overlapping schedules | Exclusion constraint at DB level + application check |
| Reducing capacity below bookings | Application check: `new_max_slots >= (max_slots - available_slots)` |
| Deleting schedule with bookings | Reject if `available_slots < max_slots` |
| Past date schedule | Reject creation |
| End time ≤ start time | CHECK constraint + Zod validation |

### 7.5 Medical Records

| Case | Handling |
|------|----------|
| Doctor creates for non-patient | FK constraint |
| Doctor creates for another doctor's patient | RLS blocks |
| Concurrent edits | Last write wins (acceptable for records) |
| Double soft-delete | No-op if already deleted |
| Record linked to appointment | UNIQUE constraint: at most one record per appointment |

### 7.6 General

| Case | Handling |
|------|----------|
| Session expiry during form submission | Refresh token auto-refreshed by supabase-js. If refresh fails → redirect to login with "Session expired" toast. |
| Browser back button | Vue Router history management. No data corruption. |
| SQL injection | PostgREST parameterizes all queries. RLS prevents unauthorized access. |
| XSS in medical notes | Vue auto-escapes templates. No `v-html` on user content. |
| Large dataset pagination | Standard offset pagination for normal use; cursor-based if >1000 records. |
