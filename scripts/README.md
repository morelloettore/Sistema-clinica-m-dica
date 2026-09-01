# Dev Scripts — Clinica Medica

PowerShell scripts to activate / run the full stack locally (Windows). No extra
installs needed beyond Docker Desktop + Supabase CLI + pnpm.

| Script               | What it does                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start-all.ps1`      | One-shot: Docker → Supabase backend (DB, Auth, REST, Edge Functions, Studio) → Vue dev server. Frontend stays in the foreground; Ctrl+C stops it. |
| `start-backend.ps1`  | Supabase only. Idempotent; applies migrations 002/003/004 fixes + seed on every run.                                                              |
| `start-frontend.ps1` | `pnpm install` (if needed) + starts the Vite dev server.                                                                                          |
| `run-tests.ps1`      | Full test suite: lint + typecheck + 174 vitest tests + SQL suites (business_rules, rls_policies) + edge-fn probe.                                 |
| `stop-all.ps1`       | `supabase stop` (with or without wiping volumes).                                                                                                 |
| `reset-db.ps1`       | Destructive: wipe all Supabase data, re-apply migrations 001→003, re-seed. **Asks for confirmation.**                                             |
| `check.ps1`          | Health check for all three layers (Docker, Supabase APIs, frontend ports).                                                                        |
| `lib/Clinica.psm1`   | Shared helpers (binary/CLI resolution, SQL runner, docker daemon bootstrap).                                                                      |

## Run from the repo root

```powershell
# Full stack (blocking; frontend in foreground)
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1

# Backend only
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1

# Frontend only
powershell -ExecutionPolicy Bypass -File scripts\start-frontend.ps1

# Health check
powershell -ExecutionPolicy Bypass -File scripts\check.ps1

# Stop Supabase (keep volumes)
powershell -ExecutionPolicy Bypass -File scripts\stop-all.ps1 -KeepVolumes

# Full test suite (lint + typecheck + web tests + SQL + edge probe)
powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1

# Destructive reset (type RESET to confirm)
powershell -ExecutionPolicy Bypass -File scripts\reset-db.ps1
```

## Via pnpm (same thing)

```bash
pnpm up:start     # = start-all.ps1
pnpm up:backend   # = start-backend.ps1
pnpm up:frontend  # = start-frontend.ps1
pnpm up:check     # = check.ps1
pnpm up:reset     # = reset-db.ps1
pnpm up:stop      # = stop-all.ps1
pnpm up:test      # = run-tests.ps1 (roda TODOS os testes: web + SQL + edge)
```

## Expected URLs after `up:start`

| What                | URL                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Web app (dev)       | http://localhost:3000                                                                                            |
| Supabase API        | http://127.0.0.1:54321                                                                                           |
| Supabase REST       | http://127.0.0.1:54321/rest/v1/                                                                                  |
| Edge Functions      | http://127.0.0.1:54321/functions/v1/{book-appointment, cancel-appointment, create-medical-record, assign-doctor} |
| Supabase Studio     | http://127.0.0.1:54323                                                                                           |
| Mailpit (email dev) | http://127.0.0.1:54324                                                                                           |

## Demo logins

| Email                  | Password       | Role     |
| ---------------------- | -------------- | -------- |
| admin@clinica.local    | admin123456    | admin    |
| doctor@clinica.local   | doctor123456   | doctor   |
| employee@clinica.local | employee123456 | employee |
| patient@clinica.local  | patient123456  | patient  |

## Notes / gotchas

- Docker daemon on Windows after reboot: the scripts bootstrap `com.docker.service`
  automatically (`sc start`), so `up:start` recovers from a cold boot. It waits up
  to ~90s.
- `supabase start` serves Edge Functions automatically via the `edge-runtime`
  container (no separate `functions serve` needed). The 401s you may see when
  probing without a JWT mean the runtime is up and enforcing auth.
- `start-backend.ps1` re-applies `002_fix_audit_trigger.sql` and
  `003_fix_handle_new_user.sql` after a fresh `supabase start`, then runs
  `supabase/seed.sql`. All are idempotent, safe to re-run.
- `apps/web/.env` is auto-created from the `supabase start` output if missing.
