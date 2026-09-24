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
  - [ ] **BLOCKED — needs `backend/.env` + `.env.test`:** `npx prisma migrate deploy` (apply), `npx prisma db seed` (15/15), integration tests
  - [x] Commit — `491e917`
- [ ] **Slice 2 — Auth: login / logout + `authenticate` in use + OpenAPI bootstrap** (`/api/me` moved to Slice 3 — it is an employee read path)
  - [x] `modules/auth`: `POST /api/auth/login`, `POST /api/auth/logout`
  - [x] `routes.ts`, `app.ts` mounts `/api`, `/api/docs`, `/api/docs.json`
  - [x] `openapi.yaml` bootstrap (schemas, shared responses, auth paths)
  - [x] `tests/helpers/{seedUsers,app}.ts`, `tests/integration/auth.test.ts` (17 tests) — **written, not run** (no `.env.test`)
  - [x] `tsconfig.test.json`; `npm run typecheck` covers src + tests + prisma
  - [x] Verified: tsc (both configs), lint, DB-free smoke run, graph check
  - [ ] Commit
- [ ] **Slice 3 — `employeePolicy.ts` + read paths + `AUTHORIZATION.md` + read-half of `authorization.test.ts`**
- [ ] **Slice 4 — Write paths (POST / PUT / DELETE) + write-half of `authorization.test.ts` + `employees.test.ts`**
- [ ] **Slice 5 — Dashboard stats + complete `openapi.yaml` + Postman collection**
- [ ] **Slice 6 — Frontend scaffold + auth (Login, AuthContext, interceptors, ProtectedRoute, RoleGate)**
- [ ] **Slice 7 — Dashboard + MyProfile pages**
- [ ] **Slice 8 — EmployeeList / EmployeeDetail / EmployeeForm**
- [ ] **Slice 9 — README + final verification pass**

## Next

Slice 2 (auth) → 3 (policy + reads) → 4 (writes) → 5 (dashboard, OpenAPI, Postman), continuously, one commit each. Integration tests are written as each slice lands and run the moment `backend/.env.test` exists.

## Blockers

- **Slice 1:** `backend/.env` and `backend/.env.test` do not exist. The user creates them from `backend/.env.example` / `.env.test.example` (Supabase pooled `:6543?pgbouncer=true` + direct `:5432` URLs, 32+ char `JWT_SECRET`). Secrets are not to be pasted into chat.
- **CodeGraph MCP tools** (`codegraph_explore`) register on session restart only. Until then, graph checks run via the `codegraph` CLI with `grep` as backstop.
