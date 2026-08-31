# Supabase Setup Guide

## Option A: Supabase Cloud (Recommended)

### 1. Create project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in
2. Click **New Project**
3. Choose your organization (or create one)
4. Fill in:
   - **Name**: `clinica-medica` (or whatever you want)
   - **Database Password**: save this somewhere safe
   - **Region**: pick the closest to your users
5. Click **Create new project** — wait ~2 min for provisioning

### 2. Get your keys

1. In your project dashboard, go to **Settings → API**
2. Copy:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — the long `eyJ...` string under "Project API keys"
3. **DO NOT** copy the `service_role` key — it's never used in the frontend

### 3. Configure env vars

Create `apps/web/.env` (this file is gitignored):

```env
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace with your actual values from step 2.

### 4. Run the migration

1. In the Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Open `supabase/migrations/001_initial_schema.sql` from this repo, copy the entire contents, paste it into the SQL editor
4. Click **Run** — this creates all 13 tables, enums, indexes, RLS policies, triggers, and seed data

Alternatively, if you have the Supabase CLI installed:

```bash
supabase link --project-ref abcdefgh
supabase db push
```

### 5. Deploy Edge Functions

Install the Supabase CLI if you haven't:

```bash
npm install -g supabase
```

Then deploy all functions:

```bash
supabase functions deploy book-appointment
supabase functions deploy cancel-appointment
supabase functions deploy create-medical-record
supabase functions deploy assign-doctor
```

### 6. Create the first admin user

There's no self-registration for admins. You need to create one manually:

1. In the Supabase dashboard, go to **Authentication → Users**
2. Click **Add user → Create new user**
3. Enter email + password, click **Create user**
4. Copy the user's UUID
5. Go to **SQL Editor** and run:

```sql
UPDATE profiles
SET role = 'admin', full_name = 'Admin'
WHERE id = 'paste-the-uuid-here';
```

### 7. Start the app

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` and log in with the admin credentials.

---

## Option B: Local Supabase (via Docker)

Requires Docker Desktop running.

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Start local Supabase

```bash
supabase start
```

This spins up Postgres, Auth, Studio, etc. in Docker. On first run it downloads images (~2-5 min).

When done, it prints:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
Studio URL: http://127.0.0.1:54323
```

### 3. Configure env vars

Create `apps/web/.env`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJ...(the anon key from above)
```

### 4. Run migration

The migration runs automatically from `supabase/migrations/` when you start. If it didn't, or you need to re-run:

```bash
supabase db reset
```

### 5. Deploy Edge Functions locally

```bash
supabase functions serve
```

This serves all functions at `http://127.0.0.1:54321/functions/v1/<function-name>`.

### 6. Create admin user

Open Studio at `http://127.0.0.1:54323`, then follow the same steps as Option A, step 6.

### 7. Start the app

```bash
pnpm dev
```

### Stopping

```bash
supabase stop
```

---

## Option B: Local Supabase (via Docker Desktop)

This section documents the **self-hosted** local setup using Docker Desktop + Supabase CLI. It is maintained in parallel with Option A (cloud) and supersedes it when running locally. For cloud-only usage refer to Option A above.

### 1. Prerequisites

- Docker Desktop 4.x installed and running (`docker ps` lists containers)
- Supabase CLI installed (`supabase --version`)
- PowerShell with Docker binary on PATH (see Steps 2–3 below)

### 2. Initial Start

```powershell
cd C:\path\to\Sistema-clinica-m-dica
supabase init        # only if supabase/ folder missing; harmless if exists
supabase start       # spins up 12 containers (~90s first run)
```

Save the printed URLs and anon key — you'll use these for the web app `.env`.

### 3. Schema Fixes — Required Once

The canonical migration `001_initial_schema.sql` contains two issues that cause GoTrue signup/login to fail. Apply these **once** after first start (or after `db reset`):

**Fix A — `audit_trigger_func` unqualified `audit_logs`**

```powershell
Get-Content supabase/migrations/002_fix_audit_trigger.sql -Raw |
  docker exec -i supabase_db_<project> psql -U postgres -d postgres
docker restart supabase_auth_<project>
```

**Fix B — `handle_new_user` unqualified `user_role`**

```powershell
Get-Content supabase/migrations/003_fix_handle_new_user.sql -Raw |
  docker exec -i supabase_db_<project> psql -U postgres -d postgres
```

> These two fixes are bundled in the migration files 002/003 so that subsequent `supabase db reset` re-applies them cleanly. If you skip them, all auth operations fail with `type "user_role" does not exist`.

### 4. Seed Demo Data

```powershell
Get-Content supabase/seed.sql -Raw |
  docker exec -i supabase_db_<project> psql -U postgres -d postgres
```

Demo users (shown in the table below). Passwords are bcrypt `$2a$10$` format; `gen_salt('bf', 10)` produces the correct prefix.

| Email                  | Password       | Role     | UUID                                 |
| ---------------------- | -------------- | -------- | ------------------------------------ |
| admin@clinica.local    | admin123456    | admin    | auto-generated                       |
| doctor@clinica.local   | doctor123456   | doctor   | 00000000-0000-0000-0000-000000000002 |
| employee@clinica.local | employee123456 | employee | 00000000-0000-0000-0000-000000000003 |
| patient@clinica.local  | patient123456  | patient  | 00000000-0000-0000-0000-000000000004 |

### 5. Web App Configuration

Create `apps/web/.env`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<the anon key printed by supabase start>
```

### 6. Run Checks

```powershell
# Verify login
$body = @{ email='admin@clinica.local'; password='admin123456' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:54321/auth/v1/token?grant_type=password" -ContentType "application/json" -Body $body | Select user

# Build & test
pnpm install
pnpm --filter @clinica/web build
pnpm lint
pnpm typecheck
pnpm test
```

### 7. Stop / Restart

```powershell
supabase stop    # stop containers, keep volumes
supabase stop --no-backup   # stop + remove volumes
```

> After a full stop, re-run Steps 2–4. `seed.sql` is **not** auto-applied — you must run it manually after `db reset`.

### 8. Container Names Reference

For `docker exec` commands, the compose project name is `supabase_<foldername>`. In this repo:

- `supabase_db_Sistema-clinica-m-dica` — Postgres (default DB user: `postgres`)
- `supabase_auth_Sistema-clinica-m-dica` — GoTrue (port 9999 / HTTP API)
- `supabase_rest_Sistema-clinica-m-dica` — PostgREST (port 54321)
- `supabase_studio_Sistema-clinica-m-dica` — Supabase Studio UI (port 54323)
- `supabase_storage_Sistema-clinica-m-dica` — Storage API
- `supabase_kong_Sistema-clinica-m-dica` — API gateway

List: `docker ps --format '{{.Names}}'`.

---

## Quick reference

| What           | Where                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| Project URL    | Supabase Dashboard → Settings → API (cloud) or `http://127.0.0.1:54321` (local)          |
| Anon key       | Supabase Dashboard (cloud) or `supabase start` output (local)                            |
| Migration file | `supabase/migrations/001_initial_schema.sql`                                             |
| Edge Functions | `supabase/functions/{book,cancel}-appointment`, `create-medical-record`, `assign-doctor` |
| Env file       | `apps/web/.env` (gitignored)                                                             |
| Local Studio   | `http://127.0.0.1:54323`                                                                 |
| Local API      | `http://127.0.0.1:54321`                                                                 |

| What           | Where                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| Project URL    | Supabase Dashboard → Settings → API                                                      |
| Anon key       | Supabase Dashboard → Settings → API                                                      |
| Migration file | `supabase/migrations/001_initial_schema.sql`                                             |
| Edge Functions | `supabase/functions/{book,cancel}-appointment`, `create-medical-record`, `assign-doctor` |
| Env file       | `apps/web/.env` (gitignored)                                                             |
| Local Studio   | `http://127.0.0.1:54323`                                                                 |
| Local API      | `http://127.0.0.1:54321`                                                                 |
