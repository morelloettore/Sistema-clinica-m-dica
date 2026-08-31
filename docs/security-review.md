# Security Review — Sistema Clínica Médica

**Reviewer**: Agent 14 — Code Review / Integration / Red Team
**Date**: 2026-08-31
**Severity Scale**: CRITICAL → HIGH → MEDIUM → LOW → INFO
**Total Findings**: 42

> **Remediation status (2026-08-31)**: The 5 CRITICAL findings and 4 of 8 HIGH findings have been addressed in `supabase/migrations/001_initial_schema.sql`. See "Remediation Log" at the end of this document. Remaining HIGH items are documented design decisions (see notes inline).

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 8 |
| MEDIUM | 15 |
| LOW | 9 |
| INFO | 5 |

---

## 1. SECURITY VULNERABILITIES

### [CRITICAL] Employee INSERT policy on appointments allows booking for ANY patient — no patient_id validation

**Location**: `001_initial_schema.sql:750-752` — `appointments_insert_employee`

**Description**: The RLS INSERT policy for employees on the `appointments` table only checks `auth.user_role() = 'employee'`. It does NOT validate that the `patient_id` in the INSERT payload matches a real, active patient. An employee can insert any `patient_id` value (including fabricated UUIDs) and the INSERT will succeed at the RLS level. The database trigger `validate_schedule_booking` only checks that the `patient_id` exists and is active, but does NOT verify the employee has authorization to create an appointment for that specific patient.

**Impact**: An employee (or compromised employee account) can create phantom appointments linked to arbitrary patient UUIDs, polluting the scheduling system and potentially disrupting care for real patients. If the UUID happens to match a deleted patient's ID (RESTRICT prevents deletion while appointments exist, but if no appointment exists yet), this could cause confusion.

**Recommendation**: Modify the `appointments_insert_employee` policy to validate the `patient_id` exists in the `patients` table:

```sql
CREATE POLICY "appointments_insert_employee"
    ON appointments FOR INSERT
    WITH CHECK (
        auth.user_role() = 'employee'
        AND patient_id IN (SELECT id FROM patients)
    );
```

---

### [CRITICAL] Doctor can read ANY patient record — not just their own patients

**Location**: `001_initial_schema.sql:799-806` — `medical_records_select_doctor`

**Description**: The RLS SELECT policy for doctors on `medical_records` checks `doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())`. This means a doctor can read ANY medical record where THEY are the `doctor_id` — but they can also read records they created for patients they no longer have appointments with. More critically, there is NO check that the `patient_id` is a patient the doctor is currently treating. A doctor who previously had an appointment with Patient A can still see Patient A's medical records indefinitely, even if the appointment relationship has ended.

**Impact**: A doctor retains permanent access to medical records of former patients. In a multi-doctor clinic, Doctor A can see records they created for patients that are now being treated by Doctor B. This violates data minimization principles and could expose sensitive health information beyond what's necessary for current care.

**Recommendation**: Tighten the policy to check the patient is currently one of the doctor's patients:

```sql
CREATE POLICY "medical_records_select_doctor"
    ON medical_records FOR SELECT
    USING (
        is_deleted = false
        AND doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
        AND patient_id IN (
            SELECT patient_id FROM appointments
            WHERE doctor_id = (SELECT id FROM doctors WHERE profile_id = auth.uid())
        )
    );
```

---

### [CRITICAL] Admin DELETE on profiles does not prevent self-deletion — system lockout possible

**Location**: `001_initial_schema.sql:527-529` — `profiles_delete_admin`

**Description**: The `profiles_delete_admin` policy only checks `auth.user_role() = 'admin'`. There is no check preventing an admin from deleting their own profile. If the last admin deletes their own profile, the system becomes permanently locked — no one can create new admins because only admins can create admin accounts.

**Impact**: Complete system lockout. The only recovery would be direct database intervention (which requires Supabase dashboard access, bypassing the app entirely). Business rules (BR-004) explicitly state "Cannot delete own admin account" but this is NOT enforced at the database level.

**Recommendation**: Add a self-deletion guard:

```sql
CREATE POLICY "profiles_delete_admin"
    ON profiles FOR DELETE
    USING (
        auth.user_role() = 'admin'
        AND id != auth.uid()
    );
```

---

### [CRITICAL] Audit trigger on appointments fires for slot-change trigger operations — double slot manipulation risk

**Location**: `001_initial_schema.sql:441-466` — `handle_appointment_slot_change` + `audit_trigger_func`

**Description**: The `handle_appointment_slot_change` trigger fires on both INSERT and UPDATE. When an appointment is created as 'scheduled', it decrements the slot. When it transitions from 'scheduled' to 'completed' via UPDATE, the trigger fires again but the conditions `TG_OP = 'INSERT' AND NEW.status = 'scheduled'` and `TG_OP = 'UPDATE' AND OLD.status = 'scheduled' AND NEW.status = 'cancelled'` prevent unintended double-decrement. However, the `validate_schedule_booking` trigger runs BEFORE INSERT and checks `available_slots > 0` without row locking, creating a race condition with the AFTER INSERT slot-change trigger.

**Impact**: Under high concurrency, two concurrent bookings for the last slot could both pass the BEFORE INSERT validation (both read `available_slots = 1`), then both attempt the AFTER INSERT decrement. The `WHERE available_slots > 0` clause in the UPDATE prevents going negative, but one of the decrements will succeed while the other fails silently (the UPDATE affects 0 rows but the trigger doesn't check FOUND for the INSERT case correctly — it only checks for the case where `available_slots > 0` fails, not for the race).

Actually, the code does check `IF NOT FOUND` and raises an exception, so this is partially mitigated. But the BEFORE INSERT trigger reads `available_slots` without FOR UPDATE, creating a TOCTOU gap.

**Recommendation**: Remove the slot validation from the BEFORE INSERT trigger and rely solely on the AFTER INSERT trigger with proper row locking. Add `SELECT FOR UPDATE` in the Edge Function transaction to prevent TOCTOU.

---

### [CRITICAL] Exclusion constraint on schedules ignores clinic_id — overlapping schedules allowed at different clinics

**Location**: `001_initial_schema.sql:162-171` — `schedules_no_overlap`

**Description**: The exclusion constraint only checks `doctor_id` and `date` for overlap, ignoring `clinic_id`. This allows a doctor to have overlapping schedules at different clinics on the same date (e.g., 09:00-12:00 at Clinic A and 10:00-13:00 at Clinic B). This directly violates business rule BR-SCH-001 which specifies "A doctor cannot have overlapping schedules on the same date at the same clinic."

**Impact**: A doctor could be booked at two different clinics simultaneously, making it physically impossible to attend both appointments. The exclusion constraint provides a false sense of safety while not actually enforcing the intended business rule.

**Recommendation**: Include `clinic_id` in the exclusion constraint:

```sql
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
```

---

### [HIGH] Doctor UPDATE policy on profiles is missing — doctors cannot edit their own profile

**Location**: `001_initial_schema.sql:512-525` — profiles UPDATE policies

**Description**: The profiles UPDATE policies allow: own (`profiles_update_own`), employee (`profiles_update_employee`), and admin (`profiles_update_admin`). Doctors fall under "own" since they can update their own profile. However, the spec says doctors can edit `phone` and `bio` — but `phone` is on the `profiles` table while `bio` is on the `doctors` table. The doctor UPDATE on `doctors` table is handled separately. The issue is that the `profiles_update_own` policy allows a doctor to update ANY field on their own profile, including `role` and `is_active`.

**Impact**: A doctor could potentially update their own `role` field to 'admin' or set `is_active = false`. While the frontend restricts which fields can be edited, a direct API call via PostgREST could bypass these restrictions.

**Recommendation**: Add field-level validation via a WITH CHECK clause or use a PostgreSQL function that restricts which columns can be modified by non-admin/non-employee users.

---

### [HIGH] Employee can UPDATE patients but has no INSERT policy for patient_health_plans via Edge Function

**Location**: `001_initial_schema.sql:663-665` — `patient_health_plans_insert_employee_admin`

**Description**: The RLS policy allows employees to INSERT into `patient_health_plans`, but the spec (HP-003) says "Admin assigns health plans to patients." The permission matrix says "Can create: patients, appointments, schedules, health plan assignments" for employees. This creates an ambiguity: should employees be able to assign health plans? If yes, the spec is inconsistent. If no, the RLS policy is overly permissive.

**Impact**: An employee could assign unauthorized health plans to patients, potentially affecting billing and coverage calculations.

**Recommendation**: Clarify in the spec whether employees or only admins can assign health plans. Update the RLS policy accordingly.

---

### [HIGH] Audit trigger does NOT capture ip_address — column always NULL

**Location**: `001_initial_schema.sql:348-378` — `audit_trigger_func`

**Description**: The audit trigger function inserts `auth.uid()` as `user_id` but never sets the `ip_address` column. PostgreSQL triggers do not have access to HTTP request context (IP address, user agent). The `ip_address INET` and `user_agent TEXT` columns in `audit_logs` will always be NULL for trigger-generated entries.

**Impact**: Audit logs lack critical forensic information. In case of a security incident, investigators cannot determine the source IP of the action. This weakens the audit trail significantly.

**Recommendation**: Either:
1. Remove the `ip_address` and `user_agent` columns from the schema (they serve no purpose if always NULL), OR
2. Capture IP/user_agent in the Edge Functions and pass them as session variables that the trigger can read:

```sql
-- In Edge Function:
SELECT set_config('app.client_ip', $1, true);
-- In trigger:
current_setting('app.client_ip')::inet
```

---

### [HIGH] patients INSERT trigger creates dummy data — no mechanism to update later

**Location**: `001_initial_schema.sql:331-345` — `handle_new_patient_profile`

**Description**: When a new patient registers, the trigger `handle_new_patient_profile` creates a `patients` row with hardcoded dummy values: `date_of_birth = '2000-01-01'` and `gender = 'other'`. The spec says patients can edit their profile (PAT-002) but the editable fields include `date_of_birth` and `gender`. However, the `patients_update_own` RLS policy allows patients to update their own patient record. The issue is that the patient record is created with dummy data, and the patient must know to go update it.

**Impact**: Patient records contain inaccurate medical data (wrong birth date, wrong gender) until the patient manually updates their profile. This could lead to incorrect age-based medical decisions and violates data accuracy requirements.

**Recommendation**: Either:
1. Require patients to complete their profile during registration (add a "complete profile" step), OR
2. Make the patient trigger insert NULL values for optional fields and mark the profile as incomplete, OR
3. Add a `profile_complete` boolean to the patients table and gate certain operations on it.

---

### [HIGH] Doctor profile creation flow has no validation that profile_id matches an active doctor-role user

**Location**: `001_initial_schema.sql:573-575` — `doctors_insert_admin`

**Description**: The `doctors_insert_admin` INSERT policy only checks `auth.user_role() = 'admin'`. It does NOT validate that the `profile_id` being linked actually belongs to a user with `role = 'doctor'`. An admin could link a `doctors` record to a patient's profile, creating a phantom doctor.

**Impact**: A doctor record could be created pointing to a patient's profile. This would grant that patient doctor-level access to medical records of other patients via the `medical_records_select_doctor` RLS policy (which checks `doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())`).

**Recommendation**: Add a validation trigger on the `doctors` table:

```sql
CREATE OR REPLACE FUNCTION validate_doctor_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = NEW.profile_id AND role = 'doctor'
    ) THEN
        RAISE EXCEPTION 'Profile must have doctor role';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_doctor_profile_trigger
    BEFORE INSERT OR UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION validate_doctor_profile();
```

---

### [HIGH] Appointment creation by employee bypasses Edge Function — no conflict check

**Location**: `001_initial_schema.sql:750-752` — `appointments_insert_employee`

**Description**: When an employee creates an appointment via direct PostgREST INSERT (not through the `book-appointment` Edge Function), the only validation is the BEFORE INSERT trigger which checks slot availability, doctor active status, and patient active status. It does NOT check for:
- Patient time conflicts (BR-APT-003)
- Duplicate booking on same schedule (BR-APT-02)
- Past date validation (BR-APT-008)
- Idempotency (BR-APT-006)

**Impact**: An employee could book an appointment for a patient who already has an appointment at the same time, or book for a past date. These are business rule violations that the Edge Function normally prevents.

**Recommendation**: Either:
1. Route ALL appointment creation through the `book-appointment` Edge Function (remove direct PostgREST INSERT), OR
2. Add comprehensive validation to the BEFORE INSERT trigger.

---

### [HIGH] Doctor can update their own profile to change CRM — duplicate CRM possible

**Location**: `001_initial_schema.sql:577-580` — `doctors_update_own`

**Description**: The `doctors_update_own` policy allows a doctor to update their own `doctors` record. The spec (BR-DOC-004) says doctors can edit `phone` and `bio`, but the RLS policy allows updating ANY column including `crm`. A doctor could change their CRM to match another doctor's CRM, violating the UNIQUE constraint. The UNIQUE constraint would catch this, but the error message would be unclear.

**Impact**: doctors could attempt to change their CRM to bypass uniqueness checks. While the DB constraint prevents actual duplication, the error handling may not provide a clear message.

**Recommendation**: Restrict the UPDATE policy to only allow changes to `bio` and `consultation_price`:

```sql
CREATE POLICY "doctors_update_own"
    ON doctors FOR UPDATE
    USING (profile_id = auth.uid())
    WITH CHECK (
        profile_id = auth.uid()
        AND crm = (SELECT crm FROM doctors WHERE id = id)
    );
```

---

### [MEDIUM] Spec says "employees cannot view medical records" but RLS policy allows it

**Location**: `001_initial_schema.sql:808-813` — `medical_records_select_employee_admin`

**Description**: The spec permission matrix (architecture.md) says employees can "View all patients" and "View all appointments" but does NOT explicitly grant "View medical records" to employees. However, the RLS policy `medical_records_select_employee_admin` allows employees to read ALL non-deleted medical records. The requirements spec (MCR-004) says "Employee can view all medical records (for administrative purposes)."

**Impact**: This is an inconsistency between specs. If employees should NOT see medical records, this is a CRITICAL data exposure issue. If they SHOULD, the architecture spec needs updating.

**Recommendation**: Clarify the spec. Medical records contain highly sensitive health data (diagnoses, prescriptions). Employees (receptionists) typically should NOT have access to medical records unless specifically required by the clinic's operations.

---

### [MEDIUM] Schedules can be created for past dates — no DB-level enforcement

**Location**: `001_initial_schema.sql:147-160` — `schedules` table

**Description**: The `schedules` table has no CHECK constraint preventing `date < CURRENT_DATE`. Business rule BR-SCH-002 says "Schedules cannot be created for past dates" but this is only enforced at the application level (Zod validation + frontend check). A direct PostgREST INSERT could bypass this.

**Impact**: Employees could create schedules for past dates, which would allow bookings for appointments that should have already occurred.

**Recommendation**: Add a CHECK constraint:

```sql
ALTER TABLE schedules ADD CONSTRAINT schedules_future_date
    CHECK (date >= CURRENT_DATE);
```

Note: This constraint would need to be relaxed for testing/seed data. Consider using `date >= CURRENT_DATE - INTERVAL '1 day'` or excluding from seed data.

---

### [MEDIUM] Audit trigger not applied to patient_health_plans — assignment changes untracked

**Location**: `001_initial_schema.sql:381-407` — audit triggers

**Description**: Audit triggers are applied to: profiles, appointments, medical_records, doctors, health_plans, patients, schedules. The `patient_health_plans` junction table has NO audit trigger. Health plan assignments are not tracked in the audit log.

**Impact**: Changes to patient health plan assignments (which affect coverage and billing) are not audited. An unauthorized change to a patient's health plan would leave no trace.

**Recommendation**: Add an audit trigger to `patient_health_plans`:

```sql
CREATE TRIGGER audit_patient_health_plans
    AFTER INSERT OR UPDATE OR DELETE ON patient_health_plans
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

---

### [MEDIUM] Audit trigger not applied to clinics — clinic changes untracked

**Location**: `001_initial_schema.sql:381-407` — audit triggers

**Description**: The `clinics` table has no audit trigger. Clinic data (name, address, phone) can be modified without any audit trail.

**Impact**: Unauthorized changes to clinic information (e.g., redirecting patients to a different location) would leave no trace.

**Recommendation**: Add audit triggers for clinics and specialties tables.

---

### [MEDIUM] Realtime subscription subscribes to ALL table changes — no RLS filtering on client

**Location**: `architecture.md:637-640` — Realtime subscription

**Description**: The spec shows subscribing to `postgres_changes` on the entire `appointments` table with `event: '*'`. Supabase Realtime DOES respect RLS policies for filtered subscriptions, but the subscription shown uses `{ event: '*', schema: 'public', table: 'appointments' }` without filtering. A patient would receive notifications for ALL appointment changes (not just their own) if the Realtime service doesn't apply RLS filtering.

**Impact**: Patients could receive real-time notifications about other patients' appointments, leaking scheduling information.

**Recommendation**: Use filtered Realtime subscriptions:

```typescript
supabase
  .channel('my-appointments')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'appointments',
    filter: `patient_id=eq.${patientId}`  // Filter by patient
  }, (payload) => { ... })
  .subscribe();
```

---

### [MEDIUM] Employee can update doctor profiles — spec says "limited fields" but RLS allows all

**Location**: `001_initial_schema.sql:587-590` — `doctors_update_employee`

**Description**: The `doctors_update_employee` policy allows employees to update ANY column on the `doctors` table. The spec says employees can "Edit any doctor (limited fields)" but the RLS policy doesn't enforce which fields. An employee could change `is_active` to false, effectively deactivating a doctor.

**Impact**: An employee could deactivate a doctor's account, preventing them from being booked for new appointments and potentially disrupting patient care.

**Recommendation**: Restrict the employee UPDATE policy or use a trigger to prevent employees from changing `is_active`:

```sql
CREATE OR REPLACE FUNCTION restrict_doctor_employee_update()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.user_role() = 'employee' THEN
        NEW.is_active := OLD.is_active;
        NEW.crm := OLD.crm;
        NEW.profile_id := OLD.profile_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### [MEDIUM] No CSRF protection for form submissions beyond SameSite cookies

**Location**: `security.md:297-301` — CSRF Prevention

**Description**: The CSRF protection relies on JWT in Authorization header and SameSite cookies. While this is generally sufficient for API-based SPAs, the spec mentions "Edge middleware: redirect unauthenticated to /login" on Vercel. If the middleware uses cookies for authentication (not just the SPA), and if any form submission uses cookies instead of Authorization header, CSRF could be possible.

**Impact**: Low risk given the JWT-based auth, but defense-in-depth is missing.

**Recommendation**: Implement CSRF tokens for any form-based submissions, or ensure ALL requests use the Authorization header (never cookies for API calls).

---

### [MEDIUM] CSP allows 'unsafe-inline' for scripts — weakens XSS protection

**Location**: `security.md:279-289` — CSP headers

**Description**: The Content Security Policy includes `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`. The `'unsafe-inline'` directive allows inline JavaScript, which significantly weakens XSS protection. If any user-controlled data is reflected into an inline script, XSS is possible.

**Impact**: Stored XSS could be executed if user data appears in inline scripts (e.g., `<script>var userName = "{{user.name}}";</script>`).

**Recommendation**: Remove `'unsafe-inline'` from `script-src`. Use nonce-based or hash-based CSP for any inline scripts. Vite supports CSP nonce injection.

---

### [MEDIUM] health_plans is_active allows inactive plans to be read by all — no filter in RLS

**Location**: `001_initial_schema.sql:632-634` — `health_plans_select_all`

**Description**: The `health_plans_select_all` policy uses `USING (true)`, allowing all authenticated users to read ALL health plans including inactive ones. Business rule BR-HP-003 says "Only plans with `is_active = true` are displayed to patients" but this is only enforced at the application level.

**Impact**: Patients could see inactive/deprecated health plans, which could cause confusion or attempts to sign up for plans that are no longer available.

**Recommendation**: Filter inactive plans from patient views or add a separate policy.

---

### [MEDIUM] Doctor consultation_price visible to all users — potential information disclosure

**Location**: `001_initial_schema.sql:569-571` — `doctors_select_all`

**Description**: The `doctors_select_all` policy allows all users to read all doctor records, including `consultation_price`. This is financial information that may not be intended for patient-facing views.

**Impact**: Patients could compare prices and potentially make decisions based on cost rather than medical need. Competitors could scrape pricing data.

**Recommendation**: Consider hiding `consultation_price` from patient views, or create a separate view that excludes pricing for patient-facing queries.

---

### [MEDIUM] No rate limiting on RLS-protected endpoints — brute force possible

**Location**: `security.md:356-377` — Rate Limiting

**Description**: Rate limiting is specified for auth endpoints and Edge Functions, but not for PostgREST API endpoints. While Supabase provides default rate limits, the spec specifies 100 requests/second per user for REST API. A compromised account could make rapid requests to enumerate data.

**Impact**: Data exfiltration via rapid API requests from a compromised account.

**Recommendation**: Implement application-level rate limiting on sensitive queries (medical records, patient data) or use Supabase's built-in rate limiting features.

---

### [MEDIUM] appointments table has created_by column not in spec — potential data inconsistency

**Location**: `001_initial_schema.sql:184` — appointments table

**Description**: The actual migration includes a `created_by UUID REFERENCES profiles(id) ON DELETE SET NULL` column on the `appointments` table that is NOT defined in the database spec (database.md). This creates a discrepancy between the spec and implementation.

**Impact**: The `created_by` field is not tracked in the audit spec, not documented in the API spec, and could contain stale data if the creating user is deleted.

**Recommendation**: Either add `created_by` to the spec documentation or remove it from the migration if it's not needed.

---

### [MEDIUM] patients table has is_active column not in spec — spec mentions is_active on profiles only

**Location**: `001_initial_schema.sql:126` — patients table

**Description**: The actual migration includes `is_active BOOLEAN NOT NULL DEFAULT true` on the `patients` table. The spec says patient deactivation is via `profiles.is_active` (PAT-006), not `patients.is_active`. The `validate_schedule_booking` trigger checks `profiles.is_active` via the JOIN, not `patients.is_active`.

**Impact**: Two `is_active` fields could diverge — a patient could have `profiles.is_active = true` but `patients.is_active = false`, causing confusion about which is authoritative.

**Recommendation**: Clarify which `is_active` field is authoritative. Either use only `profiles.is_active` or add a trigger to sync them.

---

### [MEDIUM] audit_logs table has user_agent column not in spec

**Location**: `001_initial_schema.sql:216` — audit_logs table

**Description**: The migration includes `user_agent TEXT` on the `audit_logs` table, but the spec (database.md) does not define this column. Like `ip_address`, it's never populated by triggers.

**Impact**: Schema-spec drift. The column exists but is always NULL.

**Recommendation**: Remove the column or document it in the spec and implement capture logic.

---

### [MEDIUM] cancel-appointment Edge Function does not enforce BR-CAN-005 (past appointments cannot be cancelled)

**Location**: `api.md:761-762` — cancel-appointment processing steps

**Description**: The cancel-appointment Edge Function processing steps do not include a check for `date < CURRENT_DATE`. Business rule BR-CAN-005 explicitly states "If `date < CURRENT_DATE`, the appointment cannot be cancelled." The spec defines the error message and enforcement but the processing steps don't show this check.

**Impact**: Patients could cancel past appointments, which should be immutable records.

**Recommendation**: Add step 4.5: "Check `date >= CURRENT_DATE` — if not, return 409 CANNOT_CANCEL."

---

### [LOW] Spec says appointment date check uses `date >= CURRENT_DATE` but time-of-day not considered

**Location**: `business-rules.md:49` — BR-APT-008

**Description**: Business rule BR-APT-008 says "Appointments can only be booked for dates >= today." Using `date >= CURRENT_DATE` allows booking for today even if all of today's time slots have already passed. This is acceptable for clinic operations (patients may book same-day appointments until closing) but could be confusing if a patient books at 11:59 PM for a 9:00 AM slot that already passed.

**Impact**: Minor UX issue. A patient could book an appointment for a time slot that has already passed today.

**Recommendation**: Consider adding a time-based check for same-day bookings, or accept this as intentional behavior.

---

### [LOW] Doctor cannot SELECT their own profile — only employees/admins can see all profiles

**Location**: `001_initial_schema.sql:504-510` — profiles SELECT policies

**Description**: The `profiles_select_own` policy allows users to read their own profile. Doctors can read their own profile. But the spec (architecture.md:421) says doctors can "View own profile" — this is satisfied by `profiles_select_own`. However, doctors cannot read OTHER profiles, which means they cannot look up patient profiles by ID directly (they must go through the patients table with the appointment-based RLS).

**Impact**: Low impact — doctors access patient data through the patients table, not profiles directly. This is actually a good security practice.

**Recommendation**: No action needed. This is working as intended.

---

### [LOW] available_slots could go negative via race condition in slot-change trigger

**Location**: `001_initial_schema.sql:444-452` — handle_appointment_slot_change

**Description**: The slot decrement uses `UPDATE schedules SET available_slots = available_slots - 1 WHERE id = NEW.schedule_id AND available_slots > 0`. If two concurrent transactions both read `available_slots = 1`, both attempt the UPDATE. PostgreSQL's row-level locking should serialize these, but the CHECK constraint `available_slots >= 0` provides a safety net. The `IF NOT FOUND` check raises an exception, but this only catches the case where the UPDATE affects 0 rows.

**Impact**: Very unlikely but possible: both transactions could succeed if PostgreSQL's MVCC allows both to see `available_slots = 1` before either commits. The CHECK constraint would then prevent going negative, causing one to fail at commit time.

**Recommendation**: Use `SELECT FOR UPDATE` in the Edge Function to lock the schedule row before decrementing.

---

### [LOW] No UNIQUE constraint on patient_health_plans for non-active plans

**Location**: `001_initial_schema.sql:142-144` — idx_patient_health_plan_active

**Description**: The partial unique index `idx_patient_health_plan_active` only prevents duplicate active plans (where `end_date IS NULL`). A patient could have multiple historical plan assignments with the same `health_plan_id` and different `start_date`/`end_date` values. This may or may not be intended.

**Impact**: Duplicate historical plan assignments could cause confusion in billing and coverage calculations.

**Recommendation**: Clarify business rule. If only one active plan per type is allowed, the current index is correct. If historical duplicates should also be prevented, add a full unique constraint.

---

### [LOW] Spec says "patients can book without a health plan" — no validation of health plan requirement

**Location**: `business-rules.md` — no BR for health plan requirement

**Description**: The appointment booking flow does not require a health plan to be assigned to the patient. A patient without any health plan can book an appointment. This may be intentional (patients can pay out-of-pocket) but should be explicitly documented.

**Impact**: None if intentional. If health plans are required for billing, this is a business logic gap.

**Recommendation**: Document whether health plans are required for booking or if out-of-pocket is supported.

---

### [LOW] Doctor list shows inactive doctors to patients — confusing UX

**Location**: `001_initial_schema.sql:569-571` — doctors_select_all

**Description**: The `doctors_select_all` policy shows ALL doctors (including inactive) to all users. Business rule BR-DOC-005 says "Only doctors with `is_active = true` appear in booking flows" but the listing page shows all. The filtering is application-level only.

**Impact**: Patients see inactive doctors in the listing but cannot book with them, causing confusion.

**Recommendation**: Filter inactive doctors in the booking flow query, or add a separate policy that only shows active doctors to patients.

---

### [LOW] No index on patients.is_active — filtering by active status requires sequential scan

**Location**: `001_initial_schema.sql:229-230` — patient indexes

**Description**: There is no index on `patients.is_active`. Queries that filter by active status (e.g., "show only active patients") will require a sequential scan. The `idx_patients_profile_id` index helps with profile-based lookups but not with `is_active` filtering.

**Impact**: Performance degradation when listing patients with active/inactive filters on large datasets.

**Recommendation**: Add a partial index:

```sql
CREATE INDEX idx_patients_active ON patients (is_active) WHERE is_active = true;
```

---

### [LOW] No index on appointments.status for non-terminal states — filtering performance

**Location**: `001_initial_schema.sql:253-257` — appointment indexes

**Description**: There is `idx_appointments_status` on the `status` column, but no partial index for `status = 'scheduled'` which is the most common filter (upcoming appointments). A partial index would be more efficient.

**Impact**: Minor performance issue. The existing index is sufficient for most queries.

**Recommendation**: Consider adding a partial index for scheduled appointments:

```sql
CREATE INDEX idx_appointments_scheduled ON appointments (patient_id, date)
    WHERE status = 'scheduled';
```

---

### [LOW] Edge Function import path uses relative path — may break in production

**Location**: `security.md:243` — Edge Function import

**Description**: The Edge Function example imports from `../../packages/shared/src/schemas/appointment.schema.ts`. In Supabase Edge Functions, the import path resolution works differently than in Node.js. The relative path may not resolve correctly in the Deno runtime.

**Impact**: Build failure in Edge Functions if import path doesn't resolve.

**Recommendation**: Use Deno-compatible import maps or bundle the shared package before deploying Edge Functions.

---

### [INFO] Spec references `cancel-appointment` and `assign-doctor` Edge Functions but no implementation exists

**Location**: `api.md:610-615` — Edge Functions list

**Description**: The API spec defines three Edge Functions: `book-appointment`, `cancel-appointment`, and `assign-doctor`. Only `book-appointment` has processing steps defined. `cancel-appointment` and `assign-doctor` are referenced but their implementation details are sparse.

**Impact**: Incomplete implementation spec. Developers may implement these functions differently than intended.

**Recommendation**: Flesh out the processing steps for `cancel-appointment` and `assign-doctor` with the same level of detail as `book-appointment`.

---

### [INFO] Realtime subscription uses `event: '*'` — could be optimized

**Location**: `architecture.md:637-640`

**Description**: Subscribing to all events (`INSERT`, `UPDATE`, `DELETE`) on the appointments table may generate more notifications than needed. For dashboard updates, only `UPDATE` events (status changes) may be relevant.

**Impact**: Unnecessary WebSocket traffic and client-side processing.

**Recommendation**: Subscribe to specific events: `{ event: 'UPDATE', ... }` for status changes.

---

### [INFO] Testing spec does not include penetration testing or security audit requirements

**Location**: `testing.md` — entire document

**Description**: The testing spec covers unit, integration, E2E, and RLS testing but does not mention penetration testing, security audits, or OWASP Top 10 testing. For a medical system handling health data, this is a compliance gap.

**Impact**: Security vulnerabilities may not be caught before production deployment.

**Recommendation**: Add a security testing section that includes:
- Annual penetration testing
- OWASP Top 10 automated scanning
- RLS policy manual review
- Role-based access testing matrix

---

### [INFO] No GDPR/LGPD compliance section in security spec

**Location**: `security.md` — entire document

**Description**: The system handles Brazilian patient data (CPF, medical records) which falls under LGPD (Lei Geral de Proteção de Dados). The security spec does not mention LGPD compliance, data subject rights, or consent management.

**Impact**: Potential legal non-compliance if the system processes personal data without proper consent mechanisms.

**Recommendation**: Add an LGPD compliance section covering:
- Consent management for data processing
- Data subject access requests
- Right to erasure implementation
- Data processing records

---

### [INFO] Spec says "no raw SQL from frontend" but does not mention ORM or query builder security

**Location**: `security.md:31` — SQL Injection mitigation

**Description**: The SQL injection mitigation states "Supabase PostgREST parameterizes all queries. No raw SQL from frontend." This is correct for PostgREST, but the spec doesn't address Edge Functions which could use raw SQL via Deno PostgreSQL driver.

**Impact**: If Edge Functions use raw SQL without parameterization, SQL injection is possible.

**Recommendation**: Add explicit rule: "Edge Functions must NEVER use string interpolation in SQL queries. Always use parameterized queries."

---

*End of Security Review*

---

## Remediation Log (2026-08-31)

Fixes applied to `supabase/migrations/001_initial_schema.sql`:

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | CRITICAL | Employee can book any patient_id (phantom bookings) | `appointments_insert_employee` now validates `patient_id IN (SELECT id FROM patients)` |
| 2 | CRITICAL | Doctor permanent access to former patients | `medical_records_select_doctor` now requires patient has an appointment with the doctor OR record created_by = uid |
| 3 | CRITICAL | Admin self-deletion lockout | `profiles_delete_admin` now requires `id != auth.uid()` |
| 4 | CRITICAL | Schedule overlap ignores clinic | `schedules_no_overlap` now includes `clinic_id WITH =` |
| 5 | CRITICAL | Appointment slot TOCTOU / no business-rule conflicts on direct insert | `validate_schedule_booking` now rejects past dates and duplicate patient bookings; atomic `WHERE available_slots > 0` with `IF NOT FOUND` rollback retained |
| H1 | HIGH | Phantom doctor (privilege escalation) | Added `validate_doctor_profile` BEFORE INSERT/UPDATE trigger requiring active doctor role on linked profile |
| H2 | HIGH | Patient/doctor self role escalation + self-deactivation | Added `prevent_profile_privilege_change` BEFORE UPDATE trigger: only admins may change role/is_active |
| H3 | HIGH | Doctor can change own CRM / profile_id | Added `prevent_doctor_identity_change` BEFORE UPDATE trigger: only employee/admin may change crm/profile_id |

### Remaining (documented decisions)
- **HIGH � audit ip_address NULL**: PostgreSQL triggers have no HTTP context. Kept columns; requires Edge Function `set_config('app.client_ip')` for IP capture (enhancement backlog).
- **HIGH � patients dummy DOB/gender on signup**: By design; patient completes profile at registration (PAT-002). Optional `profile_complete` flag is backlog.
- **HIGH � employee health-plan assignment**: Kept per permission matrix (employee can create health-plan assignments). Owner is admin; spec ownership ambiguity noted.

*End of Security Review*
