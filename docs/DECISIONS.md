# Decisions

Format: context → decision → why → trade-off. Claude drafts; the human approves. Next id: **D-020**.

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

## D-015 — `PUT` mirrors `email` and `status` onto the login
**Context:** `Employee.email` and `User.email` are both unique columns; `Employee.status` and `User.isActive` both express "can this person act". Only ADMIN may change any of them.
**Decision:** In `update()`, an `email` change also updates `User.email`; a `status` change sets `User.isActive = (status === ACTIVE)`; a `role` change writes `User.role`. All in the same transaction as the employee update.
**Why:** Otherwise renaming an employee's email leaves their login on the old address, and marking them INACTIVE leaves them able to sign in — the soft-delete path would then be the only one that got it right.
**Trade-off:** Two tables carry the email. Accepted: the spec lists it on both entities, and the alternative (login by employee id) is worse UX.

## D-016 — Tests connect directly (port 5432), not through the pooler
**Context:** The first real `npm test` reset the `test` schema fine (that step uses `DIRECT_URL`) but the seed failed with "Can't reach database server at …pooler…:6543". The same pooled URL works without `schema=test`; the same URL with it does not.
**Decision:** In `.env.test`, `DATABASE_URL` is the direct connection with `?schema=test` — identical to `DIRECT_URL`. The app's `.env` keeps the pooled URL.
**Why:** Prisma implements `schema=` by sending a `search_path` startup option. Supabase's Supavisor pooler in transaction mode does not accept it and drops the connection, which Prisma surfaces as unreachable. A test run holds one connection at a time (`--runInBand`), so pooling buys nothing there.
**Trade-off:** Tests and the app use different connection paths, so a pooler-specific problem in production would not show up in tests. Accepted for an MVP; the app path is exercised by the Postman collection and the frontend.

## D-017 — Test schema is built with `migrate reset`, not `db push` (amends D-009)
**Context:** The first full `npm test` failed every `POST /api/employees` path (28 tests, including spec Test 5) with a 500: `nextval('employee_id_seq')` — relation does not exist. `db push` syncs the Prisma models only; it never runs the hand-written `CREATE SEQUENCE` in the migration SQL (D-004).
**Decision:** `globalSetup` runs `npx prisma migrate reset --force --skip-generate --skip-seed` against the `test` schema, then the seed.
**Why:** The sequence exists only in migration SQL, so the test database must be built from the migrations. This also means the suite verifies the migration files a reviewer will apply, rather than a parallel schema that merely resembles them.
**Trade-off:** `migrate reset` is a few seconds slower than `db push` and, like it, trips Prisma's AI-agent consent guard when run from an agent. Same consent variable covers both.

## D-018 — Frontend retries cold-start failures; never retries writes
**Context:** The API runs on Render's free tier, which sleeps after idle minutes and takes 30–60 s to wake. The first login after that failed with a 30 s timeout. User asked for 2–3 retries.
**Decision:** The axios client retries up to 3 attempts total (pauses 4 s, 10 s; 40 s timeout per attempt) when the failure looks like a sleeping platform: no response at all, or a 502/503/504 **without** the API's `{ error: { code } }` body. Only idempotent requests retry — GET/HEAD/OPTIONS and `POST /auth/login` (no side effects). Creates, updates and deletes never retry automatically. A `hrms:waking` event drives a visible "attempt n of 3" notice. On load the app pings `/health` (outside the retrying client) to start the boot early.
**Why:** Distinguishing platform 5xx from the API's own 503 (which carries our JSON shape) means a genuinely failing API is reported immediately instead of after three waits. Excluding writes prevents a slow `POST /employees` from creating two employees.
**Trade-off:** Worst case before the user sees an error is ~2 minutes (3 × 40 s + 14 s of pauses). Acceptable given the visible progress notice.

## D-019 — Cold-start retries apply to every route, writes included (amends D-018)
**Context:** D-018 limited retries to GETs and login to avoid duplicating a write whose first attempt timed out but succeeded. User asked for the behaviour on all routes.
**Decision:** Retry every method under the same cold-start rules (no response, or platform 502/503/504 without the API's error body; 3 attempts; 4 s / 10 s pauses). The "waking" notice moves into the app shell so it appears on any page.
**Why:** For this API the duplicate-write risk is already contained: a platform 502/503 never reached the app; `PUT` is idempotent (same data, same result); `DELETE` is a soft delete answering 204 twice; logout is stateless; a repeated `POST /employees` hits the unique email and returns 409 instead of a second row. A user's create can therefore surface as "email already exists" in the rare timeout-then-success case — a visible, recoverable outcome rather than silent duplication.
**Trade-off:** That 409 edge exists. If a non-idempotent write is ever added (e.g. "send offer letter"), it must opt out of retries or carry an idempotency key.

## D-020 — Phone is exactly ten digits, stored as typed
**Context:** The phone rule was "6–20 characters", so the forms accepted letters, `+91-…` prefixes and numbers longer than ten digits. User: "fix when updating number or adding number for new employee i can add the characters and number greater than 10 digits".
**Decision:** `phone` is `^\d{10}$` or `null` — no country code, spaces or dashes — enforced by Zod on `POST` and `PUT` (400 otherwise) and mirrored in `openapi.yaml`. The frontend `PhoneField` strips non-digits on input and paste, drops a pasted `+91` (12 digits) or trunk `0` (11 digits), and stops at ten; the form's Zod rule shows "Enter exactly 10 digits" before the request is sent. Seed, tests and Postman bodies use ten-digit values.
**Why:** The API is the guard (CLAUDE.md rule 6); the form only makes the rule pleasant. A single canonical shape keeps search and display trivial and matches the Indian mobile numbers in the seed. No native `maxLength` on the input: the browser applies it to the raw pasted text *before* the stripping handler, which kept `+91 ` and lost real digits — found in the browser during verification.
**Trade-off:** Non-Indian numbers cannot be stored; the brief has no such requirement. Existing rows written under the old rule (e.g. `+91-98450-00001` in a database seeded before this change) still read fine, but must be re-entered or re-seeded before they can be saved again.

## D-021 — Fixed department/designation lists, letters-only names, and "everyone but an admin has a manager"
**Context:** User feedback after using the forms: department and designation were free text (typos fragment the dashboard), an employee could be created with no manager, names accepted digits and symbols, and the detail page leaked API field names (`firstName`) into a hint.
**Decision:**
1. `department` and `designation` are closed lists (`employees.catalog.ts`, mirrored in `frontend/src/lib/catalog.ts`): 5 departments, 18 designations, all seed values included. Outside the list → 400. The forms render dropdowns. The list filter `?department=` stays a plain string — it can only narrow the scoped query, so an unknown value is an empty page, not an error.
2. `firstName` / `lastName` match `^[A-Za-z]+(?:[ '-][A-Za-z]+)*$` — letters, with single spaces, hyphens or apostrophes between parts. Same rule on both sides.
3. `managerId` is required unless the role is ADMIN. On create it is a Zod refine; on update the service checks the *effective* role and manager after the change (clearing an EMPLOYEE's manager, or demoting a top-level ADMIN without assigning one, are both 400). `requiresManager(role)` lives in the catalog module beside the other org-structure rules — it is a data-integrity rule about the target row, not an authorization decision about the actor, so it is deliberately not in `employeePolicy.ts`. This is the one place outside the policy that reads a `Role` value.
4. The detail page's "You may edit: …" line uses human labels and is hidden for ADMIN (who may edit everything). API error details render the same labels.
**Why:** The API is the guard for all three rules; the dropdowns and hints only make them pleasant. A closed list keeps the dashboard's department grouping honest. Requiring a manager keeps the reporting tree connected, which is what MANAGER scoping is built on. ASCII letters only is a deliberate MVP simplification.
**Trade-off:** Adding a department or title is a code change in two files (documented in both). Non-ASCII names are rejected. Validation (400) runs before authorization (403), as it always has — a non-admin sending an invalid body sees 400, and the Postman "employee creates → 403" body was fixed to be valid so the scenario still exercises the policy.
