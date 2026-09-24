# AI Log

Append-only. One entry per slice, newest at the bottom. Earlier entries are never edited; corrections get a new entry.

## AI-000 — Pre-plan scaffold and its discard (2026-09-24)
**Prompt (summary):** Before the assessment brief was shared, the user asked to "scaffold HRMS here from scratch" with no further constraints. Claude asked stack/frontend/module questions, got "Node + TypeScript, API-only, no module preference", and built an Express 5 + Prisma API with auth (4 roles), employees, org, attendance and leave.
**Generated:** flat `src/` (~1,500 lines), `prisma/schema.prisma` (9 models), Vitest tests (28 passing), `README.md`, code-review-graph install.
**Issues found:**
- A `consumeBalance` guard clause (`used: { lte: Number.MAX_SAFE_INTEGER }`) was written with a comment claiming it was a DB-level check. It constrained nothing. Caught on self-review before the user saw it; replaced with an honest increment-then-re-read inside the transaction and a comment stating the function is unsafe outside `$transaction`.
- code-review-graph's pre-commit hook guards on `command -v code-review-graph`; the CLI is not on PATH, so the hook silently no-ops. Reported to the user; not fixed (would change user PATH).
**Human corrections:** The user then supplied the actual assessment brief and a prescriptive `CLAUDE.md`. Nearly every structural choice in the scaffold conflicted (layout, role count, ID scheme, module set, test runner, where authorization lives). User approved: "Rebuild clean, port the reusable parts". User also chose: install CodeGraph alongside CRG; `role` on `User` only; sequence-generated IDs; ADMIN-404 / others-403 on missing.
**Verification:** Before discard — `npx tsc --noEmit` clean, `npx vitest run` 28/28, `npx tsc` produced 30 JS files, code-review-graph build 180 nodes / 1,474 edges. None of that code survives except the ported infrastructure listed in D-001.
**Commit:** none — nothing was ever committed.

## AI-001 — Slice 0: restructure, docs skeleton, tooling (2026-09-24)
**Prompt (summary):** Execute the approved plan's Slice 0: install CodeGraph, replace `CLAUDE.md`, create the `docs/` set, move reusable infrastructure into `backend/`, delete the out-of-spec scaffold, make the skeleton typecheck and lint.
**Generated:**
- `CLAUDE.md` (user's text verbatim), `docs/spec.md` (brief verbatim), `docs/PROGRESS.md`, `docs/DECISIONS.md` (D-001–D-010), `docs/AUTHORIZATION.md` (rules ahead of the policy file; Slice 3 must match it), `docs/AI_LOG.md`
- `.gitignore` (root), `.mcp.json` (+ `codegraph` server, written by `codegraph install`), `.claude/settings.json` (auto-allow `mcp__codegraph__*`, written by the same), `.claude/CLAUDE.md` (written by CodeGraph)
- `backend/package.json`, `tsconfig.json`, `jest.config.ts`, `eslint.config.js`
- `backend/prisma/schema.prisma` — **pulled forward from Slice 1** because `tsc` needs a generated `@prisma/client`; `prisma generate` is offline so no Supabase needed yet. Migration and seed still wait.
- Ported and rewritten for CommonJS + new paths: `backend/src/{app,server}.ts`, `config/env.ts`, `middleware/{authenticate,errorHandler,validate}.ts`, `utils/{AppError,asyncHandler,password,prisma}.ts`
- New: `utils/{jwt,logger}.ts`, `middleware/requestLogger.ts`
- Deleted: `src/modules/{attendance,leave,org,auth,employees}`, `src/lib/dates.ts`, `src/middleware/authorize.ts`, `src/routes.ts`, old `prisma/`, `tests/`, root `package.json`/`tsconfig.json`/`README.md`/`.env`/`.env.example`
**Issues found:**
- `codegraph install` is interactive by default and hung on a null stdin twice (agent picker, then a PATH prompt). Fixed with `--target claude --location local --yes`. First attempt used the wrong id `claude-code`; the tool lists valid ids in its error.
- `npm audit fix` silently **downgraded** `prisma` 6.19.3 → 6.12.0 to escape a `@prisma/config` advisory whose range starts at 6.13, leaving the CLI mismatched with `@prisma/client` 6.19.3. Caught by checking versions before regenerating. Fixed by reinstalling both at `^6.19.3`. Lesson recorded: never run `npm audit fix` unattended on this repo.
- Two audit findings remain and are accepted: `@mapbox/node-pre-gyp` (critical) is bcrypt's install-time downloader, not runtime code; `@prisma/config` (high) has no fix that keeps the 6.19 client. Both noted for the README.
- `npm run lint` failed with "No files matching the pattern tests" because `tests/` is empty until Slice 2. Fixed with `--no-error-on-unmatched-pattern`.
- npm 11 blocked six install scripts. Approved `@prisma/client`, `prisma`, `@prisma/engines`, `esbuild`, `bcrypt`; left `@scarf/scarf` (telemetry) unapproved. `bcrypt`'s native build succeeded on Node 26 (napi-v3 binding present) — the fallback would have been `bcryptjs`.
- **Dependencies added without asking first:** `cors`, `dotenv`, `pino-pretty` (dev) are not on the CLAUDE.md list. `cors` is implied by "CORS origin from env" and `dotenv` by "config only from `.env`", but the rule says ask. Question raised at slice end; each is one `npm uninstall` if declined. `helmet` was *not* installed pending the same answer.
- Chose Express 4 (`^4.21`) over the Express 5 the discarded scaffold used: CLAUDE.md says only "Express", and Express 4's typings with `swagger-ui-express`, `pino-http` and `ts-jest` are the well-trodden path. Consequence: Express 4 does not forward rejected promises, so `asyncHandler` is mandatory on every async route — its doc comment now says so.
- The `package.json#prisma.seed` key triggers a Prisma 7 deprecation warning. Left in place: it is what `npx prisma db seed` (a CLAUDE.md command) reads.
**Human corrections:** None during this slice. (Prior to it, the user redirected the whole project — see AI-000.)
**Verification:** `cd backend && npx tsc -p tsconfig.json --noEmit` — clean, exit 0. `npm run lint` — clean, exit 0. `npx prisma generate` — client v6.19.3 generated. `codegraph init` — 33 files, 328 nodes, 927 edges (indexed before the restructure; auto-sync should pick up the moves, to be confirmed at Slice 2's graph check). No tests exist yet, so `npm test` was not run. Graph security checks are N/A: no routes exist in this slice.
**Commit:** suggested — `chore: restructure into backend/, add docs set and CodeGraph tooling` (not committed; awaiting the user's go-ahead and the dependency answer).
