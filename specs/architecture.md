# Architecture Specification — Sistema Clínica Médica

## 1. System Overview

The Sistema Clínica Médica is a monorepo web application for managing medical clinic operations: patient records, appointments, doctor schedules, health plans, and administrative dashboards. Four user roles exist: **patient**, **employee**, **doctor**, **admin**.

The frontend is a Vue 3 SPA served via Vite. The backend is entirely Supabase (PostgreSQL, Auth, Edge Functions, RLS). Shared validation logic (Zod) lives in a monorepo package consumed by both frontend and Edge Functions.

```
┌──────────────────────────────────────────────────────────────┐
│                         Client (Browser)                     │
│  Vue 3 + TypeScript + Vite + Vue Router + Pinia + Tailwind  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Auth     │ │ Patient  │ │ Employee │ │ Doctor / Admin │  │
│  │ Views    │ │ Views    │ │ Views    │ │ Views          │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       │             │            │                │           │
│  ┌────▼─────────────▼────────────▼────────────────▼────────┐ │
│  │                    Pinia Stores                         │ │
│  │  authStore │ appointmentStore │ patientStore │ uiStore  │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │  supabase-js SDK                   │
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼────────────────────────────────────┐
│                       Supabase Platform                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Postgres │  │ Auth         │  │ Edge Functions (Deno)   │ │
│  │ + RLS    │  │ (JWT tokens) │  │ (complex business logic│ │
│  │          │  │              │  │  email, validation)     │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Realtime (WebSocket subscriptions)          ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

## 2. Directory Structure (Exact Paths)

```
sistema-clinica-medica/
├── apps/
│   └── web/                              # Vue 3 frontend
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── tsconfig.json
│       ├── env.d.ts
│       ├── public/
│       │   └── favicon.ico
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── env.ts                    # Runtime env validation
│           ├── router/
│           │   ├── index.ts
│           │   ├── guards/
│           │   │   ├── auth.ts
│           │   │   └── role.ts
│           │   └── routes/
│           │       ├── auth.routes.ts
│           │       ├── patient.routes.ts
│           │       ├── employee.routes.ts
│           │       ├── doctor.routes.ts
│           │       └── admin.routes.ts
│           ├── stores/
│           │   ├── auth.store.ts
│           │   ├── patient.store.ts
│           │   ├── appointment.store.ts
│           │   ├── doctor.store.ts
│           │   ├── schedule.store.ts
│           │   ├── health-plan.store.ts
│           │   ├── medical-record.store.ts
│           │   └── ui.store.ts
│           ├── composables/
│           │   ├── useSupabase.ts
│           │   ├── useToast.ts
│           │   ├── usePagination.ts
│           │   └── useConfirm.ts
│           ├── views/
│           │   ├── auth/
│           │   │   ├── LoginView.vue
│           │   │   ├── RegisterView.vue
│           │   │   └── ForgotPasswordView.vue
│           │   ├── patient/
│           │   │   ├── PatientDashboard.vue
│           │   │   ├── PatientAppointments.vue
│           │   │   ├── PatientProfile.vue
│           │   │   ├── BookAppointment.vue
│           │   │   ├── PatientHealthPlans.vue
│           │   │   └── PatientMedicalRecords.vue
│           │   ├── employee/
│           │   │   ├── EmployeeDashboard.vue
│           │   │   ├── ManageAppointments.vue
│           │   │   ├── ManagePatients.vue
│           │   │   ├── ManageDoctors.vue
│           │   │   ├── ManageSchedules.vue
│           │   │   ├── ManageHealthPlans.vue
│           │   │   └── ManageMedicalRecords.vue
│           │   ├── doctor/
│           │   │   ├── DoctorDashboard.vue
│           │   │   ├── DoctorAppointments.vue
│           │   │   ├── DoctorPatients.vue
│           │   │   └── DoctorMedicalRecords.vue
│           │   └── admin/
│           │       ├── AdminDashboard.vue
│           │       ├── ManageUsers.vue
│           │       ├── ManageSpecialties.vue
│           │       ├── ManageHealthPlans.vue
│           │       ├── ManageClinics.vue
│           │       ├── AuditLogs.vue
│           │       └── SystemSettings.vue
│           ├── components/
│           │   ├── common/
│           │   │   ├── AppHeader.vue
│           │   │   ├── AppSidebar.vue
│           │   │   ├── AppModal.vue
│           │   │   ├── AppTable.vue
│           │   │   ├── AppPagination.vue
│           │   │   ├── AppSearch.vue
│           │   │   ├── AppToast.vue
│           │   │   ├── AppConfirmDialog.vue
│           │   │   ├── AppSpinner.vue
│           │   │   └── AppEmptyState.vue
│           │   ├── forms/
│           │   │   ├── LoginForm.vue
│           │   │   ├── RegisterForm.vue
│           │   │   ├── AppointmentForm.vue
│           │   │   ├── PatientForm.vue
│           │   │   ├── DoctorForm.vue
│           │   │   ├── HealthPlanForm.vue
│           │   │   ├── MedicalRecordForm.vue
│           │   │   └── ScheduleForm.vue
│           │   └── business/
│           │       ├── AppointmentCalendar.vue
│           │       ├── TimeSlotPicker.vue
│           │       ├── DoctorSelector.vue
│           │       ├── SpecialtySelector.vue
│           │       ├── PatientSearchSelect.vue
│           │       └── StatusBadge.vue
│           ├── lib/
│           │   ├── supabase.ts           # Supabase client singleton
│           │   ├── zod.ts                # Re-exports from shared
│           │   └── constants.ts          # App-wide constants
│           ├── types/
│           │   ├── index.ts              # Re-exports from shared
│           │   └── vue.d.ts              # Vue module declarations
│           └── assets/
│               └── styles/
│                   └── main.css          # Tailwind directives
├── packages/
│   └── shared/                           # Shared Zod schemas + types
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── schemas/
│           │   ├── auth.schema.ts
│           │   ├── patient.schema.ts
│           │   ├── doctor.schema.ts
│           │   ├── appointment.schema.ts
│           │   ├── health-plan.schema.ts
│           │   ├── medical-record.schema.ts
│           │   ├── schedule.schema.ts
│           │   ├── clinic.schema.ts
│           │   ├── specialty.schema.ts
│           │   └── pagination.schema.ts
│           └── types/
│               ├── index.ts
│               ├── auth.types.ts
│               ├── patient.types.ts
│               ├── doctor.types.ts
│               ├── appointment.types.ts
│               ├── health-plan.types.ts
│               ├── medical-record.types.ts
│               ├── schedule.types.ts
│               ├── clinic.types.ts
│               ├── specialty.types.ts
│               └── common.types.ts
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   ├── migrations/
│   │   ├── 20260101000001_create_enums.sql
│   │   ├── 20260101000002_create_profiles.sql
│   │   ├── 20260101000003_create_specialties.sql
│   │   ├── 20260101000004_create_health_plans.sql
│   │   ├── 20260101000005_create_clinics.sql
│   │   ├── 20260101000006_create_doctors.sql
│   │   ├── 20260101000007_create_patients.sql
│   │   ├── 20260101000008_create_schedules.sql
│   │   ├── 20260101000009_create_appointments.sql
│   │   ├── 20260101000010_create_medical_records.sql
│   │   ├── 20260101000011_create_audit_logs.sql
│   │   ├── 20260101000012_create_rls_policies.sql
│   │   ├── 20260101000013_create_functions.sql
│   │   └── 20260101000014_create_indexes.sql
│   ├── functions/
│   │   └── book-appointment/
│   │       └── index.ts
│   └── policies/
│       ├── profiles.sql
│       ├── patients.sql
│       ├── doctors.sql
│       ├── appointments.sql
│       ├── medical_records.sql
│       ├── health_plans.sql
│       ├── schedules.sql
│       ├── specialties.sql
│       ├── clinics.sql
│       └── audit_logs.sql
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 3. Layer Responsibilities

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Presentation** | `apps/web/src/views/` + `components/` | Render UI, capture user input, display data. No business logic. |
| **State** | `apps/web/src/stores/` | Hold UI state, cache server data, orchestrate API calls. Pinia stores with actions (API calls) and getters (derived state). |
| **Shared Validation** | `packages/shared/src/schemas/` | Zod schemas shared between frontend and Supabase Edge Functions. Single source of truth for input shape. |
| **Database** | `supabase/migrations/` | PostgreSQL schema, RLS policies, triggers, functions. Enforces data integrity at the DB level. |
| **Auth** | Supabase Auth | JWT-based authentication. Email/password sign-in. Role stored in `profiles` table, appended to JWT via trigger. |
| **Edge Functions** | `supabase/functions/` | Complex multi-step business logic that cannot be expressed in a single SQL statement (appointment booking with conflict check + slot decrement + audit). |
| **RLS** | `supabase/migrations/` + `supabase/policies/` | Row-level security policies enforce authorization at the database query level. Every table is locked down. |

## 4. Data Flow Diagrams

### 4.1 Patient Books an Appointment

```
Patient clicks "Book Appointment"
        │
        ▼
BookAppointment.vue
  1. Load specialties (GET from Supabase)
  2. Patient selects specialty → load doctors for specialty
  3. Patient selects doctor → load available dates
  4. Patient selects date → load available time slots
  5. Patient confirms → calls appointmentStore.bookAppointment()
        │
        ▼
appointment.store.ts → bookAppointment(action)
  1. Validate input against Zod schema (shared package)
  2. Call Supabase Edge Function: book-appointment
        │
        ▼
Edge Function: book-appointment
  1. Verify JWT (Supabase Auth middleware)
  2. Check caller is the patient (auth.uid() == patient_id)
  3. BEGIN TRANSACTION
  4. Check slot exists and is available (SELECT FOR UPDATE)
  5. Check no conflicting appointment for patient
  6. INSERT into appointments (status = 'scheduled')
  7. UPDATE schedules SET available_slots = available_slots - 1
  8. INSERT into audit_logs
  9. COMMIT
  10. Return appointment record
        │
        ▼
appointment.store.ts
  1. Cache appointment in Pinia state
  2. Return success
        │
        ▼
BookAppointment.vue
  1. Show success toast
  2. Navigate to PatientAppointments.vue
```

### 4.2 Doctor Updates Medical Record

```
Doctor opens patient list
        │
        ▼
DoctorPatients.vue → loadPatients()
  supabase.from('medical_records').select('...').eq('doctor_id', userId)
  RLS filters: only records where doctor_id = auth.uid()
        │
        ▼
Doctor selects patient → opens DoctorMedicalRecords.vue
  Load existing records + appointment history
        │
        ▼
Doctor submits updated record → medicalRecordStore.updateRecord()
  Validate with Zod → supabase.from('medical_records').update(...)
  RLS filters: only allows update where doctor_id = auth.uid()
        │
        ▼
PostgreSQL trigger: after UPDATE on medical_records
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id)
```

### 4.3 Employee Manages Appointments

```
Employee opens ManageAppointments.vue
  Load all appointments with filters (date range, status, doctor)
  supabase.from('appointments').select('...') with RLS (employee sees all)
        │
        ▼
Employee cancels an appointment
  Validate with Zod → supabase.from('appointments').update({ status: 'cancelled' })
  RLS: employee role can update any appointment
  Trigger: auto-release schedule slot, insert audit log
```

## 5. Error Handling Strategy

### Frontend Error Categories

| Category | Handling | User Feedback |
|----------|----------|---------------|
| **Network Error** | Retry 2x with exponential backoff (1s, 2s). Then show error toast. | "Connection error. Please try again." |
| **Auth Error (401)** | Clear auth store. Redirect to `/login`. | "Session expired. Please sign in again." |
| **Authorization Error (403)** | Redirect to role-specific dashboard. | "You don't have permission for this action." |
| **Validation Error (400)** | Display field-level errors from Zod parsing. | Inline under each invalid field. |
| **Not Found (404)** | Show 404 view. | "Resource not found." |
| **Server Error (500)** | Log to console. Show generic toast. | "An unexpected error occurred. Please try again later." |
| **RLS Denial (PostgREST 403)** | Treat same as authorization error. | "Access denied." |
| **Conflict (409)** | Show specific conflict message. | "This time slot is no longer available." |

### Edge Function Error Response Format

```typescript
interface EdgeFunctionError {
  error: string;           // Machine-readable code: "SLOT_UNAVAILABLE"
  message: string;         // Human-readable: "The selected time slot is no longer available."
  details?: Record<string, unknown>; // Optional context
}
```

### Frontend Error Composable

```typescript
// composables/useErrorHandler.ts
export function useErrorHandler() {
  function handleError(error: unknown): void {
    if (error instanceof Error && error.name === 'AuthError') {
      // redirect to login
    } else if (isSupabaseError(error)) {
      // map PostgREST codes to user messages
    } else {
      // generic
    }
  }
  return { handleError };
}
```

## 6. Authentication Flow

### Sign-Up

```
1. User fills RegisterForm (name, email, CPF, password)
2. Frontend validates with Zod schema
3. supabase.auth.signUp({ email, password, options: { data: { name, cpf, role: 'patient' } } })
4. Supabase Auth creates auth.users row
5. PostgreSQL trigger on auth.users: INSERT INTO profiles (id, name, cpf, role) VALUES (new.id, ...)
6. Supabase sends confirmation email
7. User clicks link → email confirmed
8. Frontend redirects to /login
```

### Sign-In

```
1. User fills LoginForm (email, password)
2. Frontend validates with Zod schema
3. supabase.auth.signInWithPassword({ email, password })
4. Supabase returns { access_token, refresh_token, user }
5. access_token stored in memory (Pinia authStore)
6. refresh_token stored in httpOnly cookie (Supabase default)
7. authStore hydrates: load profile from profiles table
8. Frontend navigates to role-based dashboard
```

### Token Refresh

```
1. supabase-js SDK intercepts 401 on any request
2. Automatically calls /auth/v1/token with refresh_token
3. New access_token stored
4. Original request retried
```

### Sign-Out

```
1. supabase.auth.signOut()
2. Auth store cleared
3. Pinia stores reset
4. Redirect to /login
```

## 7. Authorization Model (RBAC)

### Role Hierarchy

```
admin > employee > doctor > patient
```

### Permission Matrix

| Action | patient | employee | doctor | admin |
|--------|---------|----------|--------|-------|
| **Auth** | | | | |
| Register (self) | ✅ | ❌ | ❌ | ❌ |
| Login | ✅ | ✅ | ✅ | ✅ |
| Reset password | ✅ | ✅ | ✅ | ✅ |
| **Profile** | | | | |
| View own profile | ✅ | ✅ | ✅ | ✅ |
| Edit own profile | ✅ | ❌ | ❌ | ❌ |
| View any profile | ❌ | ✅ | ❌ | ✅ |
| Edit any profile | ❌ | ✅ | ❌ | ✅ |
| **Appointments** | | | | |
| Book own appointment | ✅ | ❌ | ❌ | ❌ |
| Cancel own appointment | ✅ | ❌ | ❌ | ❌ |
| View own appointments | ✅ | ❌ | ✅ (own patients) | ❌ |
| View all appointments | ❌ | ✅ | ✅ (own) | ✅ |
| Create (on behalf of patient) | ❌ | ✅ | ❌ | ❌ |
| Edit any appointment | ❌ | ✅ | ❌ | ✅ |
| Cancel any appointment | ❌ | ✅ | ❌ | ✅ |
| **Patients** | | | | |
| View own data | ✅ | ❌ | ✅ (own patients) | ❌ |
| View all patients | ❌ | ✅ | ❌ | ✅ |
| Create patient | ❌ | ✅ | ❌ | ✅ |
| Edit patient | ❌ | ✅ | ✅ (own patients) | ✅ |
| Delete patient (soft) | ❌ | ❌ | ❌ | ✅ |
| **Doctors** | | | | |
| View doctor list | ✅ | ✅ | ✅ | ✅ |
| View doctor schedule | ✅ | ✅ | ✅ (own) | ✅ |
| Create doctor profile | ❌ | ❌ | ❌ | ✅ |
| Edit doctor profile | ❌ | ✅ | ✅ (own) | ✅ |
| **Medical Records** | | | | |
| View own records | ✅ | ❌ | ✅ (own patients) | ❌ |
| Create record | ❌ | ❌ | ✅ (own patients) | ❌ |
| Edit record | ❌ | ❌ | ✅ (own records) | ❌ |
| Delete record | ❌ | ❌ | ❌ | ✅ |
| **Health Plans** | | | | |
| View own plans | ✅ | ❌ | ❌ | ❌ |
| View all plans | ❌ | ✅ | ❌ | ✅ |
| Create/edit plans | ❌ | ✅ | ❌ | ✅ |
| **Schedules** | | | | |
| View schedule | ✅ | ✅ | ✅ (own) | ✅ |
| Create/edit schedule | ❌ | ✅ | ❌ | ✅ |
| **Clinics** | | | | |
| View clinics | ✅ | ✅ | ✅ | ✅ |
| Manage clinics | ❌ | ❌ | ❌ | ✅ |
| **Specialties** | | | | |
| View specialties | ✅ | ✅ | ✅ | ✅ |
| Manage specialties | ❌ | ❌ | ❌ | ✅ |
| **Audit Logs** | | | | |
| View audit logs | ❌ | ❌ | ❌ | ✅ |
| **System Settings** | | | | |
| Manage settings | ❌ | ❌ | ❌ | ✅ |

### Role Enforcement Points

1. **Frontend Router Guards**: Prevent navigation to unauthorized routes. UI hides inaccessible elements. Not a security boundary.
2. **RLS Policies**: Enforce authorization at the database level. **Primary security boundary.** Every query passes through RLS.
3. **Edge Functions**: Validate `auth.uid()` and role before executing business logic.
4. **API (PostgREST)**: Supabase auto-generates REST API. RLS automatically filters results.

## 8. State Management Approach

### Pinia Store Design

Each domain entity gets one store. Stores are **flat** (no nesting) and follow this pattern:

```typescript
// stores/appointment.store.ts
export const useAppointmentStore = defineStore('appointment', () => {
  // ── State ──
  const appointments = ref<Appointment[]>([]);
  const currentAppointment = ref<Appointment | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({ page: 1, pageSize: 20, total: 0 });

  // ── Getters (computed) ──
  const upcomingAppointments = computed(() =>
    appointments.value.filter(a => a.status === 'scheduled' && new Date(a.date) > new Date())
  );

  // ── Actions ──
  async function fetchAppointments(filters?: AppointmentFilters) {
    loading.value = true;
    error.value = null;
    try {
      const { data, count } = await supabase
        .from('appointments')
        .select('*, doctor:doctors(*, profile:profiles(*)), patient:patients(*, profile:profiles(*))', { count: 'exact' })
        .match(filters ?? {})
        .range(pagination.value.page * pagination.value.pageSize, (pagination.value.page + 1) * pagination.value.pageSize - 1);
      appointments.value = data ?? [];
      pagination.value.total = count ?? 0;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  }

  async function bookAppointment(input: BookAppointmentInput) {
    const parsed = bookAppointmentSchema.parse(input); // Zod validation
    const { data, error: rpcError } = await supabase.functions.invoke('book-appointment', {
      body: parsed,
    });
    if (rpcError) throw new Error(rpcError.message);
    appointments.value.unshift(data);
    return data;
  }

  function $reset() {
    appointments.value = [];
    currentAppointment.value = null;
    loading.value = false;
    error.value = null;
  }

  return { appointments, currentAppointment, loading, error, pagination, upcomingAppointments, fetchAppointments, bookAppointment, $reset };
});
```

### Auth Store (Special)

```typescript
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const profile = ref<Profile | null>(null);
  const isAuthenticated = computed(() => !!user.value);
  const role = computed(() => profile.value?.role ?? null);

  async function initialize() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      user.value = session.user;
      await loadProfile();
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null;
      if (session) loadProfile(); else profile.value = null;
    });
  }

  async function loadProfile() {
    if (!user.value) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.value.id).single();
    profile.value = data;
  }

  return { user, profile, isAuthenticated, role, initialize, loadProfile };
});
```

### State Reset on Logout

All stores implement `$reset()`. On logout, the auth store calls each store's `$reset()` via a plugin:

```typescript
// stores/plugins/resetPlugin.ts
export function resettablePlugin(store) {
  if (store.$id === 'auth') {
    store.$subscribe((_mutation, state) => {
      if (!state.user) {
        const stores = [useAppointmentStore, usePatientStore, /* ... */];
        stores.forEach(s => s().$reset());
      }
    });
  }
}
```

## 9. API Design Principles

### Supabase PostgREST (Primary API)

All CRUD operations go through Supabase's auto-generated PostgREST API:

```
GET    /rest/v1/profiles?id=eq.{uuid}
GET    /rest/v1/appointments?status=eq.scheduled&order=date.asc
POST   /rest/v1/appointments
PATCH  /rest/v1/appointments?id=eq.{uuid}
DELETE /rest/v1/appointments?id=eq.{uuid}        (soft delete only)
```

**Conventions**:
- Use `select` to specify exact columns (never `*` in production)
- Always use `order` for deterministic pagination
- Always use `range` for pagination
- Use `count=exact` header for total count
- Use `Prefer: return=representation` for INSERT/UPDATE to get data back
- Use `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`, `like`, `ilike` filters

### Edge Functions (Complex Operations Only)

Only for multi-step operations that need transactions:

| Function | Purpose |
|----------|---------|
| `book-appointment` | Create appointment with conflict check + slot decrement + audit |
| `cancel-appointment` | Cancel with slot release + audit |
| `assign-doctor` | Assign doctor to patient with validation |

**URL**: `https://{project-ref}.supabase.co/functions/v1/{function-name}`

**Request/Response**:
```typescript
// Request
const { data, error } = await supabase.functions.invoke('book-appointment', {
  body: { patient_id, doctor_id, schedule_id, date },
});

// Response
// Success: 200 { id, status, date, ... }
// Error: 400/403/409 { error: "CODE", message: "description" }
```

### Realtime Subscriptions

Used for live updates on dashboards:

```typescript
supabase
  .channel('appointments-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
    appointmentStore.handleRealtimeEvent(payload);
  })
  .subscribe();
```

## 10. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Vercel (Frontend)                        │
│  Vue 3 SPA built by Vite                                    │
│  ├── /apps/web/dist → static assets on CDN                  │
│  ├── Edge middleware: redirect unauthenticated to /login     │
│  └── Preview deployments on PRs                             │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────┐
│                   Supabase Cloud                            │
│  ├── PostgreSQL 15+ (managed)                               │
│  ├── PostgREST API (auto-generated)                         │
│  ├── Supabase Auth (JWT tokens)                             │
│  ├── Edge Functions (Deno runtime, serverless)              │
│  ├── Realtime (WebSocket)                                   │
│  ├── Storage (if needed for file uploads)                   │
│  └── Dashboard for monitoring                               │
└─────────────────────────────────────────────────────────────┘
```

### Environment Strategy

| Environment | Supabase Project | Vercel | Purpose |
|-------------|-----------------|--------|---------|
| **Local** | `supabase start` (Docker) | `pnpm dev` | Development |
| **Preview** | `staging` project | Vercel preview URL | PR testing |
| **Production** | `production` project | Vercel production | Live |

### CI/CD Pipeline

```
git push → GitHub Actions
  ├── Lint (eslint + prettier)
  ├── Type check (tsc --noEmit)
  ├── Unit tests (vitest run)
  ├── Build (vite build + turbo build)
  └── On main merge:
      ├── Deploy frontend to Vercel
      └── supabase db push (migrations)
```

### Build Commands

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset",
    "db:seed": "supabase db seed"
  }
}
```
