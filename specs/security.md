# Security Specification — Sistema Clínica Médica

## 1. Threat Model

### 1.1 Assets to Protect

| Asset | Sensitivity | Impact of Breach |
|-------|-------------|------------------|
| Patient medical records | **Critical** | HIPD violation, legal liability, patient harm |
| Patient personal data (CPF, PII) | **Critical** | Identity theft, legal liability |
| Health plan data | **High** | Financial fraud |
| Doctor CRM numbers | **Medium** | Credential fraud |
| Appointment data | **Medium** | Privacy breach |
| System configuration | **High** | System compromise |
| Audit logs | **High** | Tampering hides attacks |

### 1.2 Threat Actors

| Actor | Motivation | Capability |
|-------|------------|------------|
| **Malicious patient** | Access other patients' data, create fraudulent appointments | Low (authenticated user) |
| **Disgruntled employee** | Modify records, access unauthorized data | Medium (internal access) |
| **Compromised account** | Lateral movement, data exfiltration | Variable |
| **Automated bot** | Credential stuffing, DDoS | High volume, low sophistication |
| **Insider threat (admin abuse)** | Unauthorized data access/modification | High (full access) |

### 1.3 Attack Vectors & Mitigations

| Vector | Risk | Mitigation |
|--------|------|------------|
| **SQL Injection** | High | Supabase PostgREST parameterizes all queries. No raw SQL from frontend. |
| **XSS (Stored)** | High | Vue templates auto-escape. No `v-html` on user content. CSP headers on Vercel. |
| **XSS (Reflected)** | Medium | No user input reflected in HTML without escaping. |
| **CSRF** | Medium | Supabase uses JWT in Authorization header (not cookies for API). SameSite cookies for auth. |
| **IDOR** | High | RLS policies enforce row-level access. No direct ID guessing possible. |
| **Privilege Escalation** | Critical | RLS + frontend guards. Role checked at DB level. |
| **Session Hijacking** | High | JWT short-lived (1h). Refresh tokens in httpOnly cookies. HTTPS only. |
| **Brute Force** | Medium | Rate limiting on auth endpoints. Account lockout after 5 failures. |
| **Data Exfiltration** | High | RLS limits visible data. Pagination limits response size. Audit logs track access. |
| **Man-in-the-Middle** | Medium | HTTPS enforced. HSTS headers. |
| **Denial of Service** | Medium | Supabase platform DDoS protection. Rate limiting on API. |
| **Insider Threat** | High | Audit logging on all sensitive operations. Admin actions logged. |

## 2. Authentication Security

### 2.1 Password Requirements

Enforced via Zod schema + Supabase Auth:

| Rule | Validation |
|------|------------|
| Minimum length | 8 characters |
| Maximum length | 128 characters |
| Required characters | At least 1 uppercase, 1 lowercase, 1 number |
| Forbidden patterns | No common passwords (checked against Supabase's list) |
| Hashing | bcrypt (Supabase default, cost factor 10) |

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

| Parameter | Value |
|-----------|-------|
| Access token lifetime | 1 hour |
| Refresh token lifetime | 7 days |
| Token format | Supabase JWT (HS256) |
| Claims | `sub` (user_id), `role`, `email`, `exp`, `iat` |
| Storage (access) | In-memory (Pinia) |
| Storage (refresh) | httpOnly cookie (Supabase default) |

### 2.3 Session Management

- **Concurrent sessions**: Allowed (multiple devices).
- **Session invalidation on password change**: Yes (Supabase invalidates all refresh tokens).
- **Session invalidation on logout**: Yes (Supabase removes refresh token).
- **Remember me**: Not implemented (refresh token handles persistence).

### 2.4 Account Lockout

```
Failed Login Attempts:
  Attempt 1-4: Normal response (invalid credentials)
  Attempt 5: Account locked for 15 minutes
  Attempt 6+: Account locked for 30 minutes
  After 10 failures: Account locked until admin unlock
```

**Implementation**: Via Supabase's `auth.rate_limit` configuration + Edge Function for tracking.

### 2.5 Email Verification

- **Required**: Yes. New accounts must verify email before login.
- **Resend limit**: 3 per hour.
- **Link expiry**: 24 hours.

## 3. Authorization Model

### 3.1 RBAC Enforcement Points

```
Request Flow:

  Browser → Frontend Router Guard (check role in Pinia store)
       → supabase-js (attaches JWT in Authorization header)
            → PostgREST (validates JWT signature)
                → RLS Policy (checks role from JWT, filters rows)
                    → Table Data (only matching rows returned)
```

**Critical**: Frontend guards are UX convenience only. RLS is the security boundary.

### 3.2 Role Definitions

| Role | Description | JWT Claim |
|------|-------------|-----------|
| `patient` | Self-service patient | `role: 'patient'` |
| `employee` | Clinic staff (receptionist, admin assistant) | `role: 'employee'` |
| `doctor` | Medical professional | `role: 'doctor'` |
| `admin` | System administrator | `role: 'admin'` |

### 3.3 Role Assignment

- **patient**: Assigned on self-registration (default).
- **employee**: Assigned by admin only.
- **doctor**: Assigned by admin only.
- **admin**: Assigned by existing admin only.

### 3.4 Role Changes

- Role changes require admin access.
- Role changes are audit logged.
- Frontend re-validates role after any profile change.
- JWT role is embedded at login time; changes take effect on next login.

## 4. RLS Strategy

### 4.1 Principles

1. **Every table has RLS enabled** — no exceptions.
2. **Default deny** — no access unless a policy explicitly grants it.
3. **Policies use `auth.uid()` and `auth.user_role()`** — never client-supplied values.
4. **`SECURITY DEFINER` functions** run with owner privileges, bypassing RLS.
5. **Nested queries in RLS** use `EXISTS` or `IN` with subqueries (PostgreSQL optimizes these).

### 4.2 RLS Policy Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Own data** | User can only access their own rows | Patient reads own appointments |
| **Role-based** | Role grants access to all/filtered rows | Employee reads all patients |
| **Relationship-based** | Access based on data relationships | Doctor reads patients via appointments |
| **Functional** | RLS checks computed functions | `auth.user_role()`, `auth.user_patient_id()` |

### 4.3 RLS Testing Strategy

Every RLS policy must be tested with:

1. **Positive test**: Authorized user can access expected data.
2. **Negative test**: Unauthorized user cannot access the data.
3. **Cross-role test**: User with role A cannot see role B's restricted data.
4. **Edge case**: User with no profile, deleted user, deactivated user.

### 4.4 RLS Performance Considerations

- RLS policies execute **per query**. Complex subqueries can degrade performance.
- Use `SECURITY DEFINER` helper functions (marked `STABLE`) to cache role lookups.
- Index columns used in RLS policies.
- Avoid `SELECT *` in RLS subqueries.

### 4.5 Policy Audit

Quarterly review of all RLS policies:
- Verify no table lacks RLS.
- Verify no policy is overly permissive.
- Test with Supabase's SQL editor using `SET ROLE` to simulate different users.

## 5. Input Validation Strategy

### 5.1 Validation Layers

```
Layer 1: HTML5 attributes (required, type="email", pattern)
    │ UX convenience only — easily bypassed
    ▼
Layer 2: Zod schema validation (packages/shared)
    │ Primary validation — runs on submit
    ▼
Layer 3: Supabase PostgREST type checking
    │ Database column types enforce basic constraints
    ▼
Layer 4: PostgreSQL CHECK constraints + triggers
    │ Database-level validation (most authoritative)
    ▼
Layer 5: RLS policies
    │ Access control validation
```

### 5.2 Zod Schema Coverage

Every user-facing input form has a corresponding Zod schema:

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

### 5.3 Specific Validations

| Field | Validation | Error Message |
|-------|------------|---------------|
| CPF | `\d{3}\.\d{3}\.\d{3}-\d{2}` + mod-11 checksum | "CPF inválido" |
| Email | RFC 5322 format | "Email inválido" |
| CRM | Alphanumeric, 4-10 chars | "CRM inválido" |
| Date | `YYYY-MM-DD` format, not in past (for scheduling) | "Data não pode ser no passado" |
| Time | `HH:MM` format, start < end | "Horário de início deve ser anterior ao fim" |
| Phone | Optional, `\d{10,11}` | "Telefone inválido" |
| CEP | `\d{8}` | "CEP inválido" |
| Blood Type | One of enum values | "Tipo sanguíneo inválido" |
| Name | 2-200 chars, no special chars except accented | "Nome deve ter entre 2 e 200 caracteres" |

### 5.4 Server-Side Validation

Edge Functions validate input using the same Zod schemas from the shared package:

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

  // ... business logic with parsed.data
});
```

## 6. Output Sanitization

### 6.1 Frontend Output

- **Vue templates**: Auto-escape by default. `{{ variable }}` escapes HTML entities.
- **No `v-html`**: Prohibited on any user-generated content. ESLint rule `no-v-html`.
- **Dynamic attributes**: Use `:href` only with validated URLs. Never with user input.
- **Error messages**: Server messages displayed as-is only if they contain no HTML. Otherwise, map to safe strings.

### 6.2 API Output

- **Supabase PostgREST**: Returns JSON. No HTML rendering.
- **Edge Functions**: Return JSON only.
- **Headers**: `Content-Type: application/json`. Never `text/html`.

### 6.3 Content Security Policy (CSP)

```html
<!-- index.html meta tag -->
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

## 7. CSRF/XSS Prevention

### 7.1 CSRF Prevention

| Mechanism | Implementation |
|-----------|----------------|
| **JWT in Authorization header** | Supabase uses `Authorization: Bearer <token>`. Not sent cross-origin. |
| **SameSite cookies** | Refresh tokens in `SameSite=Lax` cookies. |
| **CORS** | Supabase configured to allow only frontend origin. |
| **No form-based submissions** | All mutations via `fetch()` with JSON body. |

### 7.2 XSS Prevention

| Mechanism | Implementation |
|-----------|----------------|
| **Vue template escaping** | Default behavior. `{{ }}` escapes HTML. |
| **No `v-html`** | ESLint rule enforced. |
| **CSP headers** | See section 6.3. |
| **HttpOnly cookies** | Refresh tokens not accessible via JavaScript. |
| **Input validation** | Zod schemas reject `<script>` tags in text fields. |

### 7.3 XSS Prevention Checklist

- [ ] No `v-html` directive on user content
- [ ] No `innerHTML` assignments
- [ ] No `document.write()` calls
- [ ] No `eval()` usage
- [ ] No `new Function()` usage
- [ ] All dynamic URLs validated against allowlist
- [ ] JSON responses only (no HTML error pages)
- [ ] CSP headers configured

## 8. IDOR Prevention

### 8.1 Strategy

**Primary defense**: RLS policies ensure users can only query data they own.

**Secondary defense**: Edge Functions validate `auth.uid()` matches the resource owner before mutation.

### 8.2 Example: Appointment Access

```sql
-- Patient tries to access another patient's appointment
-- RLS policy checks:
-- appointments.patient_id IN (SELECT id FROM patients WHERE profile_id = auth.uid())
-- Returns: only rows where patient_id matches the requesting user's patient record
```

### 8.3 IDOR Test Cases

| Test | Method | Expected |
|------|--------|----------|
| Patient A tries to view Patient B's appointment | `GET /rest/v1/appointments?id=eq.{B's-appointment}` | Empty result (RLS filters) |
| Patient A tries to update Patient B's appointment | `PATCH /rest/v1/appointments?id=eq.{B's-appointment}` | 403 Forbidden |
| Doctor tries to view non-patient's records | `GET /rest/v1/medical_records?patient_id=eq.{non-patient}` | Empty result |
| Employee tries to view audit logs | `GET /rest/v1/audit_logs` | 403 Forbidden (no RLS policy) |

### 8.4 UUID Usage

All primary keys are UUIDs (not sequential integers), making guessing infeasible.

## 9. Rate Limiting

### 9.1 Supabase Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/v1/signup` | 30 requests | per hour per IP |
| `/auth/v1/token` (login) | 30 requests | per hour per IP |
| `/auth/v1/resetPassword` | 5 requests | per hour per email |
| `/rest/v1/*` (API) | 100 requests | per second per user |
| `/functions/v1/*` | 50 requests | per minute per user |

### 9.2 Custom Rate Limiting (Edge Functions)

For business-critical operations:

```typescript
// Rate limit key: `${user_id}:${action}`
// Stored in Supabase KV or Redis (if available)
const RATE_LIMITS = {
  'book-appointment': { max: 5, windowMs: 60_000 },     // 5 per minute
  'cancel-appointment': { max: 10, windowMs: 60_000 },  // 10 per minute
  'update-medical-record': { max: 20, windowMs: 60_000 }, // 20 per minute
};
```

### 9.3 Rate Limit Response

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "retry_after_seconds": 30
}
```

**HTTP Status**: 429 Too Many Requests

## 10. Secrets Management

### 10.1 Secrets Inventory

| Secret | Location | Access |
|--------|----------|--------|
| Supabase URL | `.env` / Vercel env vars | Frontend (public) |
| Supabase Anon Key | `.env` / Vercel env vars | Frontend (public, RLS-protected) |
| Supabase Service Role Key | `.env` / Vercel env vars | **Server-side only** (Edge Functions) |
| JWT Secret | Supabase managed | Internal |
| Database Password | Supabase dashboard | Admin only |

### 10.2 Rules

1. **Never commit secrets** to git. `.env` in `.gitignore`.
2. **Anon key is safe** for frontend — RLS protects data.
3. **Service role key** bypasses RLS — never expose to frontend.
4. **Rotate secrets** quarterly or on suspected compromise.
5. **Use Vercel env vars** for production (not `.env` files).
6. **Local development**: Use `.env.local` (gitignored).

### 10.3 .env.example

```env
# Supabase
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ...

# App
VITE_APP_URL=http://localhost:5173
```

## 11. Audit Logging

### 11.1 What Gets Logged

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| User login | Supabase Auth | user_id, IP, timestamp, success/failure |
| User logout | Frontend | user_id, timestamp |
| Profile update | Trigger | user_id, old_data, new_data, timestamp |
| Appointment created | Edge Function | patient_id, doctor_id, timestamp |
| Appointment cancelled | Edge Function | patient_id, reason, timestamp |
| Medical record created | Trigger | doctor_id, patient_id, timestamp |
| Medical record modified | Trigger | old_data, new_data, timestamp |
| Role change | Edge Function | admin_id, target_user, old_role, new_role |
| Account deactivation | Edge Function | admin_id, target_user, timestamp |

### 11.2 Audit Log Integrity

- Audit logs are append-only (no UPDATE or DELETE policies).
- `created_at` is auto-generated, cannot be modified.
- Log entry ID is UUID (non-guessable).
- Log entries cannot be deleted by any user (no DELETE policy, even for admins).

### 11.3 Audit Log Access

- **Admin**: Can read all audit logs via `/admin/audit` page.
- **No other role** can access audit logs.
- **No role** can modify or delete audit logs.

### 11.4 Log Retention

| Log Type | Retention |
|----------|-----------|
| Audit logs | Indefinite (never deleted) |
| Supabase Auth logs | 30 days (platform default) |
| Edge Function logs | 7 days (Supabase default) |
| Frontend errors | Not logged to server (console only) |

## 12. Error Handling Security

### 12.1 Principles

1. **Never expose internal errors** to the user.
2. **Never expose stack traces** in production.
3. **Never reveal whether an entity exists** (e.g., "user not found" vs "invalid credentials").
4. **Log errors server-side** with full context. Display safe messages to user.

### 12.2 Error Response Format

```typescript
// Safe for client
interface ClientError {
  error: string;      // Machine-readable code
  message: string;    // Human-readable, safe message
}

// Examples:
{ error: "INVALID_CREDENTIALS", message: "Email ou senha inválidos." }
{ error: "VALIDATION_ERROR", message: "Dados inválidos. Verifique os campos." }
{ error: "CONFLICT", message: "Este horário não está mais disponível." }
{ error: "FORBIDDEN", message: "Você não tem permissão para esta ação." }
{ error: "NOT_FOUND", message: "Recurso não encontrado." }
{ error: "RATE_LIMIT", message: "Muitas requisições. Tente novamente mais tarde." }
{ error: "INTERNAL_ERROR", message: "Erro interno. Tente novamente." }
```

### 12.3 Forbidden Error Unification

Both "resource not found" and "access denied" return the same generic response to prevent information leakage:

```typescript
// If user doesn't have access AND resource doesn't exist → same response
// Prevents attacker from distinguishing "exists but forbidden" from "doesn't exist"
```

## 13. Data Classification

| Classification | Data | Protection |
|----------------|------|------------|
| **Critical** | Medical records, diagnoses, prescriptions | RLS, audit, encryption at rest |
| **Critical** | CPF, patient PII | RLS, audit, input validation, no logging |
| **High** | Health plan data | RLS, audit |
| **High** | Audit logs | Append-only, admin-only access |
| **Medium** | Appointment data | RLS, basic audit |
| **Medium** | Doctor CRM, professional data | RLS |
| **Low** | Specialty names, clinic addresses | Public read |
| **Low** | System configuration | Admin-only |

### 13.1 Data at Rest

- Supabase encrypts all data at rest (AES-256).
- Database backups encrypted.
- No sensitive data in localStorage (only JWT in memory + refresh in httpOnly cookie).

### 13.2 Data in Transit

- TLS 1.3 for all connections.
- HSTS enforced.
- No mixed content.

### 13.3 Data Minimization

- Only collect data necessary for clinic operations.
- No unnecessary PII in logs.
- CPF validated but not displayed in full (mask in UI: `***.456.789-**`).

### 13.4 Right to Erasure

- Patient can request data deletion (admin processes).
- Admin deactivates account (soft delete).
- Hard delete only by Supabase admin with backup consideration.
- Audit logs preserved even after account deletion (user_id set to NULL via ON DELETE SET NULL).
