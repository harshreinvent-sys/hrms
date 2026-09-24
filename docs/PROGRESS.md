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
- [ ] **Slice 1 — Data model, migration, seed**
  - [x] `backend/prisma/schema.prisma` (done in Slice 0)
  - [x] `backend/prisma/seed.ts` — 5 login users + 10 non-login employees, idempotent upserts
  - [x] `backend/tests/setup/loadEnv.ts`, `globalSetup.ts` — load `.env.test`, `db push --force-reset`, seed
  - [x] `.gitattributes` — pin LF so checkouts are byte-identical across OSes
  - [x] Migration `prisma/migrations/20260924072540_init/` generated **offline** (`prisma migrate diff`), sequence appended (D-004)
  - [x] Jest split into `unit` / `integration` projects (D-013); `test:unit`, `test:integration`, `prisma:deploy` scripts
  - [x] CRG other-agent files deleted (D-014); CodeGraph re-indexed (18 files)
  - [ ] **BLOCKED — needs `backend/.env` + `.env.test`:** `npx prisma migrate deploy` (apply), `npx prisma db seed` (15/15), integration tests
  - [ ] Commit
- [ ] **Slice 2 — Auth: login / logout / me + `authenticate` (with `isActive` re-check)**
- [ ] **Slice 3 — `employeePolicy.ts` + read paths + `AUTHORIZATION.md` + read-half of `authorization.test.ts`**
- [ ] **Slice 4 — Write paths (POST / PUT / DELETE) + write-half of `authorization.test.ts` + `employees.test.ts`**
- [ ] **Slice 5 — Dashboard stats + complete `openapi.yaml` + Postman collection**
- [ ] **Slice 6 — Frontend scaffold + auth (Login, AuthContext, interceptors, ProtectedRoute, RoleGate)**
- [ ] **Slice 7 — Dashboard + MyProfile pages**
- [ ] **Slice 8 — EmployeeList / EmployeeDetail / EmployeeForm**
- [ ] **Slice 9 — README + final verification pass**

## Next

Slice 1, DB half: once `backend/.env` and `backend/.env.test` exist, run `npx prisma migrate dev --name init`, add the sequence to the migration, seed, verify 15/15, commit. Then Slice 2 (auth).

## Blockers

- **Slice 1:** `backend/.env` and `backend/.env.test` do not exist. The user creates them from `backend/.env.example` / `.env.test.example` (Supabase pooled `:6543?pgbouncer=true` + direct `:5432` URLs, 32+ char `JWT_SECRET`). Secrets are not to be pasted into chat.
- **CodeGraph MCP tools** (`codegraph_explore`) register on session restart only. Until then, graph checks run via the `codegraph` CLI with `grep` as backstop.
