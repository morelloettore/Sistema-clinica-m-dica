# API Specification — Sistema Clínica Médica

## 1. Overview

The API has two layers:

1. **Supabase PostgREST**: Auto-generated REST API for all CRUD operations. Every table is accessible at `/rest/v1/{table_name}`.
2. **Edge Functions**: Custom serverless functions for complex multi-step operations.

All requests require `Authorization: Bearer <jwt_token>` header (except public reads if configured).

## 2. Common Headers

### Request Headers

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | Yes | `Bearer <access_token>` |
| `Content-Type` | Yes | `application/json` |
| `apikey` | Yes | Supabase anon key |
| `Prefer` | Optional | `return=representation` (for INSERT/UPDATE) |

### Response Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Total-Count` | Total row count (when `Prefer: count=exact`) |
| `Content-Range` | `start-end/total` (for paginated responses) |

## 3. PostgREST API Endpoints

### 3.1 Profiles

#### GET /rest/v1/profiles

List profiles (filtered by RLS).

- **Auth**: All authenticated users (RLS filtered)
- **RLS**: Users see own; employees/admins see all
- **Query Params**: `select`, `role`, `is_active`, `order`, `limit`, `offset`
- **Response**:

```json
[
  {
    "id": "uuid",
    "name": "João Silva",
    "cpf": "123.456.789-00",
    "email": "joao@email.com",
    "phone": "(11) 99999-1234",
    "role": "patient",
    "is_active": true,
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-01-15T10:00:00Z"
  }
]
```

#### GET /rest/v1/profiles?id=eq.{uuid}

Get single profile by ID.

- **Response**: Single profile object.

#### PATCH /rest/v1/profiles?id=eq.{uuid}

Update profile.

- **RLS**: Own profile; employee/admin can update any
- **Body**:

```json
{
  "name": "João Santos",
  "phone": "(11) 98888-5678"
}
```

- **Response**: Updated profile object.

---

### 3.2 Patients

#### GET /rest/v1/patients

List patients.

- **Auth**: Employees, admins (all); patients (own); doctors (own patients via appointments)
- **Query Params**: `select=*,profile:profiles(*)`, `order=created_at.desc`
- **Response**:

```json
[
  {
    "id": "uuid",
    "profile_id": "uuid",
    "date_of_birth": "1990-05-15",
    "gender": "male",
    "address": "Rua A, 123",
    "city": "São Paulo",
    "state": "SP",
    "zip_code": "01234567",
    "blood_type": "O+",
    "allergies": "Penicilina",
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-01-15T10:00:00Z",
    "profile": {
      "id": "uuid",
      "name": "João Silva",
      "cpf": "123.456.789-00",
      "email": "joao@email.com",
      "phone": "(11) 99999-1234",
      "role": "patient"
    }
  }
]
```

#### GET /rest/v1/patients?id=eq.{uuid}

Get single patient.

#### POST /rest/v1/patients

Create patient.

- **Auth**: Employee, admin
- **Headers**: `Prefer: return=representation`
- **Body**:

```json
{
  "profile_id": "uuid",
  "date_of_birth": "1990-05-15",
  "gender": "male",
  "address": "Rua A, 123",
  "city": "São Paulo",
  "state": "SP",
  "zip_code": "01234567",
  "blood_type": "O+",
  "allergies": "Penicilina"
}
```

- **Response**: 201 Created + patient object

#### PATCH /rest/v1/patients?id=eq.{uuid}

Update patient.

- **Auth**: Own (patient); any (employee, admin)
- **Body**: Partial patient fields
- **Response**: Updated patient object

---

### 3.3 Doctors

#### GET /rest/v1/doctors

List doctors.

- **Auth**: All authenticated users
- **Query Params**: `select=*,profile:profiles(*),doctor_specialties(*,specialty:specialties(*)),doctor_clinics(*,clinic:clinics(*))`
- **Response**:

```json
[
  {
    "id": "uuid",
    "profile_id": "uuid",
    "crm": "12345-SP",
    "bio": "Cardiologista com 15 anos de experiência",
    "consultation_price": 250.00,
    "is_active": true,
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-01-15T10:00:00Z",
    "profile": {
      "name": "Dr. Maria Silva",
      "email": "maria@clinica.com"
    },
    "doctor_specialties": [
      {
        "specialty": { "id": "uuid", "name": "Cardiologia" }
      }
    ],
    "doctor_clinics": [
      {
        "clinic": { "id": "uuid", "name": "Clínica Central" }
      }
    ]
  }
]
```

#### GET /rest/v1/doctors?id=eq.{uuid}

Get single doctor with nested relations.

#### POST /rest/v1/doctors

Create doctor.

- **Auth**: Admin only
- **Headers**: `Prefer: return=representation`
- **Body**:

```json
{
  "profile_id": "uuid",
  "crm": "12345-SP",
  "bio": "Cardiologista",
  "consultation_price": 250.00
}
```

#### PATCH /rest/v1/doctors?id=eq.{uuid}

Update doctor.

- **Auth**: Own (doctor); any (employee, admin)

#### DELETE /rest/v1/doctors?id=eq.{uuid}

Delete doctor (hard delete).

- **Auth**: Admin only

---

### 3.4 Specialties

#### GET /rest/v1/specialties

List all specialties.

- **Auth**: All authenticated users
- **Response**:

```json
[
  {
    "id": "uuid",
    "name": "Cardiologia",
    "description": "Estudo e tratamento do coração",
    "is_active": true,
    "created_at": "2026-01-15T10:00:00Z"
  }
]
```

#### POST /rest/v1/specialties

Create specialty.

- **Auth**: Admin only

#### PATCH /rest/v1/specialties?id=eq.{uuid}

Update specialty.

- **Auth**: Admin only

#### DELETE /rest/v1/specialties?id=eq.{uuid}

Delete specialty.

- **Auth**: Admin only

---

### 3.5 Clinics

#### GET /rest/v1/clinics

List all clinics.

- **Auth**: All authenticated users

#### POST /rest/v1/clinics

Create clinic.

- **Auth**: Admin only

#### PATCH /rest/v1/clinics?id=eq.{uuid}

Update clinic.

- **Auth**: Admin only

#### DELETE /rest/v1/clinics?id=eq.{uuid}

Delete clinic.

- **Auth**: Admin only

---

### 3.6 Health Plans

#### GET /rest/v1/health_plans

List health plans.

- **Auth**: All authenticated users

#### POST /rest/v1/health_plans

Create health plan.

- **Auth**: Employee, admin

#### PATCH /rest/v1/health_plans?id=eq.{uuid}

Update health plan.

- **Auth**: Employee, admin

#### DELETE /rest/v1/health_plans?id=eq.{uuid}

Delete health plan.

- **Auth**: Admin only

---

### 3.7 Patient Health Plans

#### GET /rest/v1/patient_health_plans

List patient-plan assignments.

- **Auth**: Own (patient); all (employee, admin)

#### POST /rest/v1/patient_health_plans

Assign health plan to patient.

- **Auth**: Employee, admin

#### DELETE /rest/v1/patient_health_plans?id=eq.{uuid}

Remove health plan assignment.

- **Auth**: Employee, admin

---

### 3.8 Schedules

#### GET /rest/v1/schedules

List schedules.

- **Auth**: All authenticated users (RLS: active only)
- **Query Params**: `doctor_id=eq.{uuid}`, `date=eq.2026-08-15`, `available_slots=gt.0`
- **Response**:

```json
[
  {
    "id": "uuid",
    "doctor_id": "uuid",
    "clinic_id": "uuid",
    "date": "2026-08-15",
    "start_time": "08:00:00",
    "end_time": "12:00:00",
    "max_slots": 10,
    "available_slots": 7,
    "is_active": true,
    "created_at": "2026-08-01T10:00:00Z",
    "clinic": { "id": "uuid", "name": "Clínica Central" }
  }
]
```

#### POST /rest/v1/schedules

Create schedule.

- **Auth**: Employee, admin
- **Body**:

```json
{
  "doctor_id": "uuid",
  "clinic_id": "uuid",
  "date": "2026-08-15",
  "start_time": "08:00:00",
  "end_time": "12:00:00",
  "max_slots": 10
}
```

- **Note**: `available_slots` is auto-set to `max_slots` via trigger.

#### PATCH /rest/v1/schedules?id=eq.{uuid}

Update schedule.

- **Auth**: Employee, admin
- **Validation**: Cannot reduce `max_slots` below booked count.

#### DELETE /rest/v1/schedules?id=eq.{uuid}

Delete schedule.

- **Auth**: Employee, admin
- **Validation**: Only if `available_slots = max_slots` (no bookings).

---

### 3.9 Appointments

#### GET /rest/v1/appointments

List appointments.

- **Auth**: All (RLS filtered)
- **Query Params**: `status=eq.scheduled`, `date=gte.2026-08-01&date=lte.2026-08-31`
- **Select**: `select=*,patient:patients(*,profile:profiles(*)),doctor:doctors(*,profile:profiles(*)),schedule:schedules(*),clinic:clinics(*)`
- **Response**:

```json
[
  {
    "id": "uuid",
    "patient_id": "uuid",
    "doctor_id": "uuid",
    "schedule_id": "uuid",
    "clinic_id": "uuid",
    "date": "2026-08-15",
    "status": "scheduled",
    "notes": null,
    "cancellation_reason": null,
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-01T10:00:00Z",
    "patient": {
      "id": "uuid",
      "profile": { "name": "João Silva" }
    },
    "doctor": {
      "id": "uuid",
      "profile": { "name": "Dr. Maria Silva" },
      "crm": "12345-SP"
    },
    "schedule": {
      "start_time": "09:00:00",
      "end_time": "10:00:00"
    },
    "clinic": {
      "name": "Clínica Central"
    }
  }
]
```

#### GET /rest/v1/appointments?id=eq.{uuid}

Get single appointment.

#### POST /rest/v1/appointments

Create appointment (direct, for employees).

- **Auth**: Employee
- **Body**:

```json
{
  "patient_id": "uuid",
  "doctor_id": "uuid",
  **schedule_id**: "uuid",
  "clinic_id": "uuid",
  "date": "2026-08-15",
  "notes": "Primeira consulta"
}
```

- **Response**: 201 + appointment object

#### PATCH /rest/v1/appointments?id=eq.{uuid}

Update appointment (status change, reschedule).

- **Auth**: Own (patient: cancel only); own (doctor: complete); any (employee, admin)

---

### 3.10 Medical Records

#### GET /rest/v1/medical_records

List medical records.

- **Auth**: Own (patient); own patients (doctor); all (employee, admin)
- **Query Params**: `is_deleted=eq.false`, `patient_id=eq.{uuid}`
- **Select**: `select=*,patient:patients(*,profile:profiles(*)),doctor:doctors(*,profile:profiles(*)),appointment:appointments(*)`
- **Response**:

```json
[
  {
    "id": "uuid",
    "patient_id": "uuid",
    "doctor_id": "uuid",
    "appointment_id": "uuid",
    "diagnosis": "Hipertensão arterial",
    "notes": "Pressão 140/90. Iniciar medicação.",
    "prescription": "Losartana 50mg, 1x ao dia",
    "next_appointment_date": "2026-09-15",
    "is_deleted": false,
    "created_by": "uuid",
    "created_at": "2026-08-15T14:00:00Z",
    "updated_at": "2026-08-15T14:00:00Z"
  }
]
```

#### GET /rest/v1/medical_records?id=eq.{uuid}

Get single medical record.

#### POST /rest/v1/medical_records

Create medical record.

- **Auth**: Doctor (own patients only)
- **Body**:

```json
{
  "patient_id": "uuid",
  "appointment_id": "uuid",
  "diagnosis": "Hipertensão arterial",
  "notes": "Pressão 140/90",
  "prescription": "Losartana 50mg",
  "next_appointment_date": "2026-09-15"
}
```

- **Note**: `created_by` is auto-set to `auth.uid()` via trigger.

#### PATCH /rest/v1/medical_records?id=eq.{uuid}

Update medical record.

- **Auth**: Doctor (own records)

---

### 3.11 Audit Logs

#### GET /rest/v1/audit_logs

List audit logs.

- **Auth**: Admin only (RLS enforced)
- **Query Params**: `table_name=eq.appointments`, `created_at=gte.2026-08-01`, `action=eq.UPDATE`
- **Response**:

```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "action": "UPDATE",
    "table_name": "appointments",
    "record_id": "uuid",
    "old_data": { "status": "scheduled" },
    "new_data": { "status": "cancelled" },
    "ip_address": "192.168.1.1",
    "created_at": "2026-08-15T10:00:00Z",
    "user": { "name": "Admin User" }
  }
]
```

---

### 3.12 Doctor Specialties (Junction)

#### GET /rest/v1/doctor_specialties

List all doctor-specialty assignments.

- **Auth**: All

#### POST /rest/v1/doctor_specialties

Assign specialty to doctor.

- **Auth**: Admin

#### DELETE /rest/v1/doctor_specialties?doctor_id=eq.{uuid}&specialty_id=eq.{uuid}

Remove specialty from doctor.

- **Auth**: Admin

---

### 3.13 Doctor Clinics (Junction)

#### GET /rest/v1/doctor_clinics

List all doctor-clinic assignments.

- **Auth**: All

#### POST /rest/v1/doctor_clinics

Assign clinic to doctor.

- **Auth**: Admin

#### DELETE /rest/v1/doctor_clinics?doctor_id=eq.{uuid}&clinic_id=eq.{uuid}

Remove clinic from doctor.

- **Auth**: Admin

---

## 4. Edge Function Specifications

### 4.1 book-appointment

**URL**: `POST /functions/v1/book-appointment`

**Purpose**: Create appointment with conflict check, slot decrement, and audit.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:

```typescript
interface BookAppointmentInput {
  patient_id: string;    // UUID
  doctor_id: string;     // UUID
  schedule_id: string;   // UUID
  clinic_id: string;     // UUID
  date: string;          // YYYY-MM-DD
  notes?: string;        // Optional, max 500 chars
}
```

**Zod Schema**:

```typescript
export const bookAppointmentSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});
```

**Processing Steps**:

```
1. Verify JWT (middleware)
2. Extract auth.uid()
3. If caller is patient: verify patient_id matches auth.uid()
4. Validate input with Zod
5. BEGIN TRANSACTION
6. SELECT schedules WHERE id = schedule_id AND available_slots > 0 AND is_active = true
   - FOR UPDATE (row lock)
   - If not found → 409 CONFLICT "Schedule not available"
7. Check no duplicate appointment:
   SELECT appointments WHERE patient_id = ? AND schedule_id = ? AND status = 'scheduled'
   - If found → 409 CONFLICT "Already booked"
8. Check no time conflict for patient:
   SELECT appointments WHERE patient_id = ? AND date = ? AND status = 'scheduled'
   - Check time overlap with schedule
   - If overlap → 409 CONFLICT "Time conflict"
9. Verify doctor is active:
   SELECT doctors WHERE id = doctor_id AND is_active = true
   - If not → 400 BAD_REQUEST "Doctor is not active"
10. Verify patient is active:
    SELECT profiles JOIN patients WHERE id = patient_id AND is_active = true
    - If not → 400 BAD_REQUEST "Patient is not active"
11. INSERT INTO appointments (patient_id, doctor_id, schedule_id, clinic_id, date, status)
    VALUES (?, ?, ?, ?, ?, 'scheduled')
12. UPDATE schedules SET available_slots = available_slots - 1 WHERE id = schedule_id
13. COMMIT TRANSACTION
14. Return appointment record
```

**Success Response**: `200 OK`

```json
{
  "id": "uuid",
  "patient_id": "uuid",
  "doctor_id": "uuid",
  "schedule_id": "uuid",
  "clinic_id": "uuid",
  "date": "2026-08-15",
  "status": "scheduled",
  "created_at": "2026-08-15T10:00:00Z"
}
```

**Error Responses**:

| Status | Error Code | Message |
|--------|------------|---------|
| 400 | `VALIDATION_ERROR` | Invalid input data |
| 400 | `DOCTOR_INACTIVE` | Doctor is not active |
| 400 | `PATIENT_INACTIVE` | Patient account is deactivated |
| 403 | `UNAUTHORIZED` | Cannot book for another patient |
| 409 | `SLOT_UNAVAILABLE` | Time slot is no longer available |
| 409 | `DUPLICATE_BOOKING` | Already have an appointment at this time |
| 409 | `TIME_CONFLICT` | Conflicts with existing appointment |
| 429 | `RATE_LIMIT` | Too many booking attempts |
| 500 | `INTERNAL_ERROR` | Unexpected error |

---

### 4.2 cancel-appointment

**URL**: `POST /functions/v1/cancel-appointment`

**Purpose**: Cancel appointment, release slot, audit.

**Request Body**:

```typescript
interface CancelAppointmentInput {
  appointment_id: string;    // UUID
  cancellation_reason?: string;  // Optional, max 500 chars
}
```

**Zod Schema**:

```typescript
export const cancelAppointmentSchema = z.object({
  appointment_id: z.string().uuid(),
  cancellation_reason: z.string().max(500).optional(),
});
```

**Processing Steps**:

```
1. Verify JWT
2. Extract auth.uid()
3. Validate input
4. SELECT appointment WHERE id = appointment_id
   - If not found → 404 NOT_FOUND
   - If caller is patient: verify patient_id matches auth.uid()
   - If status != 'scheduled' → 409 CONFLICT "Appointment cannot be cancelled"
5. BEGIN TRANSACTION
6. UPDATE appointments SET status = 'cancelled', cancellation_reason = ? WHERE id = ?
7. UPDATE schedules SET available_slots = available_slots + 1 WHERE id = (appointment's schedule_id)
8. COMMIT
9. Return updated appointment
```

**Success Response**: `200 OK` — Updated appointment object.

**Error Responses**:

| Status | Error Code | Message |
|--------|------------|---------|
| 400 | `VALIDATION_ERROR` | Invalid input |
| 403 | `UNAUTHORIZED` | Cannot cancel this appointment |
| 404 | `NOT_FOUND` | Appointment not found |
| 409 | `CANNOT_CANCEL` | Appointment is not in cancellable state |
| 500 | `INTERNAL_ERROR` | Unexpected error |

---

### 4.3 assign-doctor

**URL**: `POST /functions/v1/assign-doctor`

**Purpose**: Assign doctor specialties and clinics (admin operation).

**Request Body**:

```typescript
interface AssignDoctorInput {
  doctor_id: string;
  specialty_ids?: string[];  // Replace all specialties
  clinic_ids?: string[];     // Replace all clinics
}
```

**Processing Steps**:

```
1. Verify JWT, verify admin role
2. Validate input
3. BEGIN TRANSACTION
4. If specialty_ids provided:
   DELETE FROM doctor_specialties WHERE doctor_id = ?
   INSERT INTO doctor_specialties (doctor_id, specialty_id) SELECT ?, unnest(?)
5. If clinic_ids provided:
   DELETE FROM doctor_clinics WHERE doctor_id = ?
   INSERT INTO doctor_clinics (doctor_id, clinic_id) SELECT ?, unnest(?)
6. COMMIT
7. Return success
```

---

## 5. Error Response Format

All API errors follow this structure:

```typescript
interface ApiError {
  error: string;           // Machine-readable error code
  message: string;         // Human-readable message (pt-BR)
  details?: unknown;       // Optional additional context
  code?: string;           // HTTP status code as string
}
```

### Error Code Registry

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Business rule conflict |
| `SLOT_UNAVAILABLE` | 409 | Schedule slot no longer available |
| `DUPLICATE_BOOKING` | 409 | Patient already booked at this time |
| `TIME_CONFLICT` | 409 | Appointment conflicts with existing |
| `CANNOT_CANCEL` | 409 | Appointment in non-cancellable state |
| `DOCTOR_INACTIVE` | 400 | Doctor account deactivated |
| `PATIENT_INACTIVE` | 400 | Patient account deactivated |
| `RATE_LIMIT` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## 6. Pagination Strategy

### Offset-Based Pagination (Default)

```
GET /rest/v1/appointments?order=date.desc&limit=20&offset=0
```

**Headers**:
```
X-Total-Count: 156
Content-Range: 0-19/156
```

### Client-Side Pagination Helper

```typescript
// composables/usePagination.ts
export function usePagination<T>(fetchFn: (offset: number, limit: number) => Promise<T[]>) {
  const page = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const data = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(false);

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value));
  const offset = computed(() => (page.value - 1) * pageSize.value);
  const hasNext = computed(() => page.value < totalPages.value);
  const hasPrev = computed(() => page.value > 1);

  async function load() {
    loading.value = true;
    try {
      const result = await fetchFn(offset.value, pageSize.value);
      data.value = result;
    } finally {
      loading.value = false;
    }
  }

  function nextPage() { if (hasNext.value) { page.value++; load(); } }
  function prevPage() { if (hasPrev.value) { page.value--; load(); } }
  function goToPage(p: number) { page.value = p; load(); }

  return { data, page, pageSize, total, totalPages, hasNext, hasPrev, loading, load, nextPage, prevPage, goToPage };
}
```

## 7. Filtering Strategy

### Supabase Filter Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `eq` | Equals | `?status=eq.scheduled` |
| `neq` | Not equals | `?status=neq.cancelled` |
| `gt` | Greater than | `?available_slots=gt.0` |
| `gte` | Greater than or equal | `?date=gte.2026-08-01` |
| `lt` | Less than | `?date=lt.2026-09-01` |
| `lte` | Less than or equal | `?date=lte.2026-08-31` |
| `in` | In list | `?status=in.(scheduled,completed)` |
| `like` | SQL LIKE | `?name=like.*silva*` |
| `ilike` | Case-insensitive LIKE | `?name=ilike.*silva*` |
| `is` | IS (null) | `?deleted_at=is.null` |
| `not` | Negate | `?status=not.cancelled` |

### Common Filter Patterns

```
# Appointments by date range and status
GET /rest/v1/appointments?date=gte.2026-08-01&date=lte.2026-08-31&status=eq.scheduled

# Doctors by specialty
GET /rest/v1/doctors?doctor_specialties.specialty_id=eq.{specialty_id}

# Available schedules for a doctor on a date
GET /rest/v1/schedules?doctor_id=eq.{doctor_id}&date=eq.2026-08-15&available_slots=gt.0&is_active=eq.true

# Patients by search term
GET /rest/v1/patients?select=*,profile:profiles(*)&profile.name=ilike.*silva*

# Audit logs by table and date
GET /rest/v1/audit_logs?table_name=eq.appointments&created_at=gte.2026-08-01
```

### Filtering in Pinia Stores

```typescript
// stores/appointment.store.ts
async function fetchAppointments(filters: AppointmentFilters = {}) {
  let query = supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT, { count: 'exact' });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);
  if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId);
  if (filters.patientId) query = query.eq('patient_id', filters.patientId);

  query = query
    .order('date', { ascending: false })
    .range(offset.value, offset.value + pageSize.value - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  appointments.value = data ?? [];
  pagination.value.total = count ?? 0;
}
```
