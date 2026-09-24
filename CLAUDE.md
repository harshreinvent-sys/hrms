# HR Management System — MVP (PERN)

HR Management System MVP (React frontend + Express API + PostgreSQL). Read the given instructions in `docs/spec.md` before planning any feature.
Primary evaluation focus: **backend authorization (role + object-level)**. Security correctness beats UI polish.

## Stack

- **Backend:** Node 20 + Express + TypeScript (`backend/`)
- **DB:** PostgreSQL on **Supabase** (hosted), **Prisma** ORM (schema, migrations, seed). No Docker.
- **Validation:** Zod (every request body, params, query)
- **Auth:** `jsonwebtoken` (access token, 30 min expiry) + `bcrypt` (cost 12)
- **API docs:** hand-written `backend/openapi.yaml` (OpenAPI 3.0) served by `swagger-ui-express` + `yaml` at `/api/docs`; raw spec at `/api/docs.json`
- **Logging:** `pino` + `pino-http`
- **Tests:** Jest + Supertest against a separate `test` schema in the same Supabase DB (`DATABASE_URL=...?schema=test`)
- **Frontend:** React + Vite + TypeScript + Tailwind + TanStack Query + React Router + React Hook Form + Zod (`frontend/`)

## Repo layout

```
docs/spec.md              # assessment brief — source of truth
postman/                  # exported collection with the 6 mandatory scenarios
backend/
  openapi.yaml            # API contract — Swagger UI reads this
  prisma/schema.prisma, migrations/, seed.ts
  src/
    app.ts                # express app (no listen) — imported by tests
    server.ts             # listen()
    config/env.ts         # Zod-validated env, fail fast on missing vars
    middleware/           # authenticate, errorHandler, validate, requestLogger
    policies/employeePolicy.ts   # ALL authorization rules live here
    modules/auth/         # routes, controller, service, schemas
    modules/employees/    # routes, controller, service, schemas
    modules/dashboard/
    utils/                # AppError, jwt helpers
  tests/                  # authorization.test.ts, auth.test.ts, employees.test.ts
frontend/
  src/
    api/                  # axios client + interceptors, typed endpoint functions
    auth/                 # AuthContext, ProtectedRoute, RoleGate
    components/           # reusable UI (Table, Modal, FormField, Badge, ...)
    pages/                # Login, Dashboard, EmployeeList, EmployeeDetail, EmployeeForm, MyProfile
    types/
```

## Commands

- DB: Supabase project, no local DB process. Connection strings in `backend/.env`.
- Backend: `cd backend && npm run dev` · `npm test` · `npx prisma migrate dev` · `npx prisma db seed`
- Frontend: `cd frontend && npm run dev`
- Before saying a task is done: run `npm run lint`, `npx tsc --noEmit`, and `npm test` in the affected package. All must pass.

## Supabase rules

- Supabase is used **only as a hosted PostgreSQL database**. Do NOT use Supabase Auth, `supabase-js`, Row Level Security, or Supabase storage. The spec requires our own JWT + bcrypt auth and backend-enforced authorization.
- The frontend never talks to Supabase directly — only to our Express API.
- Prisma needs two URLs in `backend/.env`:
  - `DATABASE_URL` = pooled connection (port 6543, append `?pgbouncer=true`) — used by the app
  - `DIRECT_URL` = direct connection (port 5432) — used by `prisma migrate`
  - In `schema.prisma`: `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`
- Test runs use the same URLs with `schema=test` so seed/reset never touches real data.

## API docs rules

- `backend/openapi.yaml` is the API contract. **Any route, request field, response field, or status code change must update it in the same slice.**
- Every protected route declares `security: [bearerAuth: []]` and documents 401, 403 (where applicable), 400 and 404.
- Keep the example values aligned with the seed users.

## Data model

- `Employee.id` is the public ID, a string like `EMP001` (used in URLs).
- `Employee.managerId` → self-relation to `Employee.id` (nullable).
- `User` ↔ `Employee` is 1:1 via `User.employeeId` (unique).
- `Role` enum: `ADMIN`, `MANAGER`, `EMPLOYEE`. `EmploymentStatus` enum: `ACTIVE`, `INACTIVE`.
- `Employee.email` and `User.email` are unique.

## Seed users (password for all: `Password@123`)

| Email | Role | Employee ID | Reports to |
|---|---|---|---|
| admin@company.com | ADMIN | EMP000 | — |
| manager@company.com | MANAGER | EMP010 | EMP000 |
| employee1@company.com | EMPLOYEE | EMP001 | EMP010 |
| employee2@company.com | EMPLOYEE | EMP002 | EMP010 |
| employee3@company.com | EMPLOYEE | EMP003 | EMP000 (outside manager's team) |

Add ~10 more non-login employees across departments so the dashboard and filters look real.

## Security rules — NON-NEGOTIABLE

1. **Identity comes only from the verified JWT** (`req.user = { userId, employeeId, role }`). Never trust an employee ID, role, or user ID from the body/query to decide who the caller is.
2. `authenticate` middleware on every route except `POST /api/auth/login` and `/api/docs`. It must also reject tokens whose user is now `isActive = false`.
3. **All authorization decisions go through `policies/employeePolicy.ts`.** No inline `if (role === ...)` in controllers or services.
   - `canView(actor, target)`: ADMIN → any · MANAGER → self or `target.managerId === actor.employeeId` · EMPLOYEE → self only
   - `canCreate(actor)` / `canDelete(actor)`: ADMIN only
   - `updatableFields(actor, target)`: ADMIN → all fields · MANAGER → self: phone; team: designation, department · EMPLOYEE → self: phone only · otherwise → none (403)
   - `scopeWhere(actor)`: returns the Prisma `where` clause for list/dashboard queries
4. **Object-level denial returns 403** consistently (documented in README). Unauthenticated → 401. Missing resource the actor *could* see → 404.
5. **List and dashboard queries are scoped in the DB query** via `scopeWhere(actor)`. Never fetch all and filter in JS.
6. **Mass assignment:** validate updates with Zod, then reject (403) any field not in `updatableFields`. Never pass `req.body` straight to Prisma.
7. **DELETE = soft delete:** set `status = INACTIVE` and `user.isActive = false`. Return 204.
8. Never return `passwordHash`. Use explicit Prisma `select`s / response DTOs.
9. Login errors are generic ("Invalid email or password"); same response for unknown email and wrong password.
10. Secrets and config only from `.env` (commit `.env.example`, never `.env`). CORS origin from env.

## API

```
POST   /api/auth/login        → { token, expiresIn, user }
POST   /api/auth/logout       → 204 (client discards token)
GET    /api/me                → current user's employee profile
GET    /api/employees         → scoped list; ?search=&department=&status=&page=&limit=
GET    /api/employees/:id
POST   /api/employees         → 201 (ADMIN) — creates Employee + User in one transaction
PUT    /api/employees/:id
DELETE /api/employees/:id     → 204 soft delete (ADMIN)
GET    /api/dashboard/stats   → { total, active, byDepartment[] }, scoped to actor
```

Error body shape everywhere: `{ "error": { "code": "FORBIDDEN", "message": "...", "details"?: [...] } }`.
Central `errorHandler` maps `AppError`, Zod errors (400), Prisma unique violations (409), and unknown errors (500, no stack trace in response; log it).

## Required tests (must always pass)

`tests/authorization.test.ts` covers the 6 mandatory scenarios from the spec plus:
- employee1 `PUT /employees/EMP002` → 403
- employee1 updating own `role` / `managerId` / `status` → 403
- manager `GET /employees/EMP003` → 403; manager `GET /employees/EMP001` → 200
- `GET /employees` as employee → only own record; as manager → self + team
- request without token → 401; expired/tampered token → 401
- token of a deactivated user → 401

**Never weaken, skip, or delete a test to make it pass.** Fix the code.

## Frontend rules

- Token stored in memory + `sessionStorage`; axios interceptor attaches it and on 401 clears auth and redirects to `/login`.
- Handle token expiry client-side too (decode `exp`, auto-logout).
- Role-based UI (hide Create/Delete, no list page for employees), but assume the API is the real guard.
- Show API error messages in the UI; loading and empty states on every data view.
- Must be usable at mobile width.

## Project docs — keep these current

| File | Owner | Update when |
|---|---|---|
| `docs/spec.md` | Read-only | Never edit — assessment brief |
| `docs/PROGRESS.md` | Claude | Tick items after each completed slice; update "Next" + blockers |
| `docs/DECISIONS.md` | Claude drafts, I approve | Any design choice (next `D-###`: context, decision, why, trade-off) |
| `docs/AUTHORIZATION.md` | Claude | Whenever a policy rule changes — must match `employeePolicy.ts` exactly |
| `docs/AI_LOG.md` | Claude (append-only) | End of every slice — see "AI log rules" below |
| `README.md` | Claude drafts at the end | Follow spec section order; every command must be real |

- **Start of every session:** read `docs/PROGRESS.md` and continue from "Next".
- **End of every slice:** append an AI_LOG.md entry, update PROGRESS.md, propose any DECISIONS.md entry, then suggest a commit message.
- If code and a doc disagree, stop and tell me. Don't silently change either.

### AI log rules (`docs/AI_LOG.md`)

- **Append-only.** Never edit or delete earlier entries; add a new entry to correct one.
- One entry per slice, newest at the bottom, numbered `AI-###`. Use this format:

```markdown
## AI-001 — <slice name> (<YYYY-MM-DD>)
**Prompt (summary):** what I asked for, in 1–2 lines
**Generated:** files created/changed (paths)
**Issues found:** bugs, security gaps, test failures you hit or I pointed out — and how each was fixed
**Human corrections:** anything I changed, rejected, or redirected (quote my instruction briefly). Write "None" if none.
**Verification:** exact commands run and results (e.g. `npm test` — 18/18 passed, `tsc` clean)
**Commit:** <hash or suggested message>
```

- Be honest and specific. Record your own mistakes (e.g. "first version of PUT skipped the object-level check; caught by authorization test"). Never make the log look cleaner than what happened.
- Only claim verification you actually ran in this session.

## Code navigation — CodeGraph

This repo is indexed by CodeGraph (`.codegraph/`, local SQLite, auto-syncs on file change). Setup: `npm i -g @colbymchenry/codegraph` → `codegraph install` → `codegraph init` in the repo root. Add `.codegraph/` to `.gitignore`.

- **Use `codegraph_explore` first** to find symbols, callers, and call paths. Fall back to Grep/Read only if it returns nothing useful.
- **Before changing any function, check its blast radius** with `codegraph_explore` and name every caller that's affected in your plan.
- **Security checks via the graph** (run at the end of every backend slice):
  - Every route handler in `modules/*/routes.ts` is reached through `authenticate` (except login and docs).
  - Every employee read/update/delete path calls a function from `policies/employeePolicy.ts` before touching Prisma.
  - Nothing outside `employeePolicy.ts` branches on `role`.
  - Report any path that breaks these rules before continuing.
- Don't read whole directories to "understand the codebase" — query the graph.

## Working style

- Plan mode first for anything touching more than one layer. Get the plan approved before coding.
- Build one vertical slice at a time; keep diffs small. Suggest a commit message after each slice.
- Don't add dependencies beyond this list without asking.
- Don't over-engineer: no refresh tokens, no microservices, no Redux. It's a  MVP.
