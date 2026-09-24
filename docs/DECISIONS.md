# Decisions

Format: context → decision → why → trade-off. Claude drafts; the human approves. Next id: **D-015**.

## D-001 — Rebuild clean in `backend/`, drop out-of-spec modules
**Context:** An API-only scaffold existed before the assessment brief arrived (flat `src/`, 4 roles, cuid IDs, attendance/leave/org, Vitest, inline authorization).
**Decision:** Rebuild under `backend/` to match `CLAUDE.md`. Port only `AppError`, `validate`, `errorHandler`, `env`, `authenticate`, `asyncHandler`, `password`, `prisma`. Delete attendance, leave, org, `authorize`, `dates`.
**Why:** The spec never asks for those modules; every extra endpoint is surface a reviewer probes for policy bypasses, and each would have had to be rewritten to route through `employeePolicy.ts` anyway.
**Trade-off:** ~1,500 lines of working, tested code discarded. Approved by the user.

## D-002 — CodeGraph is the primary graph tool; code-review-graph stays installed
**Context:** `CLAUDE.md` mandates CodeGraph (`codegraph_explore`); code-review-graph was already installed.
**Decision:** Install CodeGraph as written, keep both. The user's `CLAUDE.md` replaces the one code-review-graph injected. Its other injected files (`AGENTS.md`, `GEMINI.md`, hooks) are left alone.
**Why:** Follows the `CLAUDE.md` exactly; removing CRG buys nothing.
**Trade-off:** Two indexes of one repo. CRG's pre-commit hook silently no-ops because its CLI is not on PATH.

## D-003 — `role` lives on `User` only; every `Employee` has a `User`
**Context:** The spec lists `Role` on both `Users` and `Employees`.
**Decision:** Single column `User.role`. `POST /api/employees` creates `Employee` + `User` in one transaction. Seed creates a `User` for all ~15 employees; the ~10 "non-login" ones get an unpublished random password. The Employee DTO exposes `role` through the 1:1 join. `PUT` with `role` writes `User.role` (ADMIN only).
**Why:** Role is an authentication concept; the JWT and the policy must read one source of truth. Two columns would need syncing on every write and a reviewer would ask which one is trusted.
**Trade-off:** An employee cannot exist without a login identity. Acceptable for an HRMS.

## D-004 — `EMP###` IDs come from a Postgres sequence
**Context:** Public IDs like `EMP001` appear in URLs; the client must not choose them.
**Decision:** `CREATE SEQUENCE employee_id_seq START 100` in the first migration. The create transaction reads `nextval` and formats `EMP100`, `EMP101`, … Seed IDs `EMP000`–`EMP015` sit below the range.
**Why:** Race-safe without retries; no enumerable choice left to the user.
**Trade-off:** One raw SQL statement in a migration and one `$queryRaw` in the service.

## D-005 — Missing vs forbidden: ADMIN gets 404, everyone else gets 403 outside scope
**Context:** `CLAUDE.md` rule 4: object-level denial → 403; missing resource the actor *could* see → 404. Edge: an EMPLOYEE requests a nonexistent `EMP999`.
**Decision:** `findFirst({ where: { id, AND: scopeWhere(actor) } })`. Null + ADMIN → 404. Null + any other role → 403, existence undisclosed.
**Why:** Prevents an employee from mapping which IDs exist by comparing 403 with 404.
**Trade-off:** A manager mistyping an ID sees 403 rather than 404. Documented in `AUTHORIZATION.md` and README.

## D-006 — Supabase from the start, two URLs
**Decision:** `schema.prisma` uses `url = env("DATABASE_URL")` (pooled, `?pgbouncer=true`) and `directUrl = env("DIRECT_URL")`. Tests use the same host with `schema=test`.
**Why:** `CLAUDE.md` mandates it; Prisma's `directUrl` exists for exactly the migrate-through-pgbouncer problem.
**Trade-off:** No DB-touching verification until the user supplies credentials.

## D-007 — `PUT /api/employees/:id` is partial and strict
**Decision:** Zod schema with every field optional, `.strict()`, refined to ≥1 key. Any key not in `updatableFields(actor, target)` → 403 with `details: [field]`, before Prisma is touched.
**Why:** Rule 6 (mass assignment) needs the field list checked against the policy, not just validated for shape. `.strict()` makes unknown keys a 400, so a typo cannot silently pass.
**Trade-off:** Called `PUT` per the spec but semantically `PATCH`. README says so.

## D-008 — `department` is a string column
**Decision:** No `Department` model. Filter is exact match; dashboard uses `groupBy`.
**Why:** The spec lists it as a field; `CLAUDE.md` defines no entity. YAGNI.
**Trade-off:** Free text can drift ("Sales" vs "sales"). Seed uses a fixed set; the frontend filter offers only values present in the data.

## D-009 — Test DB lifecycle: reset + seed once per run
**Decision:** Jest `globalSetup` runs `prisma db push --force-reset --skip-generate` against the `test` schema, then the seed. Tests log in as seed users through supertest. No per-test transactions.
**Why:** The seed is 15 rows and the authorization tests are read-heavy. Write tests create their own rows with unique emails.
**Trade-off:** Tests are order-independent but not isolated; a write test that leaks state could affect a later count assertion. Mitigated by asserting on seeded IDs, not totals, except in the dashboard test which runs against a fresh seed.

## D-010 — Backend compiles to CommonJS
**Context:** The pre-plan scaffold was ESM with `.js` import suffixes.
**Decision:** `module: commonjs`, no import suffixes. Jest via `ts-jest`.
**Why:** Jest + ESM + TypeScript needs experimental flags and a `moduleNameMapper`; CJS removes all of it.
**Trade-off:** Cannot use top-level `await` (not needed).

## D-011 — Express 4, not Express 5
**Context:** `CLAUDE.md` says only "Express". The discarded scaffold used Express 5.
**Decision:** `express@^4.21` with `@types/express@^4`.
**Why:** Express 4's typings with `swagger-ui-express`, `pino-http`, `supertest` and `ts-jest` are the well-trodden path; Express 5's `@types` still lag in places.
**Trade-off:** Express 4 does not forward rejected promises to error middleware, so every async route must be wrapped in `utils/asyncHandler`. A missed wrapper hangs the request instead of returning a 500. Lint cannot catch this; code review must.

## D-012 — Dependencies beyond the CLAUDE.md list
**Context:** `CLAUDE.md`: "Don't add dependencies beyond this list without asking." Four were needed.
**Decision (user-approved 2026-09-24):** `cors` (frontend on :5173 calls API on :4000), `dotenv` (loads `backend/.env`), `helmet` (security response headers), `pino-pretty` (dev-only readable logs).
**Why:** The first two are presupposed by CLAUDE.md rules ("CORS origin from env", "config only from `.env`"). `helmet` addresses the "Security practices" evaluation criterion. `pino-pretty` is developer convenience.
**Trade-off:** `cors`, `dotenv`, `pino-pretty` were installed before the question was asked (recorded in AI-001). Any further addition is asked first.

## D-013 — Jest split into `unit` and `integration` projects
**Context:** `employeePolicy.ts` is the file the assessment is graded on, and its tests need no database. Yet D-009's `globalSetup` resets a schema on every `npm test`, and `loadEnv` refuses to run without `.env.test`.
**Decision:** Two Jest projects. `unit` (`tests/unit/**`) has no setup files and no env; `integration` (`tests/integration/**`) carries `loadEnv` + `globalSetup`. `npm test` runs both; `npm run test:unit` runs only the first.
**Why:** The authorization rules can be verified anywhere — CI without secrets, a reviewer's laptop, this session before Supabase credentials exist. Coupling them to a live DB would make the most important tests the hardest to run.
**Trade-off:** Two places to look for tests. Mitigated by the directory names.

## D-014 — Delete code-review-graph's other-agent files
**Context:** `code-review-graph install` wrote instruction files for Gemini, Qoder, CodeBuddy, Cursor, Windsurf, Kiro, opencode and GitHub Copilot (`AGENTS.md`, `GEMINI.md`, `QODER.md`, `CODEBUDDY.md`, `.cursorrules`, `.windsurfrules`, `opencode.jsonc`, `.codebuddy/`, `.gemini/`, `.qoder/`, `.kiro/`, `.github/`). D-002 left them in place; they were never committed.
**Decision (user-approved 2026-09-24):** Delete them. code-review-graph stays installed; its `.mcp.json` entry and `.claude/` skills remain committed.
**Why:** An assessment repo is read top-down by a reviewer. Twelve config files for tools the project does not use read as noise.
**Trade-off:** Re-running `code-review-graph install` would recreate them; nobody should.
