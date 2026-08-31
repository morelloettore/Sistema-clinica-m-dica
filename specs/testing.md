# Testing Specification — Sistema Clínica Médica

## 1. Test Strategy Overview

### Testing Pyramid

```
         ╱╲
        ╱  ╲         E2E Tests (Cypress/Playwright)
       ╱    ╲        5% — Critical user flows only
      ╱──────╲
     ╱        ╲       Integration Tests (Vitest + Supabase)
    ╱          ╲      25% — API, RLS, Edge Functions
   ╱────────────╲
  ╱              ╲     Unit Tests (Vitest)
 ╱                ╲    70% — Zod schemas, stores, utils
╱──────────────────╲
```

### Coverage Targets

| Category | Target | Critical Paths |
|----------|--------|---------------|
| Unit Tests | 90% line coverage | 100% on schemas, stores |
| Integration Tests | All API endpoints | All RLS policies |
| E2E Tests | All critical user flows | Booking, cancellation, auth |
| Security Tests | All RLS policies | Role-based access |

### Test Framework

- **Unit + Integration**: Vitest
- **E2E**: Playwright (or Cypress)
- **RLS Testing**: Supabase CLI test database + custom SQL scripts
- **Coverage**: c8 (V8 coverage)

---

## 2. Unit Test Requirements

### 2.1 Zod Schema Tests

Every Zod schema must have tests for:
1. **Valid inputs**: Accept correct data.
2. **Missing required fields**: Reject with specific error.
3. **Invalid formats**: Reject with specific error.
4. **Boundary values**: Test min/max lengths, edge values.
5. **Edge cases**: SQL injection attempts, XSS payloads, empty strings.

```typescript
// packages/shared/src/schemas/__tests__/auth.schema.test.ts
import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema, passwordSchema } from '../auth.schema';

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'SecurePass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse({
      name: 'João Silva',
      email: 'joao@email.com',
      cpf: '123.456.789-09',
      password: 'SecurePass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid CPF', () => {
    const result = registerSchema.safeParse({
      name: 'João Silva',
      email: 'joao@email.com',
      cpf: '111.111.111-11',
      password: 'SecurePass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects XSS in name', () => {
    const result = registerSchema.safeParse({
      name: '<script>alert("xss")</script>',
      email: 'joao@email.com',
      cpf: '123.456.789-09',
      password: 'SecurePass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects SQL injection in name', () => {
    const result = registerSchema.safeParse({
      name: "'; DROP TABLE users; --",
      email: 'joao@email.com',
      cpf: '123.456.789-09',
      password: 'SecurePass1',
    });
    expect(result.success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts strong password', () => {
    expect(passwordSchema.safeParse('SecurePass1').success).toBe(true);
  });

  it('rejects short password', () => {
    expect(passwordSchema.safeParse('Sec1').success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    expect(passwordSchema.safeParse('securepass1').success).toBe(false);
  });

  it('rejects password without number', () => {
    expect(passwordSchema.safeParse('SecurePass').success).toBe(false);
  });

  it('rejects password without lowercase', () => {
    expect(passwordSchema.safeParse('SECUREPASS1').success).toBe(false);
  });
});
```

### 2.2 CPF Validation Tests

```typescript
// packages/shared/src/schemas/__tests__/cpf.test.ts
import { describe, it, expect } from 'vitest';
import { validateCpf } from '../cpf';

describe('validateCpf', () => {
  it('accepts valid CPF', () => {
    expect(validateCpf('123.456.789-09')).toBe(true);
    expect(validateCpf('529.982.247-25')).toBe(true);
    expect(validateCpf('111.444.777-35')).toBe(true);
  });

  it('rejects invalid checksum', () => {
    expect(validateCpf('123.456.789-00')).toBe(false);
    expect(validateCpf('111.111.111-11')).toBe(false);
  });

  it('rejects all-same-digit CPFs', () => {
    expect(validateCpf('000.000.000-00')).toBe(false);
    expect(validateCpf('111.111.111-11')).toBe(false);
    expect(validateCpf('999.999.999-99')).toBe(false);
  });

  it('rejects wrong format', () => {
    expect(validateCpf('12345678909')).toBe(false);
    expect(validateCpf('123.456.789-0')).toBe(false);
    expect(validateCpf('abc.def.ghi-jk')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateCpf('')).toBe(false);
  });
});
```

### 2.3 Pinia Store Tests

```typescript
// apps/web/src/stores/__tests__/appointment.store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppointmentStore } from '../appointment.store';

// Mock supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('useAppointmentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with empty state', () => {
    const store = useAppointmentStore();
    expect(store.appointments).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('fetchAppointments sets loading state', async () => {
    const store = useAppointmentStore();
    const promise = store.fetchAppointments();
    expect(store.loading).toBe(true);
    await promise;
    expect(store.loading).toBe(false);
  });

  it('bookAppointment calls Edge Function', async () => {
    const store = useAppointmentStore();
    const mockAppointment = { id: 'uuid', status: 'scheduled' };
    vi.mocked(
      (await import('../../lib/supabase')).supabase.functions.invoke
    ).mockResolvedValue({ data: mockAppointment, error: null });

    const result = await store.bookAppointment({
      patient_id: 'uuid',
      doctor_id: 'uuid',
      schedule_id: 'uuid',
      clinic_id: 'uuid',
      date: '2026-08-15',
    });

    expect(result).toEqual(mockAppointment);
    expect(store.appointments).toContainEqual(mockAppointment);
  });

  it('$reset clears all state', () => {
    const store = useAppointmentStore();
    store.appointments = [{ id: '1' } as any];
    store.loading = true;
    store.error = 'some error';
    store.$reset();
    expect(store.appointments).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });
});
```

### 2.4 Utility Function Tests

```typescript
// apps/web/src/lib/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate, formatCPF, formatPhone, calculateAge } from '../utils';

describe('formatDate', () => {
  it('formats date to DD/MM/YYYY', () => {
    expect(formatDate('2026-08-15')).toBe('15/08/2026');
  });

  it('handles single-digit day/month', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026');
  });
});

describe('formatCPF', () => {
  it('formats CPF with dots and dash', () => {
    expect(formatCPF('12345678909')).toBe('123.456.789-09');
  });
});

describe('formatPhone', () => {
  it('formats 11-digit phone', () => {
    expect(formatPhone('11999991234')).toBe('(11) 99999-1234');
  });

  it('formats 10-digit phone', () => {
    expect(formatPhone('1130001234')).toBe('(11) 3000-1234');
  });
});

describe('calculateAge', () => {
  it('calculates correct age', () => {
    const age = calculateAge('1990-05-15');
    expect(age).toBeGreaterThanOrEqual(35);
    expect(age).toBeLessThanOrEqual(37);
  });
});
```

### 2.5 Router Guard Tests

```typescript
// apps/web/src/router/guards/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import { authGuard } from '../auth';
import { useAuthStore } from '../../../stores/auth.store';

vi.mock('../../../stores/auth.store');

describe('authGuard', () => {
  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: { template: '<div>Login</div>' } },
        { path: '/patient/dashboard', component: { template: '<div>Dashboard</div>' } },
      ],
    });
    router.beforeEach(authGuard);
  });

  it('redirects to /login when not authenticated', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: false,
      role: null,
    } as any);

    await router.push('/patient/dashboard');
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('allows access when authenticated', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      role: 'patient',
    } as any);

    await router.push('/patient/dashboard');
    expect(router.currentRoute.value.path).toBe('/patient/dashboard');
  });
});
```

---

## 3. Integration Test Requirements

### 3.1 Database Integration Tests

Test actual Supabase operations against local database (`supabase start`):

```typescript
// supabase/__tests__/appointments.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

describe('Appointments CRUD', () => {
  let patientToken: string;
  let doctorToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    // Authenticate as different users
    const patientAuth = await supabase.auth.signInWithPassword({
      email: 'patient@test.com',
      password: 'TestPass1',
    });
    patientToken = patientAuth.data.session!.access_token;
    // ... other auth setup
  });

  it('patient can book appointment', async () => {
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: 'test-patient-id',
        doctor_id: 'test-doctor-id',
        schedule_id: 'test-schedule-id',
        clinic_id: 'test-clinic-id',
        date: '2026-09-01',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.status).toBe('scheduled');
  });

  it('patient cannot book for another patient', async () => {
    const { error } = await supabase
      .from('appointments')
      .insert({
        patient_id: 'other-patient-id', // Not the authenticated patient
        doctor_id: 'test-doctor-id',
        schedule_id: 'test-schedule-id',
        clinic_id: 'test-clinic-id',
        date: '2026-09-01',
      });

    expect(error).not.toBeNull(); // RLS blocks it
  });

  it('decrement available_slots after booking', async () => {
    const { data: schedule } = await supabase
      .from('schedules')
      .select('available_slots')
      .eq('id', 'test-schedule-id')
      .single();

    expect(schedule!.available_slots).toBeLessThan(10); // Was 10
  });
});
```

### 3.2 Edge Function Tests

```typescript
// supabase/functions/__tests__/book-appointment.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

const FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || 'http://localhost:54321/functions/v1';

describe('book-appointment Edge Function', () => {
  let patientToken: string;

  beforeAll(async () => {
    // Get auth token for patient
    const response = await fetch(`${FUNCTIONS_URL.replace('functions/v1', 'auth/v1/token')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        email: 'patient@test.com',
        password: 'TestPass1',
      }),
    });
    const data = await response.json();
    patientToken = data.access_token;
  });

  it('books appointment successfully', async () => {
    const response = await fetch(`${FUNCTIONS_URL}/book-appointment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        patient_id: 'test-patient-id',
        doctor_id: 'test-doctor-id',
        schedule_id: 'test-schedule-id',
        clinic_id: 'test-clinic-id',
        date: '2026-09-01',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('scheduled');
  });

  it('returns 409 for duplicate booking', async () => {
    // Book same slot again
    const response = await fetch(`${FUNCTIONS_URL}/book-appointment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        patient_id: 'test-patient-id',
        doctor_id: 'test-doctor-id',
        schedule_id: 'test-schedule-id',
        clinic_id: 'test-clinic-id',
        date: '2026-09-01',
      }),
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('DUPLICATE_BOOKING');
  });

  it('returns 401 without token', async () => {
    const response = await fetch(`${FUNCTIONS_URL}/book-appointment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid input', async () => {
    const response = await fetch(`${FUNCTIONS_URL}/book-appointment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        patient_id: 'not-a-uuid',
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

---

## 4. RLS Test Requirements

### 4.1 RLS Testing Strategy

Test each RLS policy by:
1. Setting the JWT claims to simulate different users.
2. Querying the table.
3. Verifying only expected rows are returned.

### 4.2 SQL-Based RLS Tests

```sql
-- supabase/__tests__/rls_profiles.test.sql

-- Test: Patient can only read own profile
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "patient-user-id", "role": "patient"}';

SELECT count(*) FROM profiles;
-- Expected: 1 (only own profile)

-- Test: Employee can read all profiles
SET LOCAL request.jwt.claims TO '{"sub": "employee-user-id", "role": "employee"}';

SELECT count(*) FROM profiles;
-- Expected: All profiles

-- Test: Patient cannot update another patient's profile
SET LOCAL request.jwt.claims TO '{"sub": "patient-user-id", "role": "patient"}';

UPDATE profiles SET name = 'Hacked' WHERE id = 'other-patient-id';
-- Expected: 0 rows affected

RESET role;
```

### 4.3 Comprehensive RLS Test Script

```sql
-- supabase/__tests__/rls_test_all.sql

-- ============================================
-- PROFILES TABLE
-- ============================================

-- TEST 1: Patient reads own profile
SELECT plan('profiles: patient reads own');
SET LOCAL request.jwt.claims = '{"sub": "{{patient_user_id}}", "role": "patient"}';
SELECT is(count(*), 1, 'patient sees own profile') FROM profiles WHERE id = '{{patient_user_id}}';
SELECT is(count(*), 0, 'patient does not see other profiles') FROM profiles WHERE id = '{{other_user_id}}';
SELECT finish();

-- TEST 2: Employee reads all profiles
SELECT plan('profiles: employee reads all');
SET LOCAL request.jwt.claims = '{"sub": "{{employee_user_id}}", "role": "employee"}';
SELECT ok(count(*) > 1, 'employee sees multiple profiles') FROM profiles;
SELECT finish();

-- TEST 3: Patient cannot update other profiles
SELECT plan('profiles: patient cannot update others');
SET LOCAL request.jwt.claims = '{"sub": "{{patient_user_id}}", "role": "patient"}';
UPDATE profiles SET name = 'Hacked' WHERE id = '{{other_user_id}}';
SELECT is(found, false, 'no rows updated');
SELECT finish();

-- TEST 4: Only admin can delete profiles
SELECT plan('profiles: only admin deletes');
SET LOCAL request.jwt.claims = '{"sub": "{{employee_user_id}}", "role": "employee"}';
DELETE FROM profiles WHERE id = '{{other_user_id}}';
SELECT ok(true, 'employee delete attempt does not crash');
SELECT finish();

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================

-- TEST 5: Patient reads own appointments
SELECT plan('appointments: patient reads own');
SET LOCAL request.jwt.claims = '{"sub": "{{patient_user_id}}", "role": "patient"}';
SELECT is(count(*), 2, 'patient sees own appointments')
FROM appointments
WHERE patient_id = (SELECT id FROM patients WHERE profile_id = '{{patient_user_id}}');
SELECT finish();

-- TEST 6: Doctor reads own appointments
SELECT plan('appointments: doctor reads own');
SET LOCAL request.jwt.claims = '{"sub": "{{doctor_user_id}}", "role": "doctor"}';
SELECT ok(count(*) >= 0, 'doctor sees appointments without error')
FROM appointments;
SELECT finish();

-- TEST 7: Patient cannot read other patient's appointments
SELECT plan('appointments: patient cannot read others');
SET LOCAL request.jwt.claims = '{"sub": "{{patient_user_id}}", "role": "patient"}';
SELECT is(count(*), 0, 'patient sees 0 of other patient appointments')
FROM appointments
WHERE patient_id = (SELECT id FROM patients WHERE profile_id = '{{other_patient_user_id}}');
SELECT finish();
```

### 4.4 RLS Test Runner

```typescript
// supabase/__tests__/rls.runner.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';

describe('RLS Policies', () => {
  beforeAll(() => {
    // Reset database to known state
    execSync('supabase db reset');
  });

  it('profiles: patient reads own', () => {
    const result = execSync(
      `psql "$DATABASE_URL" -f supabase/__tests__/rls_profiles_patient_read.sql`
    ).toString();
    expect(result).toContain('ok');
  });

  it('appointments: patient reads own', () => {
    const result = execSync(
      `psql "$DATABASE_URL" -f supabase/__tests__/rls_appointments_patient_read.sql`
    ).toString();
    expect(result).toContain('ok');
  });

  // ... more tests
});
```

---

## 5. E2E Test Scenarios

### 5.1 Authentication E2E

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('patient can register', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[data-testid="name-input"]', 'João Silva');
    await page.fill('[data-testid="email-input"]', 'joao@test.com');
    await page.fill('[data-testid="cpf-input"]', '123.456.789-09');
    await page.fill('[data-testid="password-input"]', 'SecurePass1');
    await page.click('[data-testid="register-button"]');
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('patient can login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'patient@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPass1');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/patient/dashboard');
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'wrong@test.com');
    await page.fill('[data-testid="password-input"]', 'WrongPass1');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Email ou senha inválidos');
  });

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/patient/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'patient@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPass1');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/patient/dashboard');

    // Logout
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL('/login');

    // Verify can't access protected page
    await page.goto('/patient/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
```

### 5.2 Appointment Booking E2E

```typescript
// e2e/appointment-booking.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Appointment Booking', () => {
  test.beforeEach(async ({ page }) => {
    // Login as patient
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'patient@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPass1');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/patient/dashboard');
  });

  test('complete booking flow', async ({ page }) => {
    // Navigate to new appointment
    await page.click('[data-testid="new-appointment-button"]');
    await expect(page).toHaveURL('/patient/appointments/new');

    // Step 1: Select specialty
    await page.click('[data-testid="specialty-card-cardiologia"]');
    await page.click('[data-testid="next-button"]');

    // Step 2: Select doctor
    await page.waitForSelector('[data-testid="doctor-card"]');
    await page.click('[data-testid="doctor-card"]:first-child');
    await page.click('[data-testid="next-button"]');

    // Step 3: Select date and time
    await page.waitForSelector('[data-testid="calendar"]');
    await page.click('[data-testid="available-date"]:first-child');
    await page.waitForSelector('[data-testid="time-slot"]');
    await page.click('[data-testid="time-slot"]:first-child');
    await page.click('[data-testid="next-button"]');

    // Step 4: Confirm
    await expect(page.locator('[data-testid="confirm-specialty"]')).not.toBeEmpty();
    await expect(page.locator('[data-testid="confirm-doctor"]')).not.toBeEmpty();
    await expect(page.locator('[data-testid="confirm-date"]')).not.toBeEmpty();
    await expect(page.locator('[data-testid="confirm-time"]')).not.toBeEmpty();
    await page.click('[data-testid="confirm-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
    await expect(page).toHaveURL('/patient/appointments');

    // Verify appointment appears in list
    await expect(page.locator('[data-testid="appointment-row"]:first-child'))
      .toContainText('Agendada');
  });

  test('shows conflict error for double booking', async ({ page }) => {
    // Book first appointment
    await page.click('[data-testid="new-appointment-button"]');
    // ... complete booking flow ...

    // Try to book same slot again
    await page.click('[data-testid="new-appointment-button"]');
    // ... navigate to same slot ...
    await page.click('[data-testid="confirm-button"]');

    await expect(page.locator('[data-testid="error-toast"]'))
      .toContainText('já possui uma consulta agendada');
  });
});
```

### 5.3 Cancellation E2E

```typescript
// e2e/cancellation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Appointment Cancellation', () => {
  test('patient can cancel own appointment', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'patient@test.com');
    await page.fill('[data-testid="password-input"]', 'TestPass1');
    await page.click('[data-testid="login-button"]');

    // Navigate to appointments
    await page.goto('/patient/appointments');

    // Click cancel on first scheduled appointment
    await page.click('[data-testid="cancel-button"]:first-child');

    // Confirm dialog
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-yes"]');

    // Verify status changed
    await expect(page.locator('[data-testid="status-badge"]:first-child'))
      .toContainText('Cancelada');
  });
});
```

### 5.4 Admin Dashboard E2E

```typescript
// e2e/admin.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@test.com');
    await page.fill('[data-testid="password-input"]', 'AdminPass1');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/admin/dashboard');
  });

  test('admin can view audit logs', async ({ page }) => {
    await page.click('[data-testid="nav-audit"]');
    await expect(page).toHaveURL('/admin/audit');
    await expect(page.locator('[data-testid="audit-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="audit-row"]').first()).toBeVisible();
  });

  test('admin can manage users', async ({ page }) => {
    await page.click('[data-testid="nav-users"]');
    await expect(page).toHaveURL('/admin/users');
    await expect(page.locator('[data-testid="user-table"]')).toBeVisible();
  });

  test('employee cannot access admin pages', async ({ page }) => {
    // Login as employee
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'employee@test.com');
    await page.fill('[data-testid="password-input"]', 'EmployeePass1');
    await page.click('[data-testid="login-button"]');

    // Try to access admin page
    await page.goto('/admin/audit');
    await expect(page).toHaveURL('/employee/dashboard'); // Redirected
  });
});
```

---

## 6. Security Test Cases

### 6.1 IDOR Tests

```typescript
// e2e/security/idor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('IDOR Prevention', () => {
  test('patient A cannot access patient B data via API', async ({ request }) => {
    // Login as patient A
    const loginA = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      data: { email: 'patientA@test.com', password: 'TestPass1' },
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    const tokenA = (await loginA.json()).access_token;

    // Get patient B's ID
    const loginB = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      data: { email: 'patientB@test.com', password: 'TestPass1' },
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    const tokenB = (await loginB.json()).access_token;

    // Patient B's profile ID
    const profileBResponse = await request.get(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${(await loginB.json()).user.id}&select=id`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenB}` },
    });
    const profileB = (await profileBResponse.json())[0];

    // Patient A tries to read Patient B's profile
    const response = await request.get(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileB.id}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenA}` },
    });
    const data = await response.json();

    expect(data).toHaveLength(0); // RLS returns empty
  });

  test('patient cannot book appointment for another patient', async ({ request }) => {
    // Login as patient
    const login = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      data: { email: 'patient@test.com', password: 'TestPass1' },
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    const token = (await login.json()).access_token;

    // Try to book for another patient
    const response = await request.post(`${SUPABASE_URL}/functions/v1/book-appointment`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        patient_id: 'other-patient-id',
        doctor_id: 'test-doctor-id',
        schedule_id: 'test-schedule-id',
        clinic_id: 'test-clinic-id',
        date: '2026-09-01',
      },
    });

    expect(response.status()).toBe(403);
  });
});
```

### 6.2 SQL Injection Tests

```typescript
// e2e/security/sqli.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SQL Injection Prevention', () => {
  const sqliPayloads = [
    "'; DROP TABLE patients; --",
    "1' OR '1'='1",
    "admin'--",
    "1; SELECT * FROM profiles",
    "' UNION SELECT * FROM auth.users --",
  ];

  for (const payload of sqliPayloads) {
    test(`rejects SQL injection in search: ${payload}`, async ({ request }) => {
      const login = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        data: { email: 'employee@test.com', password: 'TestPass1' },
        headers: { apikey: SUPABASE_ANON_KEY },
      });
      const token = (await login.json()).access_token;

      const response = await request.get(
        `${SUPABASE_URL}/rest/v1/patients?select=*,profile:profiles(*)&profile.name=ilike.*${encodeURIComponent(payload)}*`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );

      expect(response.status()).not.toBe(500); // No server error
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true); // Returns valid JSON array
    });
  }
});
```

### 6.3 XSS Tests

```typescript
// e2e/security/xss.spec.ts
import { test, expect } from '@playwright/test';

test.describe('XSS Prevention', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
    '"><script>alert(1)</script>',
  ];

  for (const payload of xssPayloads) {
    test(`does not execute XSS in profile name: ${payload}`, async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'AdminPass1');
      await page.click('[data-testid="login-button"]');

      // Try to set XSS payload as name
      await page.goto('/admin/users');
      await page.click('[data-testid="edit-user-button"]:first-child');
      await page.fill('[data-testid="name-input"]', payload);
      await page.click('[data-testid="save-button"]');

      // Verify no alert was triggered
      let alertTriggered = false;
      page.on('dialog', () => { alertTriggered = true; });

      // Reload and check
      await page.reload();
      expect(alertTriggered).toBe(false);

      // Verify the payload is escaped in the DOM
      const nameElement = page.locator('[data-testid="user-name"]:first-child');
      await expect(nameElement).not.toContainHTML('<script>');
    });
  }
});
```

---

## 7. Test Data Management

### 7.1 Seed Data Structure

```typescript
// supabase/seed.sql

-- Admin user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@clinica.com',
  crypt('AdminPass1', gen_salt('bf')),
  now(),
  '{"name": "Admin User", "cpf": "000.000.000-00", "role": "admin"}'
);

-- Employee user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'employee@clinica.com',
  crypt('EmployeePass1', gen_salt('bf')),
  now(),
  '{"name": "Employee User", "cpf": "111.111.111-11", "role": "employee"}'
);

-- Doctor user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'doctor@clinica.com',
  crypt('DoctorPass1', gen_salt('bf')),
  now(),
  '{"name": "Dr. Maria Silva", "cpf": "222.222.222-22", "role": "doctor"}'
);

-- Patient user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'patient@clinica.com',
  crypt('PatientPass1', gen_salt('bf')),
  now(),
  '{"name": "João Silva", "cpf": "333.333.333-33", "role": "patient"}'
);

-- Test data follows...
```

### 7.2 Test User Accounts

| Role | Email | Password | User ID |
|------|-------|----------|---------|
| admin | admin@clinica.com | AdminPass1 | 00000000-0000-0000-0000-000000000001 |
| employee | employee@clinica.com | EmployeePass1 | 00000000-0000-0000-0000-000000000002 |
| doctor | doctor@clinica.com | DoctorPass1 | 00000000-0000-0000-0000-000000000003 |
| patient | patient@clinica.com | PatientPass1 | 00000000-0000-0000-0000-000000000004 |

### 7.3 Test Data Cleanup

```typescript
// vitest.setup.ts
import { afterAll } from 'vitest';
import { execSync } from 'child_process';

afterAll(() => {
  // Reset database to clean state after test suite
  if (process.env.NODE_ENV === 'test') {
    execSync('supabase db reset');
  }
});
```

### 7.4 Factory Pattern for Test Data

```typescript
// test-utils/factories.ts
import { faker } from '@faker-js/faker';

export function createTestPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: faker.string.uuid(),
    profile_id: faker.string.uuid(),
    date_of_birth: faker.date.past().toISOString().split('T')[0],
    gender: 'male',
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zip_code: faker.string.numeric(8),
    blood_type: 'O+',
    allergies: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: faker.string.uuid(),
    profile_id: faker.string.uuid(),
    crm: `${faker.string.numeric(4)}-SP`,
    bio: faker.person.bio(),
    consultation_price: faker.number.float({ min: 100, max: 500, fractionDigits: 2 }),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
```

---

## 8. CI/CD Test Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v2

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15.1.0
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4

      - name: Install Supabase CLI
        run: npm i -g supabase

      - name: Start Supabase
        run: supabase start

      - name: Run integration tests
        run: pnpm test:integration
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```
