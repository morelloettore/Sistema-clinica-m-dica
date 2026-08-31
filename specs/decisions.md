# Architectural Decisions — Sistema Clínica Médica

## 1. ADR-001: Supabase as Backend

### Decision
Use Supabase (PostgreSQL + Auth + PostgREST + Edge Functions + RLS) as the entire backend.

### Status
Accepted

### Context
We need a backend for a medical clinic management system. Options considered:
1. **Supabase** — Managed PostgreSQL with Auth, auto-generated REST API, RLS, Edge Functions.
2. **Custom backend** (Node.js/Express + Prisma + custom auth) — Full control, more code.
3. **Firebase** — Google ecosystem, NoSQL, different paradigm.
4. **Strapi/Laravel** — CMS/Admin frameworks.

### Rationale
- **RLS is the killer feature**: Row-level security at the database level eliminates entire classes of authorization bugs. No custom middleware to forget.
- **Zero API code for CRUD**: PostgREST auto-generates REST endpoints from schema. 80% of our operations are standard CRUD.
- **Auth built-in**: JWT-based auth with email verification, password reset, session management — all handled.
- **TypeScript Edge Functions**: Complex business logic in Deno TypeScript, same language as frontend.
- **Cost-effective**: Free tier covers development and early production. No servers to manage.
- **Realtime**: Built-in WebSocket subscriptions for live dashboard updates.
- **Single ecosystem**: Auth + DB + API + Realtime in one platform. Less integration complexity.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Custom Node.js + Prisma** | Would require writing auth, RLS equivalent, API layer. 3-5x more code. More maintenance. |
| **Firebase** | NoSQL doesn't fit relational data model (patients ↔ doctors ↔ appointments). No RLS equivalent. Vendor lock-in stronger. |
| **Strapi** | CMS-oriented, not suited for complex business logic. Limited RLS capabilities. |
| **Supabase + separate auth (Auth0/Clerk)** | Unnecessary complexity. Supabase Auth is sufficient for our needs. |

### Consequences
- **Positive**: Dramatically less backend code. RLS provides security by default. Faster development.
- **Negative**: Vendor dependency on Supabase. Edge Functions have cold start. Less control over API behavior.
- **Mitigations**: Supabase is open-source (self-hostable). Edge Function cold starts < 500ms. PostgREST covers 95% of needs.

---

## 2. ADR-002: Monorepo with pnpm Workspaces + Turborepo

### Decision
Organize the project as a monorepo with `apps/web` (Vue frontend) and `packages/shared` (Zod schemas + types). Use pnpm workspaces for dependency management and Turborepo for build orchestration.

### Status
Accepted

### Context
Frontend and backend (Edge Functions) share validation logic and TypeScript types. Options:
1. **Monorepo** (pnpm workspaces + Turborepo)
2. **Separate repos** with npm package publishing
3. **Copy-paste** schemas between projects
4. **Git submodules**

### Rationale
- **Single source of truth** for Zod schemas and TypeScript types. No drift between frontend and Edge Functions.
- **Fast builds**: Turborepo caches builds and only rebuilds changed packages.
- **pnpm**: Disk-efficient (hardlinks), fast, strict dependency resolution.
- **Shared CI/CD**: One repo, one pipeline, one deployment.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Separate repos + npm** | Schema drift. Release coordination overhead. More CI/CD complexity. |
| **Copy-paste** | Guaranteed divergence. Unmaintainable. |
| **Git submodules** | Poor developer experience. Complex merge workflows. |
| **Nx** | Heavier than needed. Better for larger teams/projects. |

### Consequences
- **Positive**: Schema changes propagate automatically. Single `pnpm install`. Turbo caching speeds up builds.
- **Negative**: All changes in one repo. Larger clone size (minimal for our scale).

---

## 3. ADR-003: Zod for Validation (Shared Package)

### Decision
Use Zod schemas as the single validation layer, shared between Vue frontend and Supabase Edge Functions via `packages/shared`.

### Status
Accepted

### Context
Input validation is needed on both client (UX) and server (security). Options:
1. **Zod** — TypeScript-first, inference, composable schemas.
2. **Yup** — Similar to Zod, less TypeScript-native.
3. **Joi** — Mature, but verbose and less TypeScript-friendly.
4. **Custom validation** — Hand-written checks.
5. **DB-only validation** — Rely on PostgreSQL constraints + CHECK.

### Rationale
- **TypeScript inference**: `z.infer<typeof schema>` generates TypeScript types from schemas. No manual type definitions.
- **Composable**: `z.object()`, `z.string()`, `.refine()`, `.transform()` — rich API.
- **Shared**: Same schema runs in browser and Deno Edge Functions.
- **Error messages**: Built-in i18n support for pt-BR messages.
- **Lightweight**: ~12KB gzipped.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Yup** | Less TypeScript-native. Infer capabilities weaker. |
| **Joi** | Heavier. Verbose. Poor TypeScript inference. |
| **Custom validation** | Duplicated logic. Error-prone. No ecosystem. |
| **DB-only** | Late error detection. Poor UX (errors only at save time). No client-side feedback. |

### Consequences
- **Positive**: Single validation logic. TypeScript types auto-derived. Excellent DX.
- **Negative**: Another dependency. Slight learning curve for Zod-specific syntax.

---

## 4. ADR-004: Vue 3 + TypeScript + Vite

### Decision
Frontend uses Vue 3 (Composition API) with TypeScript strict mode and Vite as the build tool.

### Status
Accepted

### Context
Frontend framework choice. Options:
1. **Vue 3** — Progressive, Composition API, good TypeScript support.
2. **React 19** — Largest ecosystem, Server Components.
3. **Svelte 5** — Compiler-based, minimal runtime.
4. **Angular 17** — Full framework, opinionated.

### Rationale
- **Vue 3 Composition API**: Reactive system with `ref()`, `computed()`, `watch()` — clean and testable.
- **TypeScript support**: Official Vue + TypeScript support. `defineComponent`, `PropType`, template type checking.
- **Vite**: Sub-second HMR. Fast builds. Native ES modules.
- **Smaller bundle**: Vue 3 is ~33KB gzipped vs React ~45KB.
- **Team familiarity**: Team has Vue experience.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **React 19** | Server Components add complexity we don't need (SPA, not SSR). Heavier. |
| **Svelte 5** | Smaller ecosystem. Fewer UI libraries. Less enterprise adoption. |
| **Angular 17** | Overkill for our scope. Steeper learning curve. Heavier framework. |

### Consequences
- **Positive**: Fast development. Excellent DX with Vite HMR. Good TypeScript story.
- **Negative**: Smaller ecosystem than React. Fewer third-party components.

---

## 5. ADR-005: Pinia for State Management

### Decision
Use Pinia for client-side state management.

### Status
Accepted

### Context
Vue 3 needs a state management solution for caching server data and managing UI state. Options:
1. **Pinia** — Official Vue state library. Successor to Vuex.
2. **Vuex 4** — Legacy Vue state library.
3. **No library** — Use Vue's `reactive()`/`ref()` directly.
4. **XState** — Finite state machine library.

### Rationale
- **Official**: Vue team recommends Pinia. Built into Vue DevTools.
- **TypeScript-first**: Excellent type inference. No mutations, only actions.
- **Flat structure**: No nested modules. Simpler than Vuex.
- **DevTools**: Time-travel debugging, store inspection.
- **SSR-friendly**: If we ever need SSR.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Vuex 4** | Legacy. Mutations are boilerplate. Worse TypeScript support. |
| **No library** | Manual caching logic. Duplicated fetch patterns. No DevTools. |
| **XState** | Overkill for our needs. Complex API for simple CRUD caching. |

### Consequences
- **Positive**: Clean store definitions. Good DevTools. Official support.
- **Negative**: One more dependency. Stores need `$reset()` plugin for logout.

---

## 6. ADR-006: Tailwind CSS for Styling

### Decision
Use Tailwind CSS for all styling.

### Status
Accepted

### Context
Need a CSS solution for the frontend. Options:
1. **Tailwind CSS** — Utility-first CSS framework.
2. **Scoped Vue styles** — Component-scoped CSS.
3. **BEM/CSS Modules** — Class-based CSS architecture.
4. **UI library** (Vuetify, PrimeVue, Naive UI) — Component library.
5. **Chakra UI / Headless UI** — Unstyled components + Tailwind.

### Rationale
- **Rapid prototyping**: Utility classes speed up UI development.
- **No CSS bloat**: Only used classes are included in production.
- **Design consistency**: Built-in spacing, color, and typography scales.
- **Mobile-first**: Responsive utilities (`sm:`, `md:`, `lg:`).
- **Dark mode**: Built-in `dark:` variants (if needed).

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Scoped styles** | More CSS to write. Inconsistent spacing/colors across components. |
| **Vuetify** | Heavy (~200KB). Opinionated design. Hard to customize beyond Material Design. |
| **PrimeVue** | Heavy. Less flexibility. |
| **Chakra UI** | React-oriented. Vue equivalent less mature. |
| **Plain CSS** | Inconsistent design. No design system. |

### Consequences
- **Positive**: Fast UI development. Consistent design. Small bundle.
- **Negative**: HTML can get verbose with utility classes. Learning curve for Tailwind.

---

## 7. ADR-007: RLS as Primary Authorization

### Decision
Row-Level Security (RLS) is the **primary** authorization mechanism. Frontend route guards and UI hiding are UX convenience only, not security boundaries.

### Status
Accepted

### Context
Authorization must be enforced at multiple points. Where should the primary enforcement be?

Options:
1. **RLS (database level)** — Policies on every table.
2. **API middleware** — Check permissions in each API handler.
3. **Frontend only** — Route guards + hidden UI elements.
4. **Combination** — RLS + API middleware + frontend.

### Rationale
- **Defense in depth**: RLS is the last line of defense. Even if frontend/API has bugs, RLS protects data.
- **No bypass**: PostgREST queries always go through RLS. No way to skip it.
- **Testable**: SQL-based tests can verify policies.
- **Automatic**: No developer can forget to add authorization check.

### Implementation
- Frontend guards: Redirect unauthorized users. UX convenience.
- Edge Functions: Validate `auth.uid()` for business logic. Security + UX.
- RLS policies: **Authoritative** security boundary.

### Consequences
- **Positive**: Eliminates IDOR vulnerabilities. Authorization bugs caught at DB level.
- **Negative**: RLS policy errors are hard to debug. Performance impact (minimal with proper indexing).
- **Mitigation**: Test all policies with SQL scripts. Use helper functions for complex checks.

---

## 8. ADR-008: Offset Pagination (Not Cursor-Based)

### Decision
Use offset-based pagination (`limit` + `offset`) for all list views. Reserve cursor-based pagination for future scale if needed.

### Status
Accepted

### Context
Need pagination for all list views (appointments, patients, doctors, audit logs). Options:
1. **Offset pagination** — `?limit=20&offset=40`
2. **Cursor pagination** — `?cursor=abc123&limit=20`
3. **Keyset pagination** — `?created_at=gt.2026-01-01&limit=20`
4. **No pagination** — Load all (infinite scroll).

### Rationale
- **Simple**: Offset/limit is universally understood. PostgREST supports it natively.
- **Page numbers**: Users expect page numbers (Page 1, 2, 3...).
- **Sufficient for scale**: Our data volumes (thousands, not millions) don't need cursor-based.
- **Total count**: PostgREST can return total count with `Prefer: count=exact`.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Cursor-based** | Overkill. No infinite scroll. More complex implementation. |
| **Keyset** | No page numbers. User experience worse for admin dashboards. |
| **No pagination** | Performance degrades with large datasets. |

### Consequences
- **Positive**: Simple implementation. Page numbers. Good enough for MVP.
- **Negative**: Offset can be slow for very large offsets (>10000). Inconsistent results if data changes between pages.
- **Mitigation**: Cap at 1000 records. Use `order=created_at.desc` for stable ordering.

---

## 9. ADR-009: Edge Functions for Complex Operations Only

### Decision
Use Supabase Edge Functions **only** for multi-step operations requiring transactions (booking, cancellation). All other operations go through PostgREST directly.

### Status
Accepted

### Context
Some operations require multiple steps (check → insert → update → audit). Should we:
1. **Edge Functions** for complex operations, PostgREST for simple CRUD.
2. **Edge Functions for everything** — Route all requests through functions.
3. **PostgreSQL functions/triggers** — Handle all logic in the database.

### Rationale
- **PostgREST handles 80%**: Simple CRUD (SELECT, INSERT, UPDATE, DELETE) needs no custom code.
- **Transactions needed for 20%**: Booking = check slot → check conflicts → insert → decrement → audit. This requires a transaction.
- **Edge Functions in TypeScript**: Same language as frontend. Easier to maintain than PL/pgSQL.
- **Separation of concerns**: Complex business logic isolated in named functions.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Functions for everything** | Unnecessary wrapper around simple queries. Cold start penalty on every request. |
| **PL/pgSQL only** | Harder to test. Different language. Less familiar to frontend team. |

### Consequences
- **Positive**: Minimal backend code. Clear separation. TypeScript everywhere.
- **Negative**: Cold starts on Edge Functions (~200-500ms). Must handle errors in both PostgREST and Edge Functions.

---

## 10. ADR-010: UUID Primary Keys (Not Sequential Integers)

### Decision
Use UUIDs (v4, random) for all primary keys.

### Status
Accepted

### Context
Primary key format for all tables. Options:
1. **UUID v4** — Random 128-bit. Globally unique.
2. **Sequential integers** — Auto-increment. Predictable.
3. **UUID v7** — Time-ordered. Better for indexes.
4. **ULID** — Time-ordered, Crockford Base32.

### Rationale
- **Security**: UUIDs are unguessable. Prevents IDOR via sequential ID guessing.
- **Distributed**: No central ID generator needed. Client-side UUID generation possible.
- **PostgreSQL native**: `gen_random_uuid()` built-in. No extensions needed.
- **No collision risk**: 2^122 possible values.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Sequential integers** | Guessable IDs → IDOR risk. Requires auto-increment. |
| **UUID v7** | Better for indexes but requires external library. Not native to PostgreSQL. |
| **ULID** | Not native to PostgreSQL. External library needed. |

### Consequences
- **Positive**: Secure IDs. No IDOR risk. Distributed generation.
- **Negative**: 16 bytes per PK (vs 4 bytes for int). Index size slightly larger. Not human-readable.
- **Mitigation**: Index performance difference negligible at our scale.

---

## 11. ADR-011: Soft Delete for Medical Records

### Decision
Medical records use soft delete (`is_deleted = true`). All other entities use hard delete.

### Status
Accepted

### Context
Medical records are legally sensitive. Options:
1. **Soft delete only** — `is_deleted` flag. Record preserved.
2. **Hard delete** — Physical row removal.
3. **Archival** — Move to separate archive table.

### Rationale
- **Legal compliance**: Medical records must be preserved for legal/audit purposes.
- **Audit trail**: Deleted records should still be auditable by admins.
- **Recovery**: Admins can undelete if needed (future feature).
- **RLS integration**: Filter `is_deleted = false` in RLS policies.

### Consequences
- **Positive**: Legal compliance. Audit trail preserved.
- **Negative**: Table grows indefinitely. Queries need `WHERE is_deleted = false`.
- **Mitigation**: Index on `is_deleted` for filtered queries. Future: partition by date.

---

## 12. ADR-012: CPF Validation in Zod (Client + Server)

### Decision
Validate CPF checksum (mod-11 algorithm) in Zod schemas, enforced both client-side and in Edge Functions.

### Status
Accepted

### Context
Brazilian CPF (tax ID) has a checksum algorithm. Where to validate?

Options:
1. **Client + Server (Zod)** — Validate in both places.
2. **Client only** — UX feedback, but server trusts DB constraints.
3. **Server only** — Late error detection.
4. **DB constraint** — PostgreSQL CHECK function.

### Rationale
- **UX**: Client-side validation gives immediate feedback.
- **Security**: Server-side validation prevents bypass.
- **Single logic**: Same Zod schema runs in both places.

### Implementation
```typescript
export const cpfSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido')
  .refine((cpf) => validateCpfChecksum(cpf), 'CPF inválido');
```

### Consequences
- **Positive**: Invalid CPFs caught early. Consistent validation.
- **Negative**: CPF algorithm code to maintain. Slight complexity.

---

## 13. ADR-013: Vitest over Jest

### Decision
Use Vitest as the test runner instead of Jest.

### Status
Accepted

### Context
Need a test runner for unit and integration tests. Options:
1. **Vitest** — Vite-native test runner. Fast. ESM-first.
2. **Jest** — Industry standard. Mature.
3. **Mocha** — Flexible. Older.

### Rationale
- **Vite-native**: Same config as Vite. No separate transform config.
- **ESM-first**: Native ES modules support. No transform overhead.
- **Fast**: Uses Vite's dev server for transforms. Sub-second test startup.
- **Compatible API**: `describe`, `it`, `expect` — same as Jest. Easy migration.
- **Vue ecosystem**: Official Vue testing tools use Vitest.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Jest** | Slower. ESM support requires config. Separate transform pipeline. |
| **Mocha** | Less batteries-included. Requires more setup. |

### Consequences
- **Positive**: Fast tests. Zero config with Vite. Same API as Jest.
- **Negative**: Newer tool. Slightly less documentation than Jest.

---

## 14. ADR-014: Date/Time Handling

### Decision
Use `date` and `time` PostgreSQL types for schedule/appointment dates and times. Store dates as `YYYY-MM-DD` strings in TypeScript. Use `TIMESTAMPTZ` for `created_at`/`updated_at`.

### Status
Accepted

### Context
Date handling is complex. Options:
1. **PostgreSQL date/time types** — Native `DATE`, `TIME`, `TIMESTAMPTZ`.
2. **ISO strings everywhere** — Store all dates as text.
3. **Unix timestamps** — Store as integers.
4. **date-fns / dayjs** — Client-side date library.

### Rationale
- **PostgreSQL types**: Type safety, date arithmetic, range queries.
- **No timezone issues**: `date` and `time` are timezone-agnostic. `TIMESTAMPTZ` handles timezones for creation timestamps.
- **Format**: DD/MM/YYYY in UI (pt-BR). YYYY-MM-DD in API. Consistent.

### Consequences
- **Positive**: Type-safe dates. Native DB operations. No timezone bugs.
- **Negative**: Need format conversion between API (ISO) and UI (pt-BR).

---

## 15. ADR-015: No Real-Time for MVP

### Decision
Use Supabase Realtime subscriptions only for critical dashboard updates (appointment list refresh). No real-time notifications or live collaboration for MVP.

### Status
Accepted

### Context
Supabase offers Realtime (WebSocket subscriptions). Should we use it extensively?

Options:
1. **Minimal Realtime** — Only for dashboard auto-refresh.
2. **Full Realtime** — Notifications, live updates, collaboration.
3. **Polling** — Refetch data every N seconds.

### Rationale
- **Complexity**: Full Realtime adds significant complexity (connection management, reconnection, state sync).
- **Medical context**: Not a chat app. Seconds don't matter for appointment management.
- **Manual refresh**: Users can refresh the page. Acceptable for MVP.
- **Future**: Realtime can be added later without architectural changes.

### Consequences
- **Positive**: Simpler implementation. Less WebSocket management.
- **Negative**: Users must manually refresh to see changes made by others.
- **Future**: Add Realtime for appointment list, doctor schedule, and admin dashboard.

---

## 16. ADR-016: Error Message i18n Strategy

### Decision
Error messages are hardcoded in pt-BR (Brazilian Portuguese). No i18n framework for MVP.

### Status
Accepted

### Context
The system is for Brazilian users. Should we support multiple languages?

Options:
1. **Hardcoded pt-BR** — Simple. Direct strings.
2. **i18n framework** (vue-i18n) — Multi-language support.
3. **Message constants** — Centralized error messages.

### Rationale
- **Scope**: Single market (Brazil). No immediate need for multi-language.
- **Simplicity**: No i18n framework overhead.
- **Consistency**: All messages in one language.

### Consequences
- **Positive**: Simple. Fast to implement.
- **Negative**: If internationalization needed later, refactor required.
- **Mitigation**: Error codes are machine-readable (English). Human messages are pt-BR. Could swap to i18n later.

---

## 17. ADR-017: No File Uploads in MVP

### Decision
No file uploads (profile photos, document scans) in MVP. All data is text-based.

### Status
Accepted

### Context
Medical systems often need document uploads. Should we include file storage?

Options:
1. **No uploads** — Text only for MVP.
2. **Supabase Storage** — Built-in file storage.
3. **External storage** (S3, Cloudinary) — Separate file storage.

### Rationale
- **Scope**: README specifies core clinic management, not document management.
- **Complexity**: File uploads add: storage, validation, virus scanning, CDN, access control.
- **Data model**: Medical records, appointments, and profiles don't require files in MVP.

### Consequences
- **Positive**: Simpler MVP. Faster delivery.
- **Negative**: No profile photos. No document attachments.
- **Future**: Add Supabase Storage for profile photos and medical documents.

---

## 18. ADR-018: Frontend Routing Structure

### Decision
Route structure follows role-based nesting: `/patient/*`, `/employee/*`, `/doctor/*`, `/admin/*`. Auth routes at `/login`, `/register`, `/forgot-password`.

### Status
Accepted

### Context
Four user roles need separate UI areas. How to structure routes?

Options:
1. **Role-based nesting** — `/patient/dashboard`, `/admin/audit`
2. **Flat with guards** — All routes at root, guard checks role
3. **Multi-app** — Separate Vue apps per role

### Rationale
- **Clear mental model**: URL reflects user's role context.
- **Lazy loading**: Each role's routes can be code-split.
- **Guard efficiency**: Parent route guard checks role once, child routes inherit.

### Consequences
- **Positive**: Clear URL structure. Role-based code splitting.
- **Negative**: Some route duplication (e.g., `/patient/profile` and `/doctor/profile`).

---

## 19. ADR-019: No Offline Support

### Decision
The system requires an active internet connection. No offline mode, service workers, or local caching.

### Status
Accepted

### Context
Medical clinic systems operate in clinics with internet. Options:
1. **Online only** — Simple SPA.
2. **Service Worker** — Cache assets for offline reading.
3. **PWA** — Full offline support with background sync.

### Rationale
- **Context**: Clinic management happens in-clinic with internet.
- **Data freshness**: Medical data must be current. Stale data is dangerous.
- **Complexity**: Offline support adds significant complexity (conflict resolution, sync).

### Consequences
- **Positive**: Simpler architecture. No sync conflicts.
- **Negative**: System unavailable offline. No PWA install.

---

## 20. ADR-020: Audit Logging Strategy

### Decision
Audit logs are created via PostgreSQL triggers (not application code). Triggers capture `auth.uid()`, old/new data, and timestamp. Audit logs are append-only (no update/delete policies).

### Status
Accepted

### Context
We need an audit trail for compliance. Where to generate audit entries?

Options:
1. **PostgreSQL triggers** — DB-level, always fires, cannot be bypassed.
2. **Application code** — Frontend/Edge Function inserts audit row.
3. **PostgreSQL extension** (pgAudit) — Advanced audit logging.

### Rationale
- **Trigger-based**: Cannot be bypassed by application code. Even direct SQL updates are logged.
- **Append-only**: No UPDATE or DELETE policies on `audit_logs`. Immutable.
- **`auth.uid()` available**: PostgreSQL `auth.uid()` function returns current user from JWT.
- **`SECURITY DEFINER`**: Trigger function runs as database owner, has access to `auth.uid()`.

### Alternatives Rejected

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Application code** | Developer can forget to insert audit row. Bypassable. |
| **pgAudit** | Overkill. Complex setup. Supabase doesn't support it natively. |

### Consequences
- **Positive**: Complete audit trail. Cannot be bypassed. Immutable.
- **Negative**: Trigger overhead on writes. JSON storage can grow.
- **Mitigation**: Index on `created_at`. Consider partitioning at scale.
