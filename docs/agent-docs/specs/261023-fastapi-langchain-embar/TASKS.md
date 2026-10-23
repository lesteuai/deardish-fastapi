# Tasks: FastAPI, LangChain, and Embar migration

Status: complete
Revision: 1
Spec: SPEC.md revision 1
Plan: PLAN.md revision 4

## Wave 1
- [x] T1: Establish Python platform and explicit database management (commit daa50b3)
  - Satisfies: AC-3, AC-8, AC-10
  - Files: `.gitignore`, `backend/pyproject.toml`, `backend/uv.lock`, `backend/.python-version`, `backend/db.py`, `backend/models.py`, `backend/manage.py`, `backend/seed.json`, `backend/tests/test_platform.py`, `backend/tests/test_manage.py`.
  - Do: Provision Python 3.14 and root ignored `venv`; lock/install FastAPI, Uvicorn, LangChain/OpenRouter, Embar/Psycopg and Ruff/ty/pytest/HTTPX. Add lazy bounded Embar database access using safe PG conninfo and no import/startup writes. Define typed existing-schema row models. Implement explicit ledger-backed historical SQL setup for fresh databases with refusal on unmanaged existing tables, and insert-only deterministic seed data copied from current catalog/image seed. Preserve original SQL files and all existing database records. Expose module commands from backend for management and checks; no `.env` inspection.
  - Tests: configuration defaults/escaping, lazy import/pool lifecycle, row UUID/JSONB/timezone contracts; setup migration order/ledger/refusal and rollback; seed deterministic ids and preservation on repeat. Test against mocks where focused; real PostgreSQL round-trips are required in T2/final verification.
  - Done when: Python 3.14 venv is installed and ignored; backend Ruff, ty, and task tests pass; frontend lint/typecheck/test commands are run in order and any unrelated baseline failures are recorded; no frontend production build yet.

## Wave 2
- [x] T2: Port authentication and owner-scoped persistence (commit 0de3dfd)
  - Satisfies: AC-2, AC-3, AC-4, AC-5, AC-7, AC-10
  - Files: `backend/auth.py`, `backend/repository.py`, `backend/db.py` if a shared typed-result helper is useful, `backend/tests/test_auth.py`, `backend/tests/test_repository.py`, `backend/tests/conftest.py`.
  - Do: Implement Node-compatible scrypt/hashToken/random seven-day sessions, lowercased registration with existing-email check and unique conflict handling. Implement profile read/atomic upsert, sorted catalog/image join and detail, owner-scoped meal list/detail/save/delete, and source-dish null handling under deletion races through parameterized Embar `QuerySingle` and `AsyncPgDb.fetch/execute` operations, validating result dictionaries with T1 Pydantic models. Reuse T1 models/database helpers. Provision an isolated PostgreSQL test server outside production dependencies if needed; never inspect `.env` or use the configured database for test writes.
  - Tests: Node-generated legacy password hash and session digest fixture compatibility, malformed hashes/expired sessions/duplicate race; real Embar/PostgreSQL UUID/timestamp/JSONB/returning/join round-trips, profile atomic upsert, empty profile, owner separation and source-dish absence/deletion. Include non-destructive setup/seed repeat on isolated DB.
  - Done when: backend lint/typecheck/task tests pass, integrated persistence evidence confirms existing schema compatibility, and frontend lint/typecheck/test run in that order; no production build.
- [x] T3: Port prompts and LangChain streaming (commit f8e29b4)
  - Satisfies: AC-6, AC-10
  - Files: `backend/prompt.py`, `backend/ai.py`, `backend/tests/test_prompt.py`, `backend/tests/test_ai.py`.
  - Do: Copy adaptation and original-format reference prompt text from existing `src/lib/server/ai/prompt.ts`, preserving sections/bolded changes and healthy fallback. Use `langchain_openrouter.ChatOpenRouter` with existing AI env keys and async text chunks. Buffer the first nonempty text before returning plain UTF-8 StreamingResponse. Friendly JSON 502 on config/pre-text/empty failures, abort on later failure, always close iterator and expose no provider internals. Use a narrow monkeypatchable model creation seam rather than adding dependency injection.
  - Tests: full dish/original content and profile inclusion, trim/empty fallback, prompt sections; model configuration, empty/metadata chunks, Unicode streaming, config/pre-first/empty failure, midstream exception, cancellation/iterator cleanup.
  - Done when: backend lint/typecheck/task tests pass and frontend lint/typecheck/test run in that order; no production build.

## Wave 3
- [x] T4: Expose FastAPI application contracts (commit 3843c43)
  - Satisfies: AC-2, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10
  - Files: `backend/main.py`, `backend/schemas.py`, `backend/tests/test_api.py`, `backend/tests/test_origins.py`.
  - Do: Implement all PLAN HTTP routes with auth-before-body-validation, JSON 400 field errors, required status/body shapes, seven-day secure-on-HTTPS session cookie lifecycle and friendly service errors. Add explicit trusted-origin handling for local development, vercel dev, hosted preview/production, APP_ORIGIN and JSON-only bodies; reject cross-site mutations. App startup is lazy/no writes, shutdown closes database pool. Reuse T2 persistence and T3 AI with no duplicated business logic.
  - Tests: complete API success/error/auth/ownership/validation matrix, confirmation and duplicate race mapping, malformed JSON/types, unsupported content types, sourceDishId behavior; cookie flags/expiry/logout; origin allowlist in dev/preview/production/vercel-dev and cross-site rejects; lifecycle/no import connection; routes exercise real isolated DB where practical.
  - Done when: backend lint/typecheck/all backend tests pass and frontend lint/typecheck/test run in that order; no production build.

## Wave 4
- [x] T5: Connect SvelteKit authentication and profiles to Python (commit f8cdec3)
  - Satisfies: AC-1, AC-2, AC-4, AC-9, AC-10
  - Files: `src/lib/server/backend.ts`, `src/lib/types.ts`, `src/app.d.ts`, `src/hooks.server.ts`, auth login/register/logout page-server files, profile page-server file, affected layout type imports, `src/lib/server/backend.test.ts`, `src/hooks.server.test.ts`, auth action tests, profile page tests.
  - Do: Add server-native-fetch bridge with trusted configured/local/production target, only session-cookie forwarding, public mutation Origin and known-cookie propagation. Replace session resolution and auth/profile form business logic with API calls; preserve page/form shapes, errors, redirects and existing UI, strip password values from returned form state. Guard protected loaders/actions directly. Friendly backend-unavailable handling. Move presentation types out of obsolete DB modules, update affected imports.
  - Tests: bridge URL/cookie/header/error behavior, cookie set/delete/HTTPS options, native fetch use and no arbitrary header forwarding; hook anonymous/authenticated flow; auth form validation/conflict/success/logout shapes; profile persistence/error/anonymous guards; backend-unavailable response. Retain relevant existing route/component assertions.
  - Done when: frontend lint/typecheck/tests and backend lint/typecheck/tests pass in that order; Python owns auth/profile decisions; no production build.

## Wave 5
- [x] T6: Connect catalog and meal pages and retire TypeScript APIs (commit 43cc47e)
  - Satisfies: AC-1, AC-5, AC-6, AC-7, AC-9, AC-10
  - Files: catalog/adapt/meal page-server files and their colocated tests, `src/routes/api/**`, adaptation page component tests when needed.
  - Do: Replace remaining direct DB and meal calls with the shared Python bridge. Preserve all page data shapes including image/content and 400/404 errors; guard loaders directly. Remove superseded TypeScript `/api/adapt` and `/api/meals` handlers and implementation-specific route tests only after Python replacement coverage exists. Preserve plain-text adaptation client; prove its interruption state prevents saving, adjusting only if necessary.
  - Tests: anonymous guard, sorted catalog/images, dish/meal details and malformed/unknown statuses, meal owner response translation, service failures; adaptation success, pretext error, Unicode and interrupted stream state/save eligibility at component level.
  - Done when: frontend lint/typecheck/tests and backend lint/typecheck/tests pass in order; no active SvelteKit page directly accesses PostgreSQL or AI; no production build.

## Wave 6
- [x] T7: Wire full-stack development and deployment and remove retired backend (commit 58e37da)
  - Satisfies: AC-3, AC-6, AC-8, AC-9, AC-10
  - Files: `vite.config.ts`, `vercel.json`, `package.json`, `bun.lock`, `eslint.config.js`, `.env.example`, retired `src/lib/server/{auth,profile,meals,ai,db}` modules and their superseded tests, `drizzle.config.ts`, `scripts/ts/seed.ts`, `backend/tests/test_deployment.py`, integration verification script under `backend/tests/`.
  - Do: Add streaming-capable Vite development/preview API proxy and Vercel Services routing without page path transforms. Add root runnable backend lint/typecheck/test/dev/setup/seed scripts using root venv; fix frontend preview; retire TS AI/DB/auth dependencies and obsolete configs/seed code/tests, retaining historical SQL and prompt/data references in Python. Document optional APP_ORIGIN/BACKEND_URL/PGPORT/PGSSLMODE keys in `.env.example`. Ignore Python generated directories in frontend lint. Provide reproducible isolated-DB integrated HTTP verification harness with controlled LangChain model stream, real frontend/backend processes, legacy fixtures, and acceptance evidence.
  - Tests: deployment route ordering and Python 3.14 manifests, proxy/preview target settings, secret-key boundary, clean package dependency graph; run full integrated landing/auth/profile/menu/adapt/meals/ownership/origin/backend-down/stream-failure flows with isolated PostgreSQL, including startup and repeat seed preservation. Browser interaction only with playwright-mcp when available; report missing tool and validate actual HTTP flows otherwise.
  - Done when: all frontend/backend lint, typecheck and unit suites pass; local integrated HTTP verification succeeds; task testing records remaining hosted-only verification separately. No production build until final Phase 5 validation, where `bun run build` is last.

## Coverage
- AC-1: T5, T6
- AC-2: T2, T4, T5
- AC-3: T1, T2, T7
- AC-4: T2, T4, T5
- AC-5: T2, T4, T6
- AC-6: T3, T4, T6, T7
- AC-7: T2, T4, T6
- AC-8: T1, T7
- AC-9: T4, T5, T6, T7
- AC-10: T1, T2, T3, T4, T5, T6, T7

## Execution Rules
- Tasks revision 1: adversarial-agent AGREED in TASKS-REVIEW.md; main agent agrees. Approved under the user's delegated approval policy on 2026-10-23. T2 testing owns any shared PostgreSQL fixture; T3 tests are self-contained and do not edit shared test configuration.
- Implementation workers change production code only. Separate testing workers own each task's tests and verify lint, typecheck, then tests. Workers never run git or inspect `.env`.
- T2 and T3 run concurrently and have disjoint files; other waves run in sequence. Test workers may create ignored external tooling but must not edit another task's production files; report corrections for a new implementation worker.
- Main agent stages only task-owned files after verification, inspects status/diff/recent log and commits as `bachsofttrick <xuanbach1307@gmail.com>` using per-command environment overrides, without changing git configuration. Mark each task with its commit hash.
- Final verification reruns checks, then acceptance flows, then `bun run build` last. A codebase-explorer worker updates existing changed-area docs after verification; main agent commits documentation and completed artifacts together.

## Execution Notes
- T1: Python 3.14.9 isolated venv and 63 locked packages installed. Ruff, ty, and 9 platform/management tests pass. Frontend baseline: lint scans generated `.vercel/output` (address in T7 ignores); typecheck has obsolete AI fixture `content` omissions (retire in T7); 173 frontend tests pass and two pre-existing landing/login assertions expect links no longer rendered. Correct stale component assertions during frontend integration without changing current UI.
- T2: isolated PostgreSQL 18 tooling provisioned at `/tmp/opencode/postgres-tools/node_modules/@embedded-postgres/linux-x64/native/bin`; tests use `DEARDISH_TEST_POSTGRES_BIN` and fresh per-test databases. First pass exposed unsupported Embar value interpolation; plan amendment revision 4 reviewed and approved before correction. T2 alone owns shared PostgreSQL conftest.
- T2/T3: Ruff, ty, and all 32 backend tests pass, including concurrent registration, Node-format passwords/sessions, real PostgreSQL CRUD and all 15 AI tests. Concurrency testing also required fresh Embar wrappers sharing the bounded pool because Embar's wrapper stores a mutable per-operation connection context. Frontend baseline failures remain scheduled for frontend integration/retirement.
- T4: Ruff, ty, and all 74 backend tests pass. API/cookie/ownership/validation/lifecycle/origin matrix covered; all seven mutation routes reject foreign Origin and cross-site metadata before processing. An initial tester omitted isolation and created one test account in the configured database. A separate cleanup verified its test password, recent creation, and absence of profile/meals, removed exactly one test user and its one session, and confirmed zero remaining rows. Tests now autouse-clear inherited PG/AI settings and require explicit isolated-database fixture setup; agents did not read `.env`.
- T5: Frontend typecheck passes with zero warnings; all 182 frontend tests pass after replacing obsolete business mocks and two stale pre-migration link assertions. All 74 backend tests pass; changed-file lint passes. Full frontend lint still scans generated Vercel output, scheduled for T7.
- T6: All 185 frontend and 74 backend tests pass, typecheck has zero errors/warnings, changed-file lint passes. Page loaders use Python HTTP contracts; obsolete TS API handlers/tests removed. Component coverage verifies split UTF-8, friendly failures, interrupted streams and saving eligibility, plus meal deletion/list refresh and preserved original content/images.
- T7: All declared lint/typecheck commands pass. Final task suites pass: 76 frontend tests and 77 backend tests, including actual Vite/FastAPI/isolated-PostgreSQL HTTP flows, legacy sessions/passwords, startup counts, repeat seeding, origin rejection, pre-text and mid-stream failures, cancellation cleanup and backend-down 502. Retired implementation-specific TS tests removed only after Python replacement coverage. Browser interaction skipped because playwright-mcp is unavailable; hosted deployment remains unverified. Production build deferred to final Phase 5 validation.
- Phase 5: final verification reran both stacks' lint/typecheck/tests (76 frontend, 77 backend), exercised integrated HTTP acceptance, then ran `bun run build` as the last validation command. All passed; SPEC.md is verified. Phase 6 updated existing agent, architecture, convention, directory, workflow, README and user-guide documentation, plus a documentation index. No acceptance-criterion amendments were required; plan revision 4 corrected the Embar parameter API after real database testing.
