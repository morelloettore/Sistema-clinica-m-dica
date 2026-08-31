# Requirements Specification — Sistema Clínica Médica

## 1. Functional Requirements

### 1.1 Module: Authentication (AUTH)

#### AUTH-001: Patient Self-Registration
- **Description**: A new patient can create an account.
- **Inputs**: name (string, required), email (valid email, required), CPF (11 digits, required), password (min 8 chars, required), phone (optional).
- **Preconditions**: No existing account with the same email or CPF.
- **Flow**:
  1. User navigates to `/register`.
  2. Fills registration form.
  3. Frontend validates with Zod.
  4. Calls `supabase.auth.signUp()`.
  5. Supabase Auth creates `auth.users` row.
  6. Trigger `on_auth_user_created` inserts into `profiles` table with `role = 'patient'`.
  7. Confirmation email sent.
  8. User confirms email → redirected to `/login`.
- **Postconditions**: Patient exists in `profiles` with `role = 'patient'`, `is_active = true`.
- **Edge Cases**:
  - Duplicate email → error "An account with this email already exists."
  - Duplicate CPF → error "An account with this CPF already exists."
  - Weak password → Zod validation error "Password must be at least 8 characters."
  - Email delivery fails → user can request resend.

#### AUTH-002: Login
- **Description**: Any user can log in with email + password.
- **Inputs**: email (valid email), password (non-empty).
- **Flow**:
  1. User navigates to `/login`.
  2. Fills login form.
  3. Frontend validates with Zod.
  4. Calls `supabase.auth.signInWithPassword()`.
  5. On success → load profile → navigate to role-based dashboard.
- **Postconditions**: JWT stored, user authenticated.
- **Edge Cases**:
  - Invalid credentials → error "Invalid email or password." (same message for both cases)
  - Account deactivated → error "Your account has been deactivated. Please contact support."
  - Email not confirmed → error "Please confirm your email before logging in."
  - Rate limited → error "Too many login attempts. Please try again later."

#### AUTH-003: Password Reset
- **Description**: User can reset forgotten password via email.
- **Inputs**: email (valid email).
- **Flow**:
  1. User clicks "Forgot Password" on `/login`.
  2. Enters email.
  3. Calls `supabase.auth.resetPasswordForEmail()`.
  4. User receives email with reset link.
  5. User clicks link → navigates to `/reset-password`.
  6. Enters new password + confirmation.
  7. Calls `supabase.auth.updateUser({ password })`.
- **Postconditions**: Password updated, old sessions invalidated.

#### AUTH-004: Logout
- **Description**: User can sign out.
- **Flow**:
  1. User clicks "Logout" in header.
  2. Calls `supabase.auth.signOut()`.
  3. All Pinia stores reset.
  4. Redirect to `/login`.
- **Postconditions**: JWT invalidated, no cached data remains.

#### AUTH-005: Session Persistence
- **Description**: User stays authenticated across browser refreshes.
- **Flow**:
  1. On app load, `authStore.initialize()` runs.
  2. Calls `supabase.auth.getSession()`.
  3. If valid session → load profile → hydrate stores.
  4. If no session → redirect to `/login` when accessing protected routes.

### 1.2 Module: Patient Management (PAT)

#### PAT-001: View Own Profile
- **Description**: Patient views their profile data.
- **Flow**:
  1. Patient navigates to `/patient/profile`.
  2. Frontend queries `profiles` + `patients` for `auth.uid()`.
  3. Displays: name, CPF, email, phone, date of birth, gender, address, health plans.
- **Edge Cases**:
  - Profile not found → redirect to registration completion.
  - Supabase returns null → show "Profile not found."

#### PAT-002: Edit Own Profile
- **Description**: Patient can update their profile data.
- **Editable Fields**: name, phone, date_of_birth, gender, address.
- **Non-Editable Fields**: email, CPF, role (managed by admin).
- **Flow**:
  1. Patient clicks "Edit Profile" on `/patient/profile`.
  2. Form pre-filled with current data.
  3. Patient modifies fields.
  4. Frontend validates with Zod.
  5. Calls `supabase.from('patients').update(...)` (own row).
  6. RLS enforces `auth.uid() = profile_id`.
- **Edge Cases**:
  - Concurrent edit → last write wins (acceptable for profile data).
  - Validation failure → inline errors.

#### PAT-003: Employee Creates Patient
- **Description**: Employee can create a new patient record.
- **Inputs**: name, CPF, email, phone, date_of_birth, gender, address.
- **Flow**:
  1. Employee navigates to `/employee/patients/new`.
  2. Fills PatientForm.
  3. Frontend validates with Zod.
  4. Calls Edge Function or direct Supabase insert (employee role has INSERT permission).
  5. If email provided → Supabase Auth user created (or skipped if patient registers later).
- **Edge Cases**:
  - Duplicate CPF → reject.
  - Missing required fields → validation error.

#### PAT-004: Employee Views All Patients
- **Description**: Employee can list and search all patients.
- **Flow**:
  1. Employee navigates to `/employee/patients`.
  2. Table shows paginated patient list.
  3. Search by name, CPF, or email.
  4. Filter by active/inactive status.
- **RLS**: Employee sees all patients (no RLS filter for employee role on patients table).

#### PAT-005: Employee Edits Patient
- **Description**: Employee can edit any patient's data.
- **Flow**: Same as PAT-002 but RLS allows employee role.
- **Edge Cases**: Employee cannot change patient's role. Employee cannot deactivate patient (admin only).

#### PAT-006: Admin Deactivates Patient
- **Description**: Admin can soft-delete (deactivate) a patient.
- **Flow**:
  1. Admin navigates to patient detail.
  2. Clicks "Deactivate Patient."
  3. Confirmation dialog appears.
  4. Confirms → `UPDATE patients SET is_active = false WHERE id = ?`.
  5. Audit log inserted.
- **Postconditions**: Patient cannot log in. Existing appointments remain but are marked.

### 1.3 Module: Doctor Management (DOC)

#### DOC-001: View Doctor List (Public)
- **Description**: Any authenticated user can view the list of doctors with their specialties.
- **Flow**:
  1. Navigate to doctor listing page.
  2. View doctors with name, specialty, available clinics.
- **RLS**: Doctors table is readable by all authenticated users.

#### DOC-002: View Doctor Schedule
- **Description**: Patient/employee can view a doctor's available time slots.
- **Flow**:
  1. Select doctor.
  2. Pick a date range.
  3. View available slots from `schedules` table where `doctor_id` matches and `available_slots > 0`.
- **Edge Cases**:
  - Doctor has no schedule for date → show "No availability for this date."
  - All slots taken → show "Fully booked."

#### DOC-003: Admin Creates Doctor Profile
- **Description**: Admin creates a doctor user account.
- **Inputs**: name, CPF, email, specialty_id, CRM (medical registration number), phone, bio.
- **Flow**:
  1. Admin navigates to `/admin/doctors/new`.
  2. Fills DoctorForm.
  3. Frontend validates (CRM format, unique CRM per specialty).
  4. Creates Supabase Auth user with `role = 'doctor'`.
  5. Inserts into `doctors` table linked to profile.
- **Edge Cases**:
  - Duplicate CRM → error.
  - Duplicate email → error.

#### DOC-004: Doctor Views Own Profile
- **Description**: Doctor sees their own profile and can edit limited fields.
- **Editable**: phone, bio.
- **Non-Editable**: name, CPF, email, CRM, specialty (admin only).

#### DOC-005: Employee Views All Doctors
- **Description**: Employee can list, search, and filter doctors.
- **Filters**: by specialty, by clinic, by availability.
- **Flow**: Paginated table with search and filter controls.

### 1.4 Module: Appointment Management (APT)

#### APT-001: Patient Books Appointment
- **Description**: Patient selects specialty → doctor → date → time slot → confirms.
- **Inputs**: specialty_id, doctor_id, schedule_id, date (YYYY-MM-DD).
- **Preconditions**: Patient is authenticated. Slot has `available_slots > 0`.
- **Flow**:
  1. Patient navigates to `/patient/appointments/new`.
  2. Step 1: Select specialty → fetches doctors with that specialty.
  3. Step 2: Select doctor → fetches available dates.
  4. Step 3: Select date → fetches available time slots for that date/doctor.
  5. Step 4: Review and confirm.
  6. Calls Edge Function `book-appointment`.
  7. Edge Function validates, checks conflicts, creates appointment, decrements slot.
- **Postconditions**:
  - Appointment row created with `status = 'scheduled'`.
  - `schedules.available_slots` decremented by 1.
  - Audit log entry created.
- **Edge Cases**:
  - Slot no longer available (race condition) → 409 Conflict "This time slot is no longer available. Please select another."
  - Patient already has appointment at same time → 409 Conflict "You already have an appointment at this time."
  - Doctor unavailable → slot not shown.
  - Network error during booking → idempotency check (see Business Rules).

#### APT-002: Patient Cancels Appointment
- **Description**: Patient can cancel their own upcoming appointment.
- **Preconditions**: Appointment `status = 'scheduled'` and `date > now()`.
- **Flow**:
  1. Patient navigates to `/patient/appointments`.
  2. Clicks "Cancel" on upcoming appointment.
  3. Confirmation dialog.
  4. Calls Edge Function `cancel-appointment`.
  5. Edge Function sets `status = 'cancelled'`, increments slot, inserts audit.
- **Postconditions**:
  - Appointment `status = 'cancelled'`.
  - `schedules.available_slots` incremented by 1.
  - Audit log entry.
- **Edge Cases**:
  - Appointment already cancelled → return success (idempotent).
  - Appointment in the past → error "Cannot cancel past appointments."

#### APT-003: Employee Creates Appointment (On Behalf of Patient)
- **Description**: Employee can book appointment for a patient.
- **Flow**: Same as APT-001 but employee selects the patient.
- **Edge Cases**: Employee must select existing patient.

#### APT-004: Employee Cancels Any Appointment
- **Description**: Employee can cancel any appointment.
- **Flow**: Same as APT-002 but without patient_id restriction.

#### APT-005: Employee Edits Appointment
- **Description**: Employee can change appointment date/time/doctor.
- **Flow**:
  1. Employee opens appointment detail.
  2. Clicks "Reschedule."
  3. Selects new date/time/doctor.
  4. System validates new slot availability.
  5. Old slot incremented, new slot decremented, appointment updated.
- **Edge Cases**:
  - New slot unavailable → error, original unchanged.
  - Doctor changed to different specialty → allowed (doctor may cover multiple).

#### APT-006: Doctor Views Appointments
- **Description**: Doctor sees their own appointments for selected date range.
- **Filters**: date range, status.
- **RLS**: Doctor sees only appointments where `doctor_id` maps to their `doctors` row.

#### APT-007: Doctor Marks Appointment as Completed
- **Description**: Doctor marks appointment as "completed" after consultation.
- **Flow**:
  1. Doctor opens appointment detail.
  2. Clicks "Mark as Completed."
  3. Optionally creates medical record (linked).
  4. `UPDATE appointments SET status = 'completed' WHERE id = ?`.
- **Postconditions**: Status = 'completed'. Slot is NOT released (consultation happened).

#### APT-008: List Appointments (All Roles)
- **Description**: Each role sees appointments filtered by their permissions.
- **patient**: own appointments only.
- **doctor**: own appointments only (where doctor_id matches).
- **employee**: all appointments.
- **admin**: all appointments.

### 1.5 Module: Schedule Management (SCH)

#### SCH-001: Employee Creates Schedule
- **Description**: Employee creates time slots for a doctor on a specific date.
- **Inputs**: doctor_id, date, start_time, end_time, max_slots, clinic_id.
- **Flow**:
  1. Employee navigates to `/employee/schedules/new`.
  2. Selects doctor, date, time range, clinic, max slots.
  3. Frontend validates (no overlapping slots for same doctor/date).
  4. Inserts into `schedules` table.
- **Postconditions**: Schedule row created with `available_slots = max_slots`.
- **Edge Cases**:
  - Overlapping time for same doctor on same date → error "Doctor already has a schedule overlapping this time."
  - Past date → error "Cannot create schedule for past dates."
  - End time before start time → validation error.

#### SCH-002: Employee Edits Schedule
- **Description**: Employee can modify schedule details.
- **Restrictions**: Cannot reduce `max_slots` below `max_slots - available_slots` (i.e., below number of booked appointments).
- **Edge Cases**:
  - Attempting to reduce below booked count → error "Cannot reduce capacity. {n} appointments are already booked."

#### SCH-003: Employee Deletes Schedule
- **Description**: Employee can delete a schedule with no booked appointments.
- **Preconditions**: `available_slots = max_slots` (no bookings).
- **Edge Cases**:
  - Has bookings → error "Cannot delete schedule with existing appointments. Cancel them first."

#### SCH-004: View Available Slots
- **Description**: Patient/employee views available time slots for a doctor on a date.
- **Flow**:
  1. Query `schedules` where `doctor_id` = X, `date` = Y, `available_slots > 0`.
  2. Return list of slots with times and remaining capacity.

### 1.6 Module: Medical Records (MCR)

#### MCR-001: Doctor Creates Medical Record
- **Description**: Doctor creates a medical record after consultation.
- **Inputs**: patient_id, appointment_id (optional), diagnosis, notes, prescription, next_appointment_date (optional).
- **Flow**:
  1. Doctor navigates to patient detail from appointment.
  2. Fills MedicalRecordForm.
  3. Validates with Zod.
  4. Inserts into `medical_records`.
  5. RLS: only doctors can insert where `doctor_id = auth.uid()`.
- **Postconditions**: Record created with `created_by = auth.uid()`.
- **Edge Cases**:
  - No patient selected → validation error.
  - Diagnosis is required → validation error if empty.

#### MCR-002: Doctor Views Patient Records
- **Description**: Doctor views medical records for their patients.
- **RLS**: `doctor_id = auth.uid()` or `patient_id` is one of doctor's patients (via appointments).

#### MCR-003: Patient Views Own Records
- **Description**: Patient views their own medical records.
- **RLS**: `patient_id = (SELECT id FROM patients WHERE profile_id = auth.uid())`.

#### MCR-004: Employee Views Records
- **Description**: Employee can view all medical records (for administrative purposes).
- **RLS**: Employee role has unrestricted read on medical_records.

#### MCR-005: Admin Deletes Record
- **Description**: Admin can soft-delete a medical record.
- **Flow**: Sets `is_deleted = true`. Record still exists but is hidden from normal views.

### 1.7 Module: Health Plans (HP)

#### HP-001: Patient Views Own Plans
- **Description**: Patient views their active health plans.
- **Flow**: Query `patient_health_plans` joined with `health_plans` where `patient_id` = own.

#### HP-002: Employee Manages Plans
- **Description**: Employee can create, edit, deactivate health plans.
- **Inputs**: name, description, coverage_percentage (0-100), monthly_price, is_active.
- **Flow**: CRUD on `health_plans` table.

#### HP-003: Admin Manages Plan Assignments
- **Description**: Admin assigns health plans to patients.
- **Flow**:
  1. Select patient.
  2. Select health plan(s).
  3. Set start_date, end_date (optional).
  4. Insert into `patient_health_plans`.
- **Edge Cases**:
  - Overlapping plan for same patient → warning (allowed, but flagged).

### 1.8 Module: Clinic Management (CLN)

#### CLN-001: View Clinics
- **Description**: All users can view list of clinics.
- **Flow**: Read-only table of clinics (name, address, phone, specialties offered).

#### CLN-002: Admin Manages Clinics
- **Description**: Admin creates, edits, deactivates clinics.
- **Inputs**: name, address, phone, is_active.
- **Flow**: CRUD on `clinics` table.

### 1.9 Module: Specialty Management (SPE)

#### SPE-001: View Specialties
- **Description**: All users can view specialties.
- **Flow**: Read-only list.

#### SPE-002: Admin Manages Specialties
- **Description**: Admin creates, edits, deactivates specialties.
- **Inputs**: name, description, is_active.
- **Flow**: CRUD on `specialties` table.

### 1.10 Module: Audit Logs (AUD)

#### AUD-001: View Audit Logs (Admin Only)
- **Description**: Admin views all audit log entries.
- **Filters**: by date range, by action, by table, by user.
- **Flow**:
  1. Admin navigates to `/admin/audit`.
  2. Table with pagination showing: timestamp, user, action, table, record_id, details.
  3. Click row → expand to show old_data / new_data.
- **RLS**: Only admin role can query `audit_logs`.

---

## 2. Non-Functional Requirements

### 2.1 Performance
- **NFR-P01**: Page load time < 2s on 3G connection.
- **NFR-P02**: API response time < 500ms for 95th percentile.
- **NFR-P03**: Appointment booking completes < 3s.
- **NFR-P04**: Support 100 concurrent users without degradation.

### 2.2 Security
- **NFR-S01**: All data in transit encrypted (HTTPS/TLS 1.3).
- **NFR-S02**: All passwords hashed (Supabase Auth uses bcrypt).
- **NFR-S03**: No sensitive data in URL parameters.
- **NFR-S04**: JWT tokens expire in 1 hour, refresh tokens in 7 days.
- **NFR-S05**: RLS enforced on every table — no exceptions.
- **NFR-S06**: CPF validated against Brazilian format (XXX.XXX.XXX-XX).
- **NFR-S07**: CRM validated against medical council format.

### 2.3 Usability
- **NFR-U01**: Responsive design (mobile-first).
- **NFR-U02**: All forms provide inline validation feedback.
- **NFR-U03**: Loading states shown for all async operations.
- **NFR-U04**: Error messages are human-readable, not technical.
- **NFR-U05**: Consistent navigation across all role views.
- **NFR-U06**: Accessible (WCAG 2.1 AA): keyboard navigation, screen reader support, color contrast.

### 2.4 Reliability
- **NFR-R01**: 99.9% uptime target (Supabase SLA).
- **NFR-R02**: Data never lost (Supabase daily backups + point-in-time recovery).
- **NFR-R03**: Graceful degradation if Supabase is temporarily unavailable.

### 2.5 Maintainability
- **NFR-M01**: TypeScript strict mode enabled.
- **NFR-M02**: 100% Zod validation coverage on all inputs.
- **NFR-M03**: No `any` types in production code.
- **NFR-M04**: ESLint + Prettier enforced in CI.
- **NFR-M05**: All database changes via named migrations (no manual SQL).

### 2.6 Internationalization
- **NFR-I01**: UI in Brazilian Portuguese (pt-BR).
- **NFR-I02**: Date format DD/MM/YYYY.
- **NFR-I03**: Currency format R$ X.XXX,XX.

---

## 3. Entities, Fields, and Relationships

### 3.1 Entity List

| Entity | Description |
|--------|-------------|
| `profiles` | Base user data (extends Supabase Auth user) |
| `patients` | Patient-specific data |
| `doctors` | Doctor-specific data |
| `specialties` | Medical specialties |
| `clinics` | Clinic locations |
| `health_plans` | Health insurance plans |
| `patient_health_plans` | Junction: patient ↔ health plan |
| `doctor_specialties` | Junction: doctor ↔ specialty |
| `doctor_clinics` | Junction: doctor ↔ clinic |
| `schedules` | Doctor availability slots |
| `appointments` | Scheduled consultations |
| `medical_records` | Consultation records |
| `audit_logs` | System audit trail |

### 3.2 Entity Relationships

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
appointments (1) ──< (0..1) medical_records
```

### 3.3 Detailed Entity Definitions

#### profiles
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | = auth.users.id |
| name | text | NO | Full name |
| cpf | text | NO | Brazilian tax ID |
| email | text | NO | = auth.users.email |
| phone | text | YES | Phone number |
| role | user_role enum | NO | patient, employee, doctor, admin |
| is_active | boolean | NO | Default: true |
| created_at | timestamptz | NO | Auto-generated |
| updated_at | timestamptz | NO | Auto-generated |

#### patients
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| profile_id | uuid (FK→profiles) | NO | One-to-one |
| date_of_birth | date | NO | Patient birth date |
| gender | gender enum | NO | male, female, other |
| address | text | YES | Street address |
| city | text | YES | City |
| state | text(2) | YES | UF |
| zip_code | text(8) | YES | CEP |
| blood_type | blood_type enum | YES | A+, A-, B+, B-, AB+, AB-, O+, O- |
| allergies | text | YES | Free text |
| created_at | timestamptz | NO | Auto-generated |
| updated_at | timestamptz | NO | Auto-generated |

#### doctors
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| profile_id | uuid (FK→profiles) | NO | One-to-one |
| crm | text | NO | Medical registration number |
| bio | text | YES | Professional biography |
| consultation_price | numeric(10,2) | YES | Price in BRL |
| is_active | boolean | NO | Default: true |
| created_at | timestamptz | NO | Auto-generated |
| updated_at | timestamptz | NO | Auto-generated |

#### specialties
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| name | text | NO | Specialty name |
| description | text | YES | Description |
| is_active | boolean | NO | Default: true |
| created_at | timestamptz | NO | Auto-generated |

#### clinics
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| name | text | NO | Clinic name |
| address | text | NO | Full address |
| phone | text | YES | Phone |
| is_active | boolean | NO | Default: true |
| created_at | timestamptz | NO | Auto-generated |

#### health_plans
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| name | text | NO | Plan name |
| description | text | YES | Plan description |
| coverage_percentage | numeric(5,2) | NO | 0.00 to 100.00 |
| monthly_price | numeric(10,2) | NO | Monthly price in BRL |
| is_active | boolean | NO | Default: true |
| created_at | timestamptz | NO | Auto-generated |

#### patient_health_plans (junction)
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| patient_id | uuid (FK→patients) | NO | |
| health_plan_id | uuid (FK→health_plans) | NO | |
| start_date | date | NO | Coverage start |
| end_date | date | YES | NULL = active indefinitely |
| created_at | timestamptz | NO | Auto-generated |

#### doctor_specialties (junction)
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| doctor_id | uuid (FK→doctors) | NO | Composite PK |
| specialty_id | uuid (FK→specialties) | NO | Composite PK |
| created_at | timestamptz | NO | Auto-generated |

#### doctor_clinics (junction)
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| doctor_id | uuid (FK→doctors) | NO | Composite PK |
| clinic_id | uuid (FK→clinics) | NO | Composite PK |
| created_at | timestamptz | NO | Auto-generated |

#### schedules
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| doctor_id | uuid (FK→doctors) | NO | |
| clinic_id | uuid (FK→clinics) | NO | |
| date | date | NO | Slot date |
| start_time | time | NO | Slot start |
| end_time | time | NO | Slot end |
| max_slots | integer | NO | Max concurrent patients |
| available_slots | integer | NO | Decremented on booking |
| is_active | boolean | NO | Default: true |
| created_at | timestamptz | NO | Auto-generated |

#### appointments
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| patient_id | uuid (FK→patients) | NO | |
| doctor_id | uuid (FK→doctors) | NO | |
| schedule_id | uuid (FK→schedules) | NO | |
| clinic_id | uuid (FK→clinics) | NO | |
| date | date | NO | Appointment date |
| status | appointment_status enum | NO | Default: 'scheduled' |
| notes | text | YES | Patient notes |
| cancellation_reason | text | YES | If cancelled |
| created_at | timestamptz | NO | Auto-generated |
| updated_at | timestamptz | NO | Auto-generated |

#### medical_records
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| patient_id | uuid (FK→patients) | NO | |
| doctor_id | uuid (FK→doctors) | NO | |
| appointment_id | uuid (FK→appointments) | YES | 1:0..1 |
| diagnosis | text | NO | Clinical diagnosis |
| notes | text | YES | Clinical notes |
| prescription | text | YES | Medication details |
| next_appointment_date | date | YES | Follow-up date |
| is_deleted | boolean | NO | Default: false (soft delete) |
| created_by | uuid (FK→profiles) | NO | Who created |
| created_at | timestamptz | NO | Auto-generated |
| updated_at | timestamptz | NO | Auto-generated |

#### audit_logs
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | uuid (PK) | NO | Auto-generated |
| user_id | uuid (FK→profiles) | YES | NULL = system |
| action | audit_action enum | NO | INSERT, UPDATE, DELETE |
| table_name | text | NO | Table affected |
| record_id | uuid | NO | Affected row PK |
| old_data | jsonb | YES | Previous state |
| new_data | jsonb | YES | New state |
| ip_address | inet | YES | Client IP |
| created_at | timestamptz | NO | Auto-generated |

---

## 4. User Flows (Step-by-Step)

### 4.1 Patient: Book an Appointment

```
START
  │
  ▼
[Landing Page] ──click──> [Login] ──success──> [Patient Dashboard]
  │                                                        │
  │                                          click "New Appointment"
  │                                                        │
  │                                                        ▼
  │                                          [Book Appointment - Step 1]
  │                                          Select Specialty
  │                                          ┌─────────────────────┐
  │                                          │ Cardiology           │
  │                                          │ Dermatology          │
  │                                          │ Orthopedics          │
  │                                          │ ...                  │
  │                                          └─────────────────────┘
  │                                          ──select──>
  │                                                        │
  │                                                        ▼
  │                                          [Book Appointment - Step 2]
  │                                          Select Doctor
  │                                          ┌─────────────────────┐
  │                                          │ Dr. Maria Silva      │
  │                                          │ Dr. João Santos      │
  │                                          └─────────────────────┘
  │                                          ──select──>
  │                                                        │
  │                                                        ▼
  │                                          [Book Appointment - Step 3]
  │                                          Select Date & Time
  │                                          ┌─────────────────────┐
  │                                          │ 📅 Aug 2026          │
  │                                          │ 01  02  03  04  05  │
  │                                          │ ...                 │
  │                                          │                     │
  │                                          │ ⏰ Available Slots: │
  │                                          │ 08:00 (3 slots)     │
  │                                          │ 09:00 (1 slot)      │
  │                                          │ 14:00 (5 slots)     │
  │                                          └─────────────────────┘
  │                                          ──select──>
  │                                                        │
  │                                                        ▼
  │                                          [Book Appointment - Step 4]
  │                                          Review & Confirm
  │                                          ┌─────────────────────┐
  │                                          │ Specialty: Cardiology│
  │                                          │ Doctor: Dr. Maria    │
  │                                          │ Date: 15/08/2026     │
  │                                          │ Time: 09:00          │
  │                                          │ Clinic: Main Clinic  │
  │                                          │                     │
  │                                          │ [Cancel] [Confirm]  │
  │                                          └─────────────────────┘
  │                                          ──confirm──>
  │                                                        │
  │                                                        ▼
  │                                          [Booking Confirmed ✅]
  │                                          ──redirect──>
  │                                                        │
  │                                                        ▼
  │                                          [Patient Appointments]
  │                                          Shows new appointment
END
```

### 4.2 Patient: Cancel Appointment

```
START
  │
  ▼
[Patient Appointments] ──click──> [Appointment Detail]
  │                                      │
  │                          click "Cancel"
  │                                      │
  │                                      ▼
  │                          [Confirm Dialog]
  │                          "Are you sure you want to cancel?"
  │                          ┌─────────────────────┐
  │                          │ Reason (optional):    │
  │                          │ [_______________]     │
  │                          │                      │
  │                          │ [No] [Yes, Cancel]   │
  │                          └─────────────────────┘
  │                          ──confirm──>
  │                                      │
  │                                      ▼
  │                          [Toast: "Appointment cancelled"]
  │                          [Status updated to "Cancelled"]
END
```

### 4.3 Employee: Manage Schedule

```
START
  │
  ▼
[Employee Dashboard] ──click──> [Schedules]
  │                                      │
  │                          click "New Schedule"
  │                                      │
  │                                      ▼
  │                          [Schedule Form]
  │                          ┌─────────────────────┐
  │                          │ Doctor: [Dr. Maria ▼]│
  │                          │ Clinic: [Main    ▼]  │
  │                          │ Date: [15/08/2026]   │
  │                          │ Start: [08:00]       │
  │                          │ End: [12:00]         │
  │                          │ Max Slots: [10]      │
  │                          │                      │
  │                          │ [Cancel] [Create]    │
  │                          └─────────────────────┘
  │                          ──create──>
  │                                      │
  │                                      ▼
  │                          [Toast: "Schedule created"]
  │                          [Schedule appears in list]
END
```

### 4.4 Doctor: Complete Consultation

```
START
  │
  ▼
[Doctor Dashboard] ──click──> [Today's Appointments]
  │                                      │
  │                          click appointment
  │                                      │
  │                                      ▼
  │                          [Appointment Detail]
  │                          Shows: Patient info, reason, history
  │                          ──click "Complete Consultation"──>
  │                                                        │
  │                                                        ▼
  │                                          [Medical Record Form]
  │                                          ┌─────────────────────┐
  │                                          │ Patient: Maria       │
  │                                          │                      │
  │                                          │ Diagnosis:           │
  │                                          │ [_______________]    │
  │                                          │                      │
  │                                          │ Notes:               │
  │                                          │ [_______________]    │
  │                                          │                      │
  │                                          │ Prescription:        │
  │                                          │ [_______________]    │
  │                                          │                      │
  │                                          │ Next Appointment:    │
  │                                          │ [15/09/2026]         │
  │                                          │                      │
  │                                          │ [Cancel] [Save]      │
  │                                          └─────────────────────┘
  │                                          ──save──>
  │                                                        │
  │                                                        ▼
  │                                          [Toast: "Record saved"]
  │                                          [Appointment status: Completed]
END
```

### 4.5 Admin: Create Doctor Account

```
START
  │
  ▼
[Admin Dashboard] ──click──> [Doctors] ──click──> [New Doctor]
  │
  │  [Doctor Form]
  │  ┌─────────────────────────────────┐
  │  │ Name: [_______________]          │
  │  │ CPF:  [___] . [___] . [___] - [__] │
  │  │ Email: [_______________]         │
  │  │ CRM:  [_______________]         │
  │  │ Specialty: [Cardiology    ▼]    │
  │  │ Phone: [_______________]         │
  │  │ Bio: [_______________]           │
  │  │ Consultation Price: [R$ ___]     │
  │  │                                 │
  │  │ [Cancel] [Create Doctor]         │
  │  └─────────────────────────────────┘
  │  ──create──>
  │             │
  │             ▼
  │  [Toast: "Doctor created"]
  │  [Doctor appears in list]
END
```

---

## 5. States and State Transitions

### 5.1 Appointment Status

```
                    ┌──────────┐
                    │scheduled │
                    └────┬─────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐
     │completed │ │cancelled │ │no_show   │
     └──────────┘ └──────────┘ └──────────┘
```

| Transition | Trigger | Allowed Roles | Preconditions |
|------------|---------|---------------|---------------|
| → `scheduled` | Booking created | system | Slot available |
| `scheduled` → `completed` | Doctor marks done | doctor | Appointment date <= today |
| `scheduled` → `cancelled` | Patient/employee cancels | patient (own), employee, admin | Appointment not yet passed |
| `scheduled` → `no_show` | Employee marks | employee, admin | Appointment date < today |

**Terminal states**: `completed`, `cancelled`, `no_show`. No further transitions.

### 5.2 Patient Account Status

| Field | Values |
|-------|--------|
| `profiles.is_active` | `true` / `false` |

| Transition | Trigger | Allowed Roles |
|------------|---------|---------------|
| `true` → `false` | Admin deactivates | admin |
| `false` → `true` | Admin reactivates | admin |

### 5.3 Doctor Account Status

| Field | Values |
|-------|--------|
| `doctors.is_active` | `true` / `false` |

| Transition | Trigger | Allowed Roles |
|------------|---------|---------------|
| `true` → `false` | Admin deactivates | admin |
| `false` → `true` | Admin reactivates | admin |

### 5.4 Medical Record Status

| Field | Values |
|-------|--------|
| `medical_records.is_deleted` | `true` / `false` |

| Transition | Trigger | Allowed Roles |
|------------|---------|---------------|
| `false` → `true` | Admin soft-deletes | admin |

**No reverse transition** (admin undeletes not supported).

### 5.5 Schedule Status

| Field | Values |
|-------|--------|
| `schedules.is_active` | `true` / `false` |

| Transition | Trigger | Allowed Roles |
|------------|---------|---------------|
| `true` → `false` | Employee/Admin deactivates | employee, admin |

---

## 6. Edge Cases for Each Flow

### 6.1 Registration Edge Cases
- **Duplicate email**: Supabase Auth rejects. Map to user-friendly error.
- **Duplicate CPF**: Check via Edge Function before signUp. Return specific error.
- **Invalid CPF**: Validate checksum (mod 11 algorithm) in Zod.
- **Concurrent registration**: Race condition on CPF check → DB unique constraint catches it.

### 6.2 Appointment Booking Edge Cases
- **Double booking (same patient, same time)**: Check in Edge Function before INSERT.
- **Slot exhaustion during booking**: Use `SELECT ... FOR UPDATE` on schedule row to lock. Check `available_slots > 0`.
- **Doctor deactivated between slot view and booking**: Check `doctors.is_active` in Edge Function.
- **Schedule deleted between slot view and booking**: Check `schedules.is_active` and `schedules.is_deleted` (if soft delete) in Edge Function.
- **Patient deactivated**: Check `profiles.is_active` and `patients` existence in Edge Function.
- **Network timeout after booking succeeded**: Client retries → Edge Function uses idempotency check (see BR-APT-006).

### 6.3 Cancellation Edge Cases
- **Already cancelled**: Return success (idempotent).
- **Cancellation of past appointment**: Reject with error.
- **Race condition (two people cancel same appointment)**: `UPDATE ... WHERE status = 'scheduled'` returns 0 rows affected → treat as already cancelled.

### 6.4 Schedule Management Edge Cases
- **Overlapping schedules**: Check for time overlap in same doctor + date + clinic.
- **Reducing capacity below bookings**: Check `(max_slots - available_slots) <= new_max_slots`.
- **Deleting schedule with bookings**: Reject with error message showing count.
- **Past date schedule**: Reject creation.

### 6.5 Medical Record Edge Cases
- **Doctor creates record for non-patient**: FK constraint catches it.
- **Doctor creates record for patient not their own**: RLS blocks it.
- **Concurrent edits**: Last write wins (acceptable for records).

### 6.6 General Edge Cases
- **Concurrent page loads**: Race condition on data fetch → show latest data on next refresh.
- **Browser back button**: Vue Router handles history. No data corruption.
- **Session expiry during form submission**: Refresh token intercepted by supabase-js. If refresh fails → redirect to login with "Session expired" toast.
- **Large dataset pagination**: Cursor-based pagination for >1000 records (if needed). Standard offset pagination for normal use.
- **SQL injection**: Supabase PostgREST parameterizes all queries. RLS prevents unauthorized access.
- **XSS in medical notes**: Escape all output. Vue's template engine auto-escapes. No `v-html` on user content.
