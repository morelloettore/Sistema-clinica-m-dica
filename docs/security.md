# Security Documentation — Sistema Clínica Médica

> Authoritative security reference for the medical clinic management system.
> Covers threat model, authentication, authorization, RLS, validation, and all defensive layers.

---

## 1. Threat Model

### 1.1 Assets to Protect

| Asset | Classification | Breach Impact |
|-------|---------------|---------------|
| Patient medical records (diagnoses, prescriptions, notes) | **Critical** | HIPD violation, patient harm, legal liability |
| Patient PII (CPF, name, DOB, address, phone) | **Critical** | Identity theft, LGPD violation, legal liability |
| Patient health plan data | **High** | Financial fraud, insurance abuse |
| Audit logs | **High** | Tampering hides attacks, compliance failure |
| System configuration / secrets | **High** | Full system compromise |
| Doctor CRM numbers, professional data | **Medium** | Credential fraud |
| Appointment data (who, when, why) | **Medium** | Privacy breach, stalking |
| Specialty/clinic reference data | **Low** | Minimal impact |

### 1.2 Threat Actors

| Actor | Motivation | Capability | Trust Level |
|-------|------------|------------|-------------|
| Malicious patient | Access other patients' data, fraudulent appointments | Low (authenticated user) | Partial — own data only |
| Disgruntled employee | Modify records, access unauthorized data | Medium (internal access) | Trusted — operational data |
| Compromised account | Lateral movement, data exfiltration | Variable (depends on role) | Depends on compromised role |
| Automated bot | Credential stuffing, DDoS, scraping | High volume, low sophistication | Untrusted |
| Insider admin abuse | Unauthorized data access/modification | High (full access) | Fully trusted — abuse of power |
| External attacker | RCE, data exfiltration, ransomware | Variable (script kiddie to APT) | Untrusted |

### 1.3 Attack Vectors & Mitigations

| Vector | Risk Level | Primary Mitigation | Secondary Mitigation |
|--------|-----------|-------------------|---------------------|
| **SQL Injection** | High | Supabase PostgREST parameterizes all queries; no raw SQL from frontend | Zod input validation rejects SQL-like patterns |
| **XSS (Stored)** | High | Vue templates auto-escape (`{{ }}`); no `v-html` on user content | CSP headers block inline scripts |
| **XSS (Reflected)** | Medium | No user input reflected in HTML without escaping | CSP headers, input validation |
| **CSRF** | Medium | JWT sent in `Authorization` header (not cookies for API calls) | `SameSite=Lax` on refresh token cookie; CORS restricts origins |
| **IDOR / BOLA** | High | RLS policies enforce row-level access at database level | Edge Functions verify `auth.uid()` ownership before mutations |
| **Privilege Escalation** | Critical | RLS checks `auth.user_role()` from JWT; role embedded at login time | Frontend route guards (UX only, not security); role changes require admin |
| **Session Hijacking** | High | Access token 1h lifetime; refresh token in httpOnly cookie | HTTPS only; HSTS headers; no localStorage for tokens |
| **Brute Force** | Medium | Supabase rate limiting (30 req/hr on auth endpoints) | Account lockout: 5 failures → 15min, 10 → admin unlock |
| **Data Exfiltration** | High | RLS limits visible data per role; pagination caps response size | Audit logs track all sensitive access |
| **Man-in-the-Middle** | Medium | TLS 1.3 enforced; HSTS headers | No mixed content; certificate pinning via Supabase |
| **Denial of Service** | Medium | Supabase platform DDoS protection | Rate limiting on API (100 req/s/user) and Edge Functions (50 req/min/user) |
| **Insider Threat** | High | Audit logging on all sensitive tables | Admin actions logged; no role can delete audit logs |

### 1.4 STRIDE Analysis per Component

| Component | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | Elevation |
|-----------|----------|-----------|-------------|----------------|-----|-----------|
| **Auth (Supabase Auth)** | Password + JWT validation | bcrypt hashing (cost 10) | Login/logout logged | Tokens short-lived; httpOnly cookies | Rate limiting | Role locked in JWT |
| **Frontend (Vue)** | Route guards (UX only) | No `v-html`; CSP headers | Console logs (dev only) | Selective data display | N/A (static SPA) | Route guards prevent UI access |
| **RLS Policies** | `auth.uid()` from JWT (cryptographic) | PostgreSQL enforces | N/A | Row-level filtering | Complex policies can degrade perf | `auth.user_role()` prevents escalation |
| **Edge Functions** | JWT validated by PostgREST | Input validation via Zod | Business logic logged | Minimal response data | Rate limiting per user | `auth.uid()` checked before mutation |
| **Database (PostgreSQL)** | RLS + parameterized queries | CHECK constraints + triggers | Audit triggers on sensitive tables | Column-level access via RLS | Connection pooling (Supabase) | Role-based RLS policies |
| **Audit Logs** | Append-only (no UPDATE/DELETE) | Append-only | Logs themselves immutable | Admin-only read access | Indexing for query perf | No user can modify |

---

## 2. Authentication Security

### 2.1 Password Requirements

| Rule | Value | Enforcement |
|------|-------|-------------|
| Minimum length | 8 characters | Zod schema + Supabase Auth |
| Maximum length | 128 characters | Zod schema |
| Uppercase required | At least 1 | Zod regex `/[A-Z]/` |
| Lowercase required | At least 1 | Zod regex `/[a-z]/` |
| Number required | At least 1 | Zod regex `/[0-9]/` |
| Common passwords | Rejected | Supabase built-in list |
| Hashing algorithm | bcrypt, cost factor 10 | Supabase default |

```typescript
// packages/shared/src/schemas/auth.schema.ts
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');
```

### 2.2 JWT Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Access token lifetime | 1 hour | Limits window for stolen token abuse |
| Refresh token lifetime | 7 days | Balances UX with security |
| Token format | Supabase JWT (HS256) | Standard, verified by PostgREST |
| Claims | `sub` (user_id), `role`, `email`, `exp`, `iat` | Minimal necessary claims |
| Access token storage | In-memory (Pinia) | Lost on page refresh; refresh renews |
| Refresh token storage | httpOnly cookie | Not accessible via JavaScript |

### 2.3 Session Management

| Rule | Behavior |
|------|----------|
| Concurrent sessions | Allowed (multiple devices) |
| Invalidation on password change | Yes — Supabase invalidates all refresh tokens |
| Invalidation on logout | Yes — Supabase removes refresh token |
| Token rotation | Supabase rotates refresh token on each use |
| Remember me | Not implemented — refresh token handles persistence |

### 2.4 Account Lockout Policy

```
Failed Login Attempts:
  Attempt 1-4:   Normal response ("invalid credentials")
  Attempt 5:     Account locked for 15 minutes
  Attempt 6-9:   Account locked for 30 minutes
  Attempt 10+:   Account locked until admin unlock
```

**Implementation**: Supabase `auth.rate_limit` + Edge Function tracking failed attempts.

**Lockout response** (does NOT reveal lockout status to attacker):
```json
{ "error": "INVALID_CREDENTIALS", "message": "Email ou senha inválidos." }
```

### 2.5 Email Verification Flow

1. User registers → Supabase sends verification email
2. User clicks link → email verified → account activated
3. **Unverified accounts cannot log in**
4. Resend limit: 3 per hour
5. Link expiry: 24 hours

### 2.6 Password Reset Flow

1. User requests reset → Supabase sends reset email (5 req/hr limit)
2. User clicks link → enters new password → password updated
3. All existing sessions invalidated (refresh tokens revoked)
4. Audit log entry created for password change

### 2.7 Service Role Key — NEVER in Frontend

| Key | Frontend | Edge Functions | Rationale |
|-----|----------|----------------|-----------|
| `VITE_SUPABASE_ANON_KEY` | ✅ Safe (RLS-protected) | ✅ Available | Public by design; RLS enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ NEVER | ✅ Required | Bypasses ALL RLS; if leaked = full DB access |

---

## 3. Authorization Model (RBAC Matrix)

### 3.1 Enforcement Points

```
Request → Frontend Router Guard (UX convenience)
       → supabase-js (attaches JWT in Authorization header)
         → PostgREST (validates JWT signature + claims)
           → RLS Policy (filters rows by role + ownership)
             → Table Data (only matching rows returned)
```

**Critical rule**: Frontend guards are UX convenience ONLY. RLS is the security boundary.

### 3.2 Role Definitions

| Role | Description | JWT Claim | Default on Registration |
|------|-------------|-----------|------------------------|
| `patient` | Self-service patient | `role: 'patient'` | Yes (default) |
| `employee` | Clinic staff (receptionist, admin assistant) | `role: 'employee'` | No — admin only |
| `doctor` | Medical professional | `role: 'doctor'` | No — admin only |
| `admin` | System administrator | `role: 'admin'` | No — existing admin only |

### 3.3 Complete RBAC Permission Matrix

#### profiles

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT own | ✅ | ✅ | ✅ | ✅ |
| SELECT others | ❌ | ✅ (all) | ❌ | ✅ (all) |
| UPDATE own (name, phone only) | ✅ | ✅ | ✅ | ✅ |
| UPDATE others | ❌ | ✅ (limited fields) | ❌ | ✅ (all fields, incl. role) |
| INSERT | ❌ (trigger creates) | ❌ | ❌ | ❌ (trigger creates) |
| DELETE (deactivate) | ❌ | ❌ | ❌ | ✅ |

**Note**: Patients/employees/doctors cannot change their own `role` field. Only admin can modify roles.

#### patients

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT own | ✅ | ✅ | ✅ (via appointments) | ✅ (all) |
| SELECT others | ❌ | ✅ (all) | ✅ (assigned only) | ✅ (all) |
| UPDATE own | ✅ | ✅ | ❌ | ✅ (all) |
| INSERT | ❌ | ✅ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |

**Doctor access note**: Doctors can only see patients who have appointments with them.

#### doctors

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT active | ✅ | ✅ | ✅ | ✅ (all) |
| SELECT inactive | ❌ | ❌ | ❌ | ✅ |
| INSERT | ❌ | ❌ | ❌ | ✅ |
| UPDATE own profile | N/A | N/A | ✅ | ✅ |
| UPDATE others | ❌ | ✅ (scheduling) | ❌ | ✅ |
| DELETE (deactivate) | ❌ | ❌ | ❌ | ✅ |

#### specialties

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT | ✅ (all) | ✅ (all) | ✅ (all) | ✅ (all) |
| INSERT | ❌ | ❌ | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |

#### clinics

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT | ✅ (all) | ✅ (all) | ✅ (all) | ✅ (all) |
| INSERT | ❌ | ❌ | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |

#### health_plans

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT | ✅ (all) | ✅ (all) | ✅ (all) | ✅ (all) |
| INSERT | ❌ | ✅ | ❌ | ✅ |
| UPDATE | ❌ | ✅ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |

#### patient_health_plans

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT own | ✅ | ✅ (all) | ❌ | ✅ (all) |
| INSERT | ❌ | ✅ | ❌ | ✅ |
| UPDATE | ❌ | ✅ | ❌ | ✅ |
| DELETE | ❌ | ✅ | ❌ | ✅ |

#### schedules

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT (active) | ✅ | ✅ | ✅ | ✅ (all) |
| SELECT (inactive) | ❌ | ✅ | ❌ | ✅ |
| INSERT | ❌ | ✅ | ❌ | ✅ |
| UPDATE | ❌ | ✅ | ❌ | ✅ |
| DELETE | ❌ | ✅ | ❌ | ✅ |

#### appointments

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT own | ✅ | ✅ (all) | ✅ (own) | ✅ (all) |
| SELECT others | ❌ | ✅ (all) | ❌ | ✅ (all) |
| INSERT (own) | ✅ (own patient_id) | ✅ (any) | ❌ | ✅ |
| UPDATE (cancel/complete) | ✅ (own) | ✅ (any) | ✅ (own) | ✅ (any) |
| DELETE | ❌ | ❌ | ❌ | ✅ |

#### medical_records

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT own | ✅ (non-deleted) | ✅ (all non-deleted) | ✅ (own records) | ✅ (all) |
| INSERT | ❌ | ❌ | ✅ (own doctor_id) | ❌ (via doctor) |
| UPDATE | ❌ | ❌ | ✅ (own records) | ✅ |
| DELETE (soft) | ❌ | ❌ | ❌ | ✅ |

#### audit_logs

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| SELECT | ❌ | ❌ | ❌ | ✅ (read only) |
| INSERT | ❌ | ❌ | ❌ | ❌ (trigger only) |
| UPDATE | ❌ | ❌ | ❌ | ❌ (append-only) |
| DELETE | ❌ | ❌ | ❌ | ❌ (append-only) |

### 3.4 Role Assignment Rules

| Action | Who Can Do It | Audit Logged |
|--------|--------------|--------------|
| Assign `patient` | Self-registration (default) | Yes |
| Assign `employee` | Admin only | Yes |
| Assign `doctor` | Admin only | Yes |
| Assign `admin` | Existing admin only | Yes |
| Change any role | Admin only | Yes |
| Deactivate account | Admin only | Yes |

### 3.5 JWT Role Lifecycle

1. Role is embedded in JWT at login time
2. Role changes take effect on **next login** (not immediately)
3. Frontend re-validates role after any profile change
4. RLS uses `auth.user_role()` which reads from `profiles` table (not JWT claim) for real-time accuracy

---

## 4. RLS Strategy

### 4.1 Why RLS Is the Primary Defense

| Defense Layer | Trust Level | Failure Mode |
|---------------|-------------|--------------|
| Frontend route guards | **Low** — UX only, easily bypassed | Hidden UI, but API accessible |
| Edge Function validation | **Medium** — server-side, but can be misconfigured | Business logic bypass |
| **RLS policies** | **High** — enforced by PostgreSQL, cannot be bypassed by client | Only bypassed by `service_role` or `SECURITY DEFINER` |
| Database constraints | **High** — CHECK constraints reject invalid data | Data integrity maintained |

**Rule**: Never rely on frontend guards for security. RLS is the single source of truth.

### 4.2 Helper Functions (SECURITY DEFINER)

```sql
-- Get current user's role from profiles table (not JWT claim)
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's patient_id (for patients)
CREATE OR REPLACE FUNCTION auth.user_patient_id()
RETURNS UUID AS $$
  SELECT id FROM patients WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's doctor_id (for doctors)
CREATE OR REPLACE FUNCTION auth.user_doctor_id()
RETURNS UUID AS $$
  SELECT id FROM doctors WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**Why `SECURITY DEFINER`**: These functions run with owner privileges, bypassing RLS on the `profiles` table. Without this, a patient couldn't call `auth.user_role()` because RLS would filter their own profile read. The function is marked `STABLE` for query plan caching.

### 4.3 RLS Enabled on ALL Tables

```sql
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_health_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_specialties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_clinics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;
```

### 4.4 Why `USING(true)` Is Dangerous

```sql
-- DANGEROUS: Grants SELECT to ALL authenticated users, no filtering
CREATE POLICY "bad_policy" ON medical_records
  FOR SELECT USING (true);

-- SAFE: Only grants access to users who own the data
CREATE POLICY "good_policy" ON medical_records
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
  );
```

**Tables where `USING(true)` is acceptable** (public reference data):
- `specialties` — names only, no sensitive data
- `clinics` — name, address, phone (public business info)
- `health_plans` — plan names, prices (public pricing)
- `doctor_specialties` — junction table (public mapping)
- `doctor_clinics` — junction table (public mapping)

**Tables where `USING(true)` is NEVER acceptable**:
- `profiles` — contains PII
- `patients` — contains medical/personal data
- `medical_records` — contains diagnoses, prescriptions
- `appointments` — contains visit information
- `audit_logs` — contains access records
- `patient_health_plans` — contains insurance data
- `schedules` — partially (filtered by `is_active` at minimum)

### 4.5 RLS Policy Summary per Table

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | own + employee/admin all | trigger only | own + employee + admin | admin only |
| patients | own + employee/admin all + doctor assigned | employee/admin | own + employee/admin | admin only |
| doctors | everyone reads active | admin only | own + employee + admin | admin only |
| specialties | everyone | admin only | admin only | admin only |
| clinics | everyone | admin only | admin only | admin only |
| health_plans | everyone | employee/admin | employee/admin | admin only |
| patient_health_plans | own + employee/admin | employee/admin | employee/admin | employee/admin |
| doctor_specialties | everyone | admin only | N/A | admin only |
| doctor_clinics | everyone | admin only | N/A | admin only |
| schedules | active only | employee/admin | employee/admin | employee/admin |
| appointments | own/own/employee/admin | own(patient) + employee | own + doctor + employee/admin | admin only |
| medical_records | non-deleted, role-filtered | doctor only | doctor own + admin | admin only (soft) |
| audit_logs | admin only | trigger only | NEVER | NEVER |

### 4.6 RLS Performance Guidelines

1. Use `SECURITY DEFINER` helper functions (marked `STABLE`) to cache role lookups
2. Index columns used in RLS policies (already done in migration 014)
3. Avoid `SELECT *` in RLS subqueries — select only needed columns
4. Use `EXISTS` / `IN` with subqueries (PostgreSQL optimizes these)
5. Complex policies execute per-query — monitor with `EXPLAIN ANALYZE`

### 4.7 RLS Testing Strategy

Every RLS policy must be tested with:

1. **Positive test**: Authorized user can access expected data
2. **Negative test**: Unauthorized user gets empty result or 403
3. **Cross-role test**: Patient cannot see doctor-only data, etc.
4. **Edge case**: User with no profile, deactivated user, deleted user
5. **Simulation**: Use `SET ROLE` in Supabase SQL Editor to test as different users

```sql
-- Test as patient
SET LOCAL role = 'authenticated';
SET request.jwt.claims = '{"sub": "<patient-uuid>", "role": "authenticated"}';
SELECT * FROM medical_records; -- Should only see own records
RESET role;
```

### 4.8 Quarterly RLS Audit Checklist

- [ ] No table lacks RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] No policy is overly permissive (`USING(true)` on sensitive tables)
- [ ] All helper functions are `SECURITY DEFINER STABLE`
- [ ] Test with `SET ROLE` simulation
- [ ] Review for new tables added since last audit

---

## 5. Input Validation

### 5.1 Validation Layers (Defense in Depth)

```
Layer 1: HTML5 attributes (required, type="email", pattern)
    → UX convenience only, easily bypassed

Layer 2: Zod schema validation (packages/shared)
    → Primary validation, runs on submit

Layer 3: Supabase PostgREST type checking
    → Database column types enforce basic constraints

Layer 4: PostgreSQL CHECK constraints + triggers
    → Database-level validation (most authoritative)

Layer 5: RLS policies
    → Access control validation
```

### 5.2 Zod Schema Coverage

| Form | Schema | Location |
|------|--------|----------|
| Login | `loginSchema` | `auth.schema.ts` |
| Register | `registerSchema` | `auth.schema.ts` |
| Patient Form | `patientSchema` | `patient.schema.ts` |
| Doctor Form | `doctorSchema` | `doctor.schema.ts` |
| Appointment Form | `bookAppointmentSchema` | `appointment.schema.ts` |
| Health Plan Form | `healthPlanSchema` | `health-plan.schema.ts` |
| Medical Record Form | `medicalRecordSchema` | `medical-record.schema.ts` |
| Schedule Form | `scheduleSchema` | `schedule.schema.ts` |
| Pagination | `paginationSchema` | `pagination.schema.ts` |

### 5.3 Specific Field Validations

| Field | Validation Rule | Error Message |
|-------|----------------|---------------|
| CPF | `\d{3}\.\d{3}\.\d{3}-\d{2}` + mod-11 checksum | "CPF inválido" |
| Email | RFC 5322 format | "Email inválido" |
| CRM | Alphanumeric, 4-10 chars | "CRM inválido" |
| Date | `YYYY-MM-DD` format; not in past (for scheduling) | "Data não pode ser no passado" |
| Time | `HH:MM` format; start < end | "Horário de início deve ser anterior ao fim" |
| Phone | Optional; `\d{10,11}` | "Telefone inválido" |
| CEP | `\d{8}` | "CEP inválido" |
| Blood Type | One of enum values | "Tipo sanguíneo inválido" |
| Name | 2-200 chars, accented chars allowed | "Nome deve ter entre 2 e 200 caracteres" |
| Password | min 8, uppercase, lowercase, number | See §2.1 |

### 5.4 CPF Validation Algorithm

```typescript
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/[^\d]/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // all same digits

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(cleaned[10]);
}
```

### 5.5 Server-Side Validation

Edge Functions validate input using the **same Zod schemas** from the shared package:

```typescript
// supabase/functions/book-appointment/index.ts
import { bookAppointmentSchema } from '../../packages/shared/src/schemas/appointment.schema.ts';

Deno.serve(async (req) => {
  const body = await req.json();
  const parsed = bookAppointmentSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'VALIDATION_ERROR', message: parsed.error.message }),
      { status: 400 }
    );
  }

  // ... business logic with parsed.data (fully validated)
});
```

### 5.6 SQL Injection Prevention

| Layer | Protection |
|-------|-----------|
| PostgREST | All queries parameterized; no raw SQL from client |
| Frontend | `supabase-js` generates parameterized queries |
| Edge Functions | Use `supabase-js` client, not raw SQL |
| Database | CHECK constraints reject malformed data |

**Rule**: Never construct SQL strings from user input. Always use `supabase-js` query builder or parameterized queries.

---

## 6. Output Sanitization

### 6.1 Frontend Output Rules

| Rule | Implementation |
|------|---------------|
| Vue auto-escaping | `{{ variable }}` escapes HTML entities by default |
| No `v-html` | ESLint rule `no-v-html` enforced; prohibited on user content |
| No `innerHTML` | ESLint rule enforced |
| No `document.write()` | ESLint rule enforced |
| No `eval()` | ESLint rule enforced |
| Dynamic URLs | Only `:href` with validated URLs; never user input |
| Error messages | Server messages displayed only if no HTML; otherwise mapped to safe strings |

### 6.2 API Output Rules

| Rule | Implementation |
|------|---------------|
| JSON only | `Content-Type: application/json` always |
| No HTML errors | Never return HTML error pages |
| Select specific columns | Never `SELECT *` in Edge Functions |
| Minimal data | Return only fields needed for the UI |
| No sensitive data in errors | Never expose stack traces, SQL errors, or internal IDs |

### 6.3 Column Selection Examples

```typescript
// GOOD: Select only needed columns
const { data } = await supabase
  .from('patients')
  .select('id, profiles(name, email), date_of_birth, gender');

// BAD: Returns all columns including sensitive data
const { data } = await supabase
  .from('patients')
  .select('*');
```

### 6.4 Medical Records Output Restrictions

| Role | Visible Fields | Hidden Fields |
|------|---------------|---------------|
| Patient | diagnosis, notes, prescription, next_appointment_date | created_by (doctor identity visible via join) |
| Doctor | All fields (own records only) | — |
| Employee | diagnosis, notes, prescription | Raw doctor_id (shown as name via join) |
| Admin | All fields | — |

### 6.5 Content Security Policy (CSP)

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
           style-src 'self' 'unsafe-inline';
           img-src 'self' data: https:;
           connect-src 'self' https://*.supabase.co;
           font-src 'self' https://fonts.gstatic.com;
           frame-ancestors 'none';
           base-uri 'self';
           form-action 'self';">
```

### 6.6 Sensitive Data Masking

| Data | Display Format | Example |
|------|---------------|---------|
| CPF | `***.456.789-**` | `***.456.789-**` |
| Full phone | Not displayed to non-authorized | — |
| Medical records | Role-filtered | See §6.4 |
| Audit logs | Admin page only | — |

---

## 7. CSRF Prevention

| Mechanism | Implementation |
|-----------|----------------|
| JWT in Authorization header | `Authorization: Bearer <token>` — not sent cross-origin |
| SameSite cookies | Refresh token: `SameSite=Lax` |
| CORS | Supabase configured to allow only frontend origin |
| No form submissions | All mutations via `fetch()` with JSON body |

---

## 8. IDOR / BOLA Prevention

### 8.1 Defense Layers

| Layer | Mechanism | What It Prevents |
|-------|-----------|-----------------|
| **Primary** | RLS policies | Client cannot query data they don't own |
| **Secondary** | Edge Function ownership check | `auth.uid()` verified before mutation |
| **Tertiary** | UUID primary keys | Non-enumerable; cannot guess IDs |

### 8.2 IDOR Test Matrix

| Test | Method | Expected Result |
|------|--------|----------------|
| Patient A views Patient B's appointment | `GET /rest/v1/appointments?id=eq.{B-id}` | Empty result (RLS filters) |
| Patient A updates Patient B's appointment | `PATCH /rest/v1/appointments?id=eq.{B-id}` | 403 Forbidden |
| Doctor views non-assigned patient's records | `GET /rest/v1/medical_records?patient_id=eq.{X}` | Empty result |
| Employee views audit logs | `GET /rest/v1/audit_logs` | 403 Forbidden (no SELECT policy for employee) |
| Patient attempts to INSERT as doctor | `POST /rest/v1/medical_records` | 403 Forbidden (RLS check) |
| Unauthenticated user queries any table | `GET /rest/v1/profiles` | 401 Unauthorized |

### 8.3 UUID Usage

All primary keys are UUIDs (not sequential integers):
- `profiles.id` — UUID (references `auth.users.id`)
- `patients.id` — UUID (`gen_random_uuid()`)
- `doctors.id` — UUID (`gen_random_uuid()`)
- `appointments.id` — UUID (`gen_random_uuid()`)
- `medical_records.id` — UUID (`gen_random_uuid()`)
- `audit_logs.id` — UUID (`gen_random_uuid()`)

UUID v4 randomness (122 bits) makes enumeration infeasible: ~5.3 × 10^36 possible values.

---

## 8. Data Classification

| Classification | Data Examples | Protection Requirements |
|----------------|--------------|------------------------|
| **Critical** | Medical records, diagnoses, prescriptions | RLS + audit + encryption at rest + no logging |
| **Critical** | CPF, patient PII (name, DOB, address) | RLS + audit + input validation + no logging |
| **High** | Health plan data | RLS + audit |
| **High** | Audit logs | Append-only + admin-only access |
| **Medium** | Appointment data (who, when) | RLS + basic audit |
| **Medium** | Doctor CRM, professional data | RLS |
| **Low** | Specialty names, clinic addresses | Public read |
| **Low** | System configuration | Admin-only |

### 8.1 Data at Rest

- Supabase encrypts all data at rest (AES-256)
- Database backups encrypted
- No sensitive data in localStorage (only JWT in memory + refresh in httpOnly cookie)

### 8.2 Data in Transit

- TLS 1.3 for all connections
- HSTS enforced
- No mixed content

### 8.3 Data Minimization

- Only collect data necessary for clinic operations
- No unnecessary PII in logs
- CPF validated but not displayed in full (masked in UI)
- No medical data in console.log or error messages

### 8.4 Right to Erasure (LGPD Compliance)

- Patient can request data deletion (admin processes)
- Admin deactivates account (soft delete via `is_active = false`)
- Hard delete only by Supabase admin with backup consideration
- Audit logs preserved after account deletion (`user_id` set to NULL via `ON DELETE SET NULL`)

---

## 9. Secrets Management

### 9.1 Secrets Inventory

| Secret | Location | Access |
|--------|----------|--------|
| Supabase URL | `.env` / Vercel env vars | Frontend (public) |
| Supabase Anon Key | `.env` / Vercel env vars | Frontend (public, RLS-protected) |
| Supabase Service Role Key | `.env` / Vercel env vars | **Server-side only** (Edge Functions) |
| JWT Secret | Supabase managed | Internal |
| Database Password | Supabase dashboard | Admin only |

### 9.2 Rules

1. **Never commit secrets** to git — `.env` in `.gitignore`
2. **Anon key is safe** for frontend — RLS protects data
3. **Service role key bypasses RLS** — NEVER expose to frontend
4. **Rotate secrets** quarterly or on suspected compromise
5. **Use Vercel env vars** for production (not `.env` files)
6. **Local development**: Use `.env.local` (gitignored)

### 9.3 .env.example

```env
# Supabase
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ...

# App
VITE_APP_URL=http://localhost:5173
```

### 9.4 Edge Function Secrets

Configured via Supabase Dashboard → Edge Functions → Secrets:
- Service role key
- Any external API keys
- Database connection strings

Never hardcode secrets in Edge Function source code.

---

## 10. Audit Logging

### 10.1 What Gets Audited

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

### 10.2 What Does NOT Get Audited

| Table | Reason |
|-------|--------|
| `audit_logs` | Recursive infinite loop; append-only anyway |
| `specialties` | Low-sensitivity reference data |
| `clinics` | Low-sensitivity reference data |
| `doctor_specialties` | Junction table, low sensitivity |
| `doctor_clinics` | Junction table, low sensitivity |

### 10.3 Audit Log Format

```typescript
interface AuditLog {
  id: string;                    // UUID
  user_id: string | null;        // null = system action
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;            // e.g., 'profiles', 'appointments'
  record_id: string;             // UUID of affected record
  old_data: Record<string, unknown> | null;  // null on INSERT
  new_data: Record<string, unknown> | null;  // null on DELETE
  ip_address: string | null;     // INET format
  created_at: Date;              // auto-generated, immutable
}
```

### 10.4 Audit Log Integrity

- **Append-only**: No UPDATE or DELETE policies exist
- **Immutable**: `created_at` auto-generated, cannot be modified
- **Non-guessable**: UUID primary key
- **Preserved on deletion**: `user_id` set to NULL via `ON DELETE SET NULL`

### 10.5 Audit Log Access

| Role | Access |
|------|--------|
| Admin | Read all logs via `/admin/audit` page |
| Employee | ❌ No access |
| Doctor | ❌ No access |
| Patient | ❌ No access |
| Any role | ❌ Cannot modify or delete |

### 10.6 Audit Retention

| Log Type | Retention |
|----------|-----------|
| Audit logs | Indefinite (never deleted) |
| Supabase Auth logs | 30 days (platform default) |
| Edge Function logs | 7 days (Supabase default) |
| Frontend errors | Console only (not logged to server) |

### 10.7 Never Log

| Data | Reason |
|------|--------|
| Medical records content | HIPD/LGPD violation |
| CPF numbers | PII exposure |
| Passwords / tokens | Security breach |
| JWT tokens | Session hijacking risk |
| Full error stack traces | Information disclosure |

---

## 11. Error Handling Security

### 11.1 Principles

1. Never expose internal errors to the user
2. Never expose stack traces in production
3. Never reveal whether an entity exists ("user not found" vs "invalid credentials")
4. Log errors server-side with full context; display safe messages to user

### 11.2 Error Response Format

```typescript
interface ClientError {
  error: string;    // Machine-readable code
  message: string;  // Human-readable, safe message (Portuguese)
}
```

| Code | Message |
|------|---------|
| `INVALID_CREDENTIALS` | "Email ou senha inválidos." |
| `VALIDATION_ERROR` | "Dados inválidos. Verifique os campos." |
| `CONFLICT` | "Este horário não está mais disponível." |
| `FORBIDDEN` | "Você não tem permissão para esta ação." |
| `NOT_FOUND` | "Recurso não encontrado." |
| `RATE_LIMIT` | "Muitas requisições. Tente novamente mais tarde." |
| `INTERNAL_ERROR` | "Erro interno. Tente novamente." |

### 11.3 Forbidden/Not Found Unification

Both "resource not found" and "access denied" return the **same generic response** to prevent information leakage:

```typescript
// If user doesn't have access AND resource doesn't exist → same response
// Prevents attacker from distinguishing "exists but forbidden" from "doesn't exist"
```

---

## 12. Rate Limiting

### 12.1 Supabase Platform Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/v1/signup` | 30 requests | per hour per IP |
| `/auth/v1/token` (login) | 30 requests | per hour per IP |
| `/auth/v1/resetPassword` | 5 requests | per hour per email |
| `/rest/v1/*` (API) | 100 requests | per second per user |
| `/functions/v1/*` | 50 requests | per minute per user |

### 12.2 Custom Rate Limits (Edge Functions)

| Operation | Max Requests | Window |
|-----------|-------------|--------|
| `book-appointment` | 5 | per minute |
| `cancel-appointment` | 10 | per minute |
| `update-medical-record` | 20 | per minute |

### 12.3 Rate Limit Response

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Muitas requisições. Tente novamente mais tarde.",
  "retry_after_seconds": 30
}
```

**HTTP Status**: `429 Too Many Requests`

---

## 13. XSS Prevention Checklist

- [ ] No `v-html` directive on user content
- [ ] No `innerHTML` assignments
- [ ] No `document.write()` calls
- [ ] No `eval()` usage
- [ ] No `new Function()` usage
- [ ] All dynamic URLs validated against allowlist
- [ ] JSON responses only (no HTML error pages)
- [ ] CSP headers configured
- [ ] HttpOnly cookies for refresh tokens
- [ ] Input validation rejects `<script>` tags in text fields

---

## 14. Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | See §6.5 | Prevents XSS, data injection |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unnecessary APIs |

Configured in Vercel `_headers` file or `next.config.js` equivalent.

---

## 15. Incident Response

### 15.1 Security Incident Severity

| Severity | Description | Response Time |
|----------|-------------|---------------|
| **Critical** | Data breach, unauthorized admin access, RLS bypass | Immediate |
| **High** | Account compromise, privilege escalation attempt | 1 hour |
| **Medium** | Brute force attempt, suspicious audit log pattern | 4 hours |
| **Low** | Failed login spikes, minor policy violations | 24 hours |

### 15.2 Response Steps

1. **Identify**: Review audit logs, Supabase dashboard metrics
2. **Contain**: Revoke affected tokens, lock compromised accounts
3. **Eradicate**: Rotate secrets, patch vulnerability
4. **Recover**: Restore from backup if data corrupted
5. **Document**: Log incident details, update security docs
6. **Notify**: Report to LGPD authority if PII breach (72hr requirement)

---

## 16. Compliance Notes

### 16.1 LGPD (Lei Geral de Proteção de Dados)

- Data minimization: Only collect necessary PII
- Right to erasure: Admin can deactivate accounts
- Audit trail: All data modifications logged
- Consent: Registration implies consent for clinic operations
- Data classification: See §8

### 16.2 Medical Record Security

- Patient medical records are the highest-sensitivity data
- Access is strictly role-based (doctor → own patients only)
- Soft delete preserves data for compliance
- Audit trail on every modification
- No medical data in logs, error messages, or console output
