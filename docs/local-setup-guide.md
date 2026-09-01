# Local Setup Guide — Windows (PowerShell)

This guide documents the **actual steps performed** to get the full system running locally on Windows 11 with Supabase self-hosted via Docker Desktop. Skip the prose, run the commands.

## Prerequisites

- Windows 11 (build 22000+)
- PowerShell 5.1 (built-in)
- Node.js 20+ and pnpm 9+
- Docker Desktop 4.x (Windows version)
- WSL2 enabled (Docker Desktop will offer to enable if missing)

## 1. Install Dependencies

```powershell
# Docker Desktop (silent install via winget)
winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements

# Supabase CLI (global)
npm install -g supabase

# Verify (close+reopen shell after install)
docker --version
supabase --version
```

## 2. Start Docker Engine

Docker Desktop ships with a Windows service `com.docker.service`. If the desktop GUI does not start (e.g. you ran a headless install), start the daemon manually:

```powershell
# Start the Docker daemon service
sc.exe start com.docker.service

# Confirm
docker ps
# Expected: empty table with header (no errors)
```

> **Note**: After a full Docker Desktop restart (reboot), the service auto-starts. The manual `sc start` is only needed if you skip launching the GUI.

## 3. Add PATH (User env, new shells only)

Docker and Supabase binaries may not be on PATH for new PowerShell windows after install. Add them permanently:

```powershell
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Program Files\Docker\Docker\resources\bin;C:\Users\$env:USERNAME\AppData\Roaming\npm",
    "User"
)
```

Open a **new** PowerShell window for the change to take effect.

## 4. Initialize Local Supabase

From the project root:

```powershell
cd C:\path\to\Sistema-clinica-m-dica
supabase init        # only if supabase/ folder missing; harmless if exists
supabase start       # spins up 12 containers (~90s on first run)
```

**Expected output**: prints URLs and keys for `API URL`, `anon key`, `service_role key`, `Studio URL`, `Inbucket URL`, `JWT secret`. Save these.

## 5. Schema Fixes Required (one-time per fresh DB)

Two issues exist in the canonical migration `001_initial_schema.sql` that need patching **after first apply** (these are tracked in migrations `002` and `003` so subsequent `db reset` is clean):

### 5a. `audit_trigger_func` uses unqualified `audit_logs` table

`SET search_path = ''` is used for security, but the function then references `audit_logs` (unqualified) which fails. Fixed in `supabase/migrations/002_fix_audit_trigger.sql`.

### 5b. `handle_new_user` uses unqualified `user_role` type

Same issue: `::user_role` cast resolves to `auth.user_role` enum (does not exist). Fixed in `supabase/migrations/003_fix_handle_new_user.sql` to `::public.user_role`.

### 5c. RLS policy recursion (circular table lookups)

Several policies query across tables in a circle (e.g. `appointments` RLS → `patients` RLS → `appointments` RLS), which Postgres rejects with `infinite recursion detected`. Fixed in `supabase/migrations/004_fix_policy_recursion.sql` by routing every cross-table lookup through SECURITY DEFINER helpers (`public.user_doctor_patient_ids()`, `public.patient_exists(uuid)`, `public.user_patient_id()`, `public.user_doctor_id()`), which are opaque to the planner. This also makes the RLS test suite (`supabase/tests/rls_policies.sql`, 25 assertions) pass.

If you applied the initial schema before these fixes, run them now:

```powershell
Get-Content supabase\migrations\002_fix_audit_trigger.sql -Raw |
  docker exec -i supabase_db_<project> psql -U postgres -d postgres

Get-Content supabase\migrations\003_fix_handle_new_user.sql -Raw |
  docker exec -i supabase_db_<project> psql -U postgres -d postgres

Get-Content supabase\migrations\004_fix_policy_recursion.sql -Raw |
  docker exec -i supabase_db_<project> psql -U postgres -d postgres

# Restart auth container to clear cached trigger plans
docker restart supabase_auth_<project>
```

## 6. Seed Demo Users + Clinical Data

The file `supabase/seed.sql` is NOT auto-applied on `supabase start` (no warning, but `db reset` requires it to exist). Run it manually for a fresh DB:

```powershell
Get-Content supabase\seed.sql -Raw |
  docker exec -i supabase_db_<project> psql -U postgres -d postgres
```

Demo credentials created:

| Email                    | Password         | Role     | UUID                                   |
| ------------------------ | ---------------- | -------- | -------------------------------------- |
| `admin@clinica.local`    | `admin123456`    | admin    | auto-generated                         |
| `doctor@clinica.local`   | `doctor123456`   | doctor   | `00000000-0000-0000-0000-000000000002` |
| `employee@clinica.local` | `employee123456` | employee | `00000000-0000-0000-0000-000000000003` |
| `patient@clinica.local`  | `patient123456`  | patient  | `00000000-0000-0000-0000-000000000004` |

## 7. Configure Web App

Create `apps/web/.env`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>
```

## 8. Verify

```powershell
# Test login as admin
$body = @{ email='admin@clinica.local'; password='admin123456' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:54321/auth/v1/token?grant_type=password" -ContentType "application/json" -Body $body | Select user

# Build the web app
pnpm install
pnpm --filter @clinica/web build

# Run all checks
pnpm lint
pnpm typecheck
pnpm test
```

## Gotchas Hit (read if something breaks)

| Symptom                                                   | Cause                                                                             | Fix                                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `docker: command not found`                               | Docker binary not on PATH for new shells                                          | Step 3                                                                                                        |
| `Invalid login credentials` for seeded user               | GoTrue can't verify bcrypt hash format                                            | Ensure hash is `$2a$10$` prefix (not `$2b$`, `$2y$`, or `$1$`). `gen_salt('bf', 10)` produces correct format. |
| Login fails even with correct hash                        | `auth.users.instance_id` not zero UUID                                            | `UPDATE auth.users SET instance_id = '00000000-0000-0000-0000-000000000000' WHERE ...`                        |
| Signup returns 500 "type user_role does not exist"        | `handle_new_user` trigger casts to unqualified `user_role` enum                   | Migration 003                                                                                                 |
| Signup returns 500 "relation audit_logs does not exist"   | `audit_trigger_func` references unqualified `audit_logs`                          | Migration 002                                                                                                 |
| Trigger `prevent_profile_privilege_change` blocks seeding | Pre-existing triggers fire on INSERT even for seed inserts                        | Seed uses ON CONFLICT DO NOTHING; first DELETE clears old rows                                                |
| `docker exec` cannot find container                       | Container name has project suffix: `supabase_db_<project>` not just `supabase_db` | `docker ps --format '{{.Names}}'` to list                                                                     |

## Tear Down

```powershell
supabase stop --no-backup    # stop containers, preserve volumes
supabase stop                # stop + remove volumes (full reset)
```

After full stop, `supabase start` re-applies all migrations and `supabase/seed.sql` is **not** auto-applied — run it manually (Step 6).

## Container Names Reference

For Docker exec commands, the project name is the folder name with non-alphanumerics replaced by `-`. In this repo:

- `supabase_db_Sistema-clinica-m-dica` — Postgres
- `supabase_auth_Sistema-clinica-m-dica` — GoTrue
- `supabase_rest_Sistema-clinica-m-dica` — PostgREST
- `supabase_studio_Sistema-clinica-m-dica` — Supabase Studio UI
- `supabase_storage_Sistema-clinica-m-dica` — Storage API
- `supabase_kong_Sistema-clinica-m-dica` — API gateway (port 54321)

List all: `docker ps --format '{{.Names}}'`.
