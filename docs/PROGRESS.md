# Progress

Plan: `~/.claude/plans/pasted-content-id-57f0-full-stack-vivid-wilkes.md` (approved 2026-09-24). One vertical slice at a time; each slice ends with a commit, an `AI_LOG.md` entry, and a tick here.

## Slices

- [x] **Slice 0 — Restructure + docs skeleton + tooling** — committed `bd4becf`
  - [x] CodeGraph installed (`@colbymchenry/codegraph` 1.6.0), `codegraph install --target claude --location local --yes`, `codegraph init` (33 files, 328 nodes)
  - [x] `CLAUDE.md` replaced with the user's text verbatim
  - [x] `docs/spec.md`, `PROGRESS.md`, `DECISIONS.md`, `AI_LOG.md`, `AUTHORIZATION.md` created
  - [x] Old scaffold removed; reusable infra moved to `backend/src/{utils,middleware,config}`
  - [x] Root `.gitignore` rewritten (`.codegraph/`, env files, build output)
  - [x] `backend/package.json`, `tsconfig.json`, `jest.config.ts`, `eslint.config.js`
  - [x] `backend/prisma/schema.prisma` (pulled forward from Slice 1 — needed for `prisma generate`; migration + seed still wait)
  - [x] Ported files compile and lint: `cd backend && npx tsc --noEmit && npm run lint` — both clean
  - [x] Dependency question answered — user approved `cors`, `dotenv`, `helmet`, `pino-pretty` (D-012)
  - [x] Commit — `bd4becf`
- [x] **Slice 1 — Data model, migration, seed** — committed `491e917` (DB apply/seed still pending credentials)
  - [x] `backend/prisma/schema.prisma` (done in Slice 0)
  - [x] `backend/prisma/seed.ts` — 5 login users + 10 non-login employees, idempotent upserts
  - [x] `backend/tests/setup/loadEnv.ts`, `globalSetup.ts` — load `.env.test`, `db push --force-reset`, seed
  - [x] `.gitattributes` — pin LF so checkouts are byte-identical across OSes
  - [x] Migration `prisma/migrations/20260924072540_init/` generated **offline** (`prisma migrate diff`), sequence appended (D-004)
  - [x] Jest split into `unit` / `integration` projects (D-013); `test:unit`, `test:integration`, `prisma:deploy` scripts
  - [x] CRG other-agent files deleted (D-014); CodeGraph re-indexed (18 files)
  - [x] `backend/.env` + `.env.test` exist (created from the user's credentials; template restored)
  - [x] `npx prisma migrate deploy` — applied
  - [x] `npx prisma db seed` — 16/16
  - [x] Live scenario run against `public`: spec Tests 1,2,3,4,6 + extras all pass (AI-007)
  - [x] **`npm test` — 150/150 passed** against the `test` schema, built from the migration files (AI-008)
  - [x] Commit — `491e917`
- [x] **Slice 2 — Auth: login / logout + `authenticate` in use + OpenAPI bootstrap** — committed `8b9755e` (`/api/me` moved to Slice 3 — it is an employee read path)
  - [x] `modules/auth`: `POST /api/auth/login`, `POST /api/auth/logout`
  - [x] `routes.ts`, `app.ts` mounts `/api`, `/api/docs`, `/api/docs.json`
  - [x] `openapi.yaml` bootstrap (schemas, shared responses, auth paths)
  - [x] `tests/helpers/{seedUsers,app}.ts`, `tests/integration/auth.test.ts` (17 tests) — **passing**
  - [x] `tsconfig.test.json`; `npm run typecheck` covers src + tests + prisma
  - [x] Verified: tsc (both configs), lint, DB-free smoke run, graph check
  - [x] Commit — `8b9755e`
- [x] **Slice 3 — `employeePolicy.ts` + read paths + `/me` + `AUTHORIZATION.md` + read-half of `authorization.test.ts`** — committed `caa8eac`
  - [x] `policies/employeePolicy.ts` — `canView`, `canCreate`, `canDelete`, `discloseMissing`, `updatableFields`, `scopeWhere`
  - [x] `tests/unit/employeePolicy.test.ts` — **34/34 passing** (no DB)
  - [x] `modules/employees` read paths: `GET /api/employees`, `GET /api/employees/:id`; `GET /api/me`
  - [x] `openapi.yaml`: Employee schemas + three paths
  - [x] `tests/integration/authorization.test.ts` read half (30 tests) — **passing**
  - [x] `docs/AUTHORIZATION.md` matches the policy file
  - [x] Verified: typecheck, lint, unit tests, rule-3 grep, smoke, graph check
  - [x] Commit — `caa8eac`
- [x] **Slice 4 — Write paths (POST / PUT / DELETE) + write-half of `authorization.test.ts` + `employees.test.ts`** — committed `0f06f35`
  - [x] `POST /api/employees` — `canCreate`, sequence id, Employee + User in one transaction
  - [x] `PUT /api/employees/:id` — `findScoped` → `updatableFields` → 403 naming denied fields → explicit `data`; User mirror (D-015)
  - [x] `DELETE /api/employees/:id` — `canDelete`, soft delete both rows, self-deactivation 400
  - [x] `openapi.yaml` — write ops with per-role field table
  - [x] `authorization.test.ts` write half (+27, all 6 spec tests now present), `employees.test.ts` (30) — **passing**
  - [x] `docs/AUTHORIZATION.md`, D-015; seed count corrected to 16
  - [x] Verified: typecheck, lint, unit 34/34, rule-3 grep, smoke, graph check
  - [x] Commit — `0f06f35`
- [x] **Slice 5 — Dashboard stats + complete `openapi.yaml` + Postman collection** — committed `fcc39df`
  - [x] `GET /api/dashboard/stats` — every count/groupBy under `scopeWhere`
  - [x] `openapi.yaml` complete — 9 documented ops = 9 mounted routes (cross-checked)
  - [x] `postman/HRMS.postman_collection.json` — 21 requests, 6 mandatory scenarios with assertions
  - [x] `tests/integration/dashboard.test.ts` (6) — **passing**
  - [x] Verified: typecheck, lint, unit 34/34, greps, route↔spec smoke, graph check
  - [x] Commit — `fcc39df`
- [x] **Slice 6 — Frontend scaffold + auth (Login, AuthContext, interceptors, ProtectedRoute, RoleGate)** — committed `f397e1e`
  - [x] Vite + React 19 + TS scaffold; CLAUDE.md deps; Tailwind 3.4
  - [x] "Ledger" design system (user-chosen): paper/ink/terracotta, Fraunces + Source Sans 3 + Plex Mono
  - [x] token store (memory + sessionStorage, `exp` auto-logout), axios interceptors, typed API modules
  - [x] AuthContext (+ `useAuth`), ProtectedRoute (role-aware), RoleGate
  - [x] Component set: Button, TextField/SelectField, badges, Spinner, ErrorBanner, EmptyState, PageHeader, Table, Modal
  - [x] Login page, app shell with role-aware nav
  - [x] Verified: build, lint, live sign-in in the browser pane, EMPLOYEE nav hides "Employees"
  - [x] Commit — `f397e1e`
- [ ] **Slice 7 — Dashboard + MyProfile pages** (committed together with Slice 8)
  - [x] `pages/Dashboard.tsx` — role-scoped figures + department register; verified for employee (1/1/0) and admin
  - [x] `pages/MyProfile.tsx` — record + phone-only editor
- [ ] **Slice 8 — EmployeeList / EmployeeDetail / EmployeeForm**
  - [x] `pages/EmployeeList.tsx` — URL-held search/filters/pagination, scoped department options, RoleGate'd Add
  - [x] `pages/EmployeeDetail.tsx` — Edit / Deactivate (modal), 403/404 states
  - [x] `pages/EmployeeForm.tsx` — create + edit; locked fields shown disabled; sends only dirty + permitted fields
  - [x] `lib/permissions.ts` mirror of `updatableFields`; `routes.tsx` role-guarded routes
  - [x] Verified in browser: admin create → EMP101 → deactivate; manager form locks 8 of 10 fields; employee redirected from /employees; 375px no overflow
  - [ ] Commit
- [ ] **Slice 9 — README + final verification pass**

## Next

1. Commit Slices 7 + 8 (AI-010).
2. **Slice 9 — README** in the spec's section order (Prerequisites, Installation, Environment variables, Database setup, Backend startup, Frontend startup, Test users, API documentation, Authorization test scenarios), then the final verification pass and `PROGRESS.md` close-out.
3. User-side: run the Postman collection; open the frontend at `http://localhost:5173`.

## Blockers

- None for the backend. For future `npm test` runs from Claude Code, Prisma's AI-agent guard requires the user's consent each time (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`); from the user's own terminal it does not fire.
- **CodeGraph MCP tools** (`codegraph_explore`) register on session restart only. Until then, graph checks run via the `codegraph` CLI with `grep` as backstop.
