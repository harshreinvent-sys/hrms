# Progress

Plan: `~/.claude/plans/pasted-content-id-57f0-full-stack-vivid-wilkes.md` (approved 2026-09-24). One vertical slice at a time; each slice ends with a commit, an `AI_LOG.md` entry, and a tick here.

## Slices

- [ ] **Slice 0 — Restructure + docs skeleton + tooling**
  - [x] CodeGraph installed (`@colbymchenry/codegraph` 1.6.0), `codegraph install --target claude --location local --yes`, `codegraph init` (33 files, 328 nodes)
  - [x] `CLAUDE.md` replaced with the user's text verbatim
  - [x] `docs/spec.md`, `PROGRESS.md`, `DECISIONS.md`, `AI_LOG.md`, `AUTHORIZATION.md` created
  - [x] Old scaffold removed; reusable infra moved to `backend/src/{utils,middleware,config}`
  - [x] Root `.gitignore` rewritten (`.codegraph/`, env files, build output)
  - [x] `backend/package.json`, `tsconfig.json`, `jest.config.ts`, `eslint.config.js`
  - [x] `backend/prisma/schema.prisma` (pulled forward from Slice 1 — needed for `prisma generate`; migration + seed still wait)
  - [x] Ported files compile and lint: `cd backend && npx tsc --noEmit && npm run lint` — both clean
  - [x] Dependency question answered — user approved `cors`, `dotenv`, `helmet`, `pino-pretty` (D-012)
  - [ ] Commit
- [ ] **Slice 1 — Data model, migration, seed** *(blocked: needs Supabase `DATABASE_URL` + `DIRECT_URL`)*
- [ ] **Slice 2 — Auth: login / logout / me + `authenticate` (with `isActive` re-check)**
- [ ] **Slice 3 — `employeePolicy.ts` + read paths + `AUTHORIZATION.md` + read-half of `authorization.test.ts`**
- [ ] **Slice 4 — Write paths (POST / PUT / DELETE) + write-half of `authorization.test.ts` + `employees.test.ts`**
- [ ] **Slice 5 — Dashboard stats + complete `openapi.yaml` + Postman collection**
- [ ] **Slice 6 — Frontend scaffold + auth (Login, AuthContext, interceptors, ProtectedRoute, RoleGate)**
- [ ] **Slice 7 — Dashboard + MyProfile pages**
- [ ] **Slice 8 — EmployeeList / EmployeeDetail / EmployeeForm**
- [ ] **Slice 9 — README + final verification pass**

## Next

Finish Slice 0: write `backend/` config files, make the ported skeleton typecheck, get an answer on `helmet`/`cors`/`dotenv`, commit.

## Blockers

- **Slice 1:** Supabase pooled (`:6543?pgbouncer=true`) and direct (`:5432`) connection strings. Nothing DB-touching can be verified until `backend/.env` exists.
- **CodeGraph MCP tools** (`codegraph_explore`) register on session restart only. Until then, graph checks run via the `codegraph` CLI with `grep` as backstop.
