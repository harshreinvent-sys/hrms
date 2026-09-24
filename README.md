# HRMS — HR Management System (MVP)

A full-stack HR register: React frontend, Express + TypeScript API, PostgreSQL (Supabase) via Prisma, JWT authentication, and **backend-enforced role- and object-level authorization**.

```
frontend/   React 19 + Vite + TypeScript + Tailwind + TanStack Query      → http://localhost:5173
backend/    Express + TypeScript + Prisma + Zod + pino                      → http://localhost:4000
postman/    Collection with the six mandatory authorization scenarios
docs/       spec.md (the brief), AUTHORIZATION.md, DECISIONS.md, PROGRESS.md, AI_LOG.md
```

The authorization model lives in one file — [`backend/src/policies/employeePolicy.ts`](backend/src/policies/employeePolicy.ts) — and is described in prose in [`docs/AUTHORIZATION.md`](docs/AUTHORIZATION.md). Nothing else in the backend branches on a user's role.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **20 or newer** | developed on 26 |
| npm | 10 or newer | ships with Node |
| PostgreSQL | any 14+ | a **Supabase** project is what this was built and tested against; any Postgres with two connection strings works |

No Docker. No local database process — the app connects to the hosted database.

## Installation

```bash
git clone https://github.com/harshreinvent-sys/hrms.git
cd hrms
```

```bash
cd backend && npm install
```

```bash
cd ../frontend && npm install
```

> On npm 11, `backend` may report install scripts that were skipped. Prisma and bcrypt need theirs:
> ```bash
> npm install-scripts approve @prisma/client prisma @prisma/engines esbuild bcrypt
> ```
> Older npm runs them automatically.

## Environment variables

Templates are committed; real files are git-ignored. Copy and fill:

```bash
cp backend/.env.example backend/.env
```
```bash
cp backend/.env.test.example backend/.env.test
```
```bash
cp frontend/.env.example frontend/.env
```

### `backend/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | **Pooled** connection (Supabase: port 6543, Transaction mode). Must carry `?pgbouncer=true`. The template also sets `connection_limit=15&pool_timeout=30` — keep them; the default Prisma pool (9) exhausts under normal frontend use against a remote pooler. |
| `DIRECT_URL` | **Direct** connection (port 5432). Used by `prisma migrate`. |
| `JWT_SECRET` | ≥ 32 characters. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_EXPIRES_IN` | Access-token lifetime, default `30m` |
| `PORT` | default `4000` |
| `CORS_ORIGIN` | Comma-separated browser origins, default `http://localhost:5173` |
| `LOG_LEVEL` | `silent \| fatal \| error \| warn \| info \| debug \| trace`, default `info` |

The environment is validated at boot ([`backend/src/config/env.ts`](backend/src/config/env.ts)); a missing or malformed value stops the server with a message naming it.

### `backend/.env.test`

Same variables, but **both** URLs are the direct connection with `?schema=test` appended. The test runner resets and re-seeds that schema on every run and refuses to start unless both URLs contain `schema=test`, so it can never touch your real data. (Why direct and not pooled: Supabase's pooler rejects the option Prisma uses to select a schema — see `docs/DECISIONS.md` D-016.)

### `frontend/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the API, default `http://localhost:4000/api` |

## Database setup

From `backend/`:

```bash
npx prisma migrate deploy
```
Applies `prisma/migrations/20260924072540_init/migration.sql`: the `User` and `Employee` tables, indexes, foreign keys, and the `employee_id_seq` sequence that generates public ids (`EMP100`, `EMP101`, …).

```bash
npx prisma db seed
```
Creates 16 employees across five departments and a login for each. Idempotent — safe to re-run to reset the five known passwords.

Schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). `User` ↔ `Employee` is 1:1 (`User.employeeId`, unique); `Employee.managerId` is a self-relation; `role` lives on `User` and is exposed on the employee API response.

## Backend startup

From `backend/`:

```bash
npm run dev
```
Starts on `http://localhost:4000` with hot reload. `GET /health` needs no token.

Other scripts:

| Command | Does |
|---|---|
| `npm run build` then `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | `tsc` over source **and** tests |
| `npm run lint` | ESLint |
| `npm test` | Unit + integration tests (see *Tests* below) |
| `npm run test:unit` | The database-free tests only |

## Frontend startup

From `frontend/`, with the backend running:

```bash
npm run dev
```
Opens on `http://localhost:5173`. `npm run build` produces `dist/`; `npm run lint` runs oxlint.

## Test users

Password for all five: **`Password@123`**

| Email | Role | Employee ID | Reports to | Sees |
|---|---|---|---|---|
| `admin@company.com` | HR / Admin | EMP000 | — | everyone |
| `manager@company.com` | Manager | EMP010 | EMP000 | self + EMP001 + EMP002 |
| `employee1@company.com` | Employee | EMP001 | EMP010 | self |
| `employee2@company.com` | Employee | EMP002 | EMP010 | self |
| `employee3@company.com` | Employee | EMP003 | EMP000 — **outside** the manager's team | self |

Eleven more non-login employees (EMP004–EMP009, EMP011–EMP015) fill out the departments; two of them are `INACTIVE`. The login page has a collapsible "Demo accounts" list.

## API documentation

- **Swagger UI:** `http://localhost:4000/api/docs` — public, no token needed. Log in via `POST /auth/login`, click **Authorize**, paste the token, and every other route is callable from the page.
- **Raw OpenAPI 3.0:** `http://localhost:4000/api/docs.json` — the source is the hand-written [`backend/openapi.yaml`](backend/openapi.yaml).
- **Postman:** import [`postman/HRMS.postman_collection.json`](postman/HRMS.postman_collection.json). Run folder **0** (logs in as three users and stores tokens), then folder **1** (the six mandatory scenarios, each with a status-code assertion), then folder **2** (the extra rules).

### Endpoints

All under `/api`; all require `Authorization: Bearer <token>` except login and docs.

| Method | Path | Who | Notes |
|---|---|---|---|
| `POST` | `/auth/login` | anyone | `{ token, expiresIn, user }`. Unknown email and wrong password return the **identical** 401. |
| `POST` | `/auth/logout` | any role | 204. Tokens are stateless; the client discards its copy. |
| `GET` | `/me` | any role | The caller's own record — id taken from the token. |
| `GET` | `/employees` | any role | Scoped **in the database query** to what the caller may see. `?search=&department=&status=&page=&limit=` filters narrow that scope, never widen it. |
| `GET` | `/employees/{id}` | any role | See the 403 / 404 rule below. |
| `POST` | `/employees` | ADMIN | 201. Creates the employee **and** their login in one transaction; id from the sequence. |
| `PUT` | `/employees/{id}` | per field | Partial update. Any submitted field the caller may not change → **403 naming it**, nothing applied. |
| `DELETE` | `/employees/{id}` | ADMIN | 204, **soft** delete: `status = INACTIVE` and the login disabled. |
| `GET` | `/dashboard/stats` | any role | `{ total, active, inactive, byDepartment[] }`, scoped like the list. |

Error body everywhere: `{ "error": { "code", "message", "details"? } }`.

## Authorization test scenarios

The six mandatory scenarios from the brief, with the extra rules the implementation enforces. Every row is an automated test in [`backend/tests/integration/authorization.test.ts`](backend/tests/integration/authorization.test.ts) (the mandatory ones are tagged `[Spec Test n]`) and a request in the Postman collection.

| # | Login as | Request | Expected | Why |
|---|---|---|---|---|
| **1** | employee1 | `GET /api/employees/EMP001` | **200** | own record |
| **2** | employee1 | `GET /api/employees/EMP002` | **403** | another employee; the body contains no employee data |
| **3** | employee1 | `POST /api/employees` | **403** | only ADMIN creates; nothing is written |
| **4** | admin | `GET /api/employees/EMP002` | **200** | ADMIN sees everyone |
| **5** | admin | `POST /api/employees` | **201** | `Location` header; the new login works immediately |
| **6** | manager | `GET /api/employees/EMP003` | **403** | EMP003 reports to EMP000, not to the manager |
| | manager | `GET /api/employees/EMP001` | 200 | direct report |
| | employee1 | `PUT /api/employees/EMP002` | 403 | object-level |
| | employee1 | `PUT /api/employees/EMP001 { "role": "ADMIN" }` | 403 | field-level: `details: [{ path: "role" }]`; also for `managerId`, `status` |
| | employee1 | `PUT /api/employees/EMP001 { "phone": … }` | 200 | the one field an employee may change |
| | manager | `PUT /api/employees/EMP001 { "designation": … }` | 200 | permitted on a direct report |
| | manager | `PUT /api/employees/EMP001 { "phone": … }` | 403 | not permitted on a report |
| | employee1 | `GET /api/employees` | 200, one row | scoping in SQL |
| | manager | `GET /api/employees` | 200, self + team | `EMP003` never appears, even with `?search=` |
| | anyone | no / expired / tampered token | 401 | |
| | anyone | token of a user since deactivated | 401 | `isActive` re-checked on every request |

**403 vs 404.** Object-level denial is always **403**. An `ADMIN` asking for an id that does not exist gets **404**. Any other role asking for an id outside their scope gets **403 whether or not it exists**, with a body identical to the forbidden-real case — so a caller cannot map which ids exist by comparing responses. (`docs/DECISIONS.md` D-005.)

**Identity.** The caller's id and role come only from the verified JWT and are re-read from the `User` row on every request. No employee id, role, or user id from a request body or query is ever used to decide who is calling.

## Tests

From `backend/`:

```bash
npm run test:unit
```
46 tests, no database: every branch of the authorization policy and the error translator.

```bash
npm test
```
Adds 116 integration tests through the real HTTP stack against the `test` schema: auth (17), authorization (57, including the six above), employee behaviour (30), dashboard (6). The run first rebuilds the `test` schema **from the migration files** and seeds it, so it also verifies the migration. Expect 2–4 minutes against a remote database.

> If you run `npm test` from an AI coding agent, Prisma's safety guard stops the schema reset and asks for explicit consent. From a normal terminal it does not.

## Project structure

```
backend/src/
  app.ts                  Express app (no listener) — tests import this
  server.ts               listen() + graceful shutdown
  config/env.ts           Zod-validated environment
  middleware/             authenticate · validate · errorHandler · requestLogger
  policies/employeePolicy.ts   ALL authorization rules
  modules/auth            login, logout
  modules/employees       routes → controller → service; schemas; DTO
  modules/dashboard       scoped stats
  utils/                  AppError, jwt, password, prisma, logger
backend/tests/
  unit/                   policy + error handler (no DB)
  integration/            supertest against the test schema
frontend/src/
  api/                    axios client + interceptors, typed endpoints
  auth/                   token store, AuthContext, ProtectedRoute, RoleGate
  components/             Button, FormField, Table, Modal, Badge, …
  pages/                  Login, Dashboard, EmployeeList, EmployeeDetail, EmployeeForm, MyProfile
  lib/permissions.ts      client mirror of the policy — cosmetic; the API enforces
```

## Design notes worth knowing

- **One policy file.** `canView`, `canCreate`, `canDelete`, `discloseMissing`, `updatableFields`, `scopeWhere` are pure functions over `{ employeeId, role }` and `{ id, managerId }`. Services call them before touching Prisma; lists and the dashboard AND the policy's `where` fragment into the SQL rather than filtering in JavaScript.
- **Mass assignment.** `PUT` bodies are `.strict()` (unknown keys → 400), then every key is checked against `updatableFields`; the request is rejected wholesale if any fails. `req.body` never reaches Prisma.
- **Soft delete.** `DELETE` keeps the row, sets `INACTIVE`, disables the login; a live token stops working on its next request. An admin cannot deactivate themself (400).
- **Passwords.** bcrypt, cost 12. Login compares against a real dummy hash when the email is unknown so timing does not reveal existence.
- **Frontend guards are cosmetic.** Locked fields are shown disabled with a note rather than hidden; the form sends only changed *and* permitted fields; when the server still refuses, its `details` name the field in the UI.
- **UI.** Deliberately not a stock dashboard: warm paper and ink, one terracotta accent, hairline rules instead of shadows, a serif for headings and a monospace for ids. Usable at phone width.

Every non-obvious choice is a numbered entry in [`docs/DECISIONS.md`](docs/DECISIONS.md); the build history, including mistakes and how they were caught, is in [`docs/AI_LOG.md`](docs/AI_LOG.md).

## Known limitations

- **Latency.** Against Supabase from a distant machine each request costs 2–7 s (network round trips + bcrypt on login). Loading states cover it; hosting the API near the database is the fix.
- **No refresh tokens, no server-side revocation.** 30-minute access tokens; logout is client-side. A deactivated user is still cut off immediately because `isActive` is re-checked per request.
- **Two accepted `npm audit` findings** in `backend`: `@mapbox/node-pre-gyp` (bcrypt's install-time downloader, not runtime) and `@prisma/config` (no fix compatible with Prisma 6.19).
- **Frontend bundle** is one ~510 kB chunk; code-splitting is a follow-up.
- **Department** is a free-text column, not an entity.
