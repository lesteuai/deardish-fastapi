# Tasks Review: FastAPI, LangChain, and Embar migration

- Artifact: TASKS.md revision 1
- Upstream: SPEC.md revision 1 (approved), PLAN.md revision 3 (approved)
- Verdict: AGREED
- Reviewer: adversarial-agent subagent
- Date: 2026-10-23

## Review identity

- Artifact: `docs/agent-docs/specs/261023-fastapi-langchain-embar/TASKS.md`, revision 1 (header states Spec revision 1, Plan revision 3; both match the on-disk approved artifacts).
- Upstream: `SPEC.md` revision 1, `PLAN.md` revision 3.
- Verdict: **AGREED** under the user's autonomous delegated-approval policy (approval granted on passing review).

## Summary

TASKS.md revision 1 covers all ten acceptance criteria across seven tasks in six waves with correct dependency ordering, an accurate coverage table, and execution rules that enforce implementation/testing separation, lint-then-typecheck-then-test ordering, no per-task production builds, `bun run build` last at final validation, and worker prohibitions on git and `.env` inspection. The parallel wave 2 (T2/T3) has strictly disjoint production and test file sets. File lists were verified against the actual repository tree, including the retired TypeScript backend modules, `src/hooks.server.ts`, auth/profile/menu/adapt/meal page-server files, `src/routes/api/**` handlers, `scripts/ts/seed.ts`, and `drizzle.config.ts`; nothing referenced is missing from the codebase, and the large T6/T7 file lists are proportionate to the retirement of the old backend. No changes are required.

## Evidence and coverage

- SPEC AC-1 through AC-10 and Edge Cases were checked one-by-one against the TASKS Coverage table and each task's Tests/Done-when text. Every AC is claimed by at least one task, and task-level test lists name the specific behaviors the spec requires (401/400/404/502 semantics, malformed-JSON 400 vs 422, duplicate-email race, expired/invalid sessions, empty-profile fallback, owner scoping and cross-user 404, source-dish null handling under deletion races, first-text buffering and mid-stream interruption with save prevention, seed repeatability without record mutation, Python 3.14, ignored venv, no `.env` reads).
- Plan contracts checked against task allocation: all declared HTTP routes (`/api/health`, auth, profile, dishes, meals, adapt) in T4; scrypt/session compatibility in T2; verbatim prompt migration and LangChain first-text buffering in T3; native-fetch bridge and cookie propagation in T5; Vite proxy, vercel.json Services routing, root scripts, retired-module removal plus integrated isolated-DB HTTP harness in T7. No plan obligation was dropped or contradicted; the plan's auth.py/main.py route placement is a file-organizer detail TASKS resolves by putting routes in `backend/main.py` (T4) and session logic in `backend/auth.py` (T2), which the plan wording permits.
- Repository verification (Read + codegraph): `src/hooks.server.ts`, `src/routes/auth/{login,register,logout}/+page.server.ts`, `src/routes/(app)/{profile,menu,menu/[id],adapt/[dishId],meals,meals/[id]}/+page.server.ts`, `src/routes/api/adapt/+server.ts`, `src/routes/api/meals/+server.ts` with `[id]`, `src/lib/server/{auth,profile,meals}.ts` and `src/lib/server/{ai,db}/` with colocated tests, `scripts/ts/seed.ts`, `drizzle/*.sql`, `scripts/sql/populate-dish-recipes.sql` and `populate-images.sql` all exist as TASKS assumes. `src/routes/(app)/menu/+page.server.ts` uses a `leftJoin` on `images`, confirming missing-image fallback is pre-existing preserved behavior. `src/lib/types.ts` does not exist yet and is correctly listed as a T5 creation ("Move presentation types out of obsolete DB modules").
- Parallel T2/T3 disjointness checked at file level: production `backend/{auth,repository}.py` vs `backend/{prompt,ai}.py`, tests `test_auth/test_repository` vs `test_prompt/test_ai` — zero overlap; neither needs the other, both depend only on T1 outputs. T2 alone requires the isolated PostgreSQL test server; T3 requires no database, so no shared infrastructure conflict exists within wave 2.
- Ordering rules checked per task: every task's Done-when specifies lint, typecheck, tests in that order, "no production build" per task, and T7 records `bun run build` last at final validation, matching PLAN Verification and AC-10.
- Constraint compliance: no task or worker touches git or reads `.env`; configuration key names come from `.env.example` (T1, T7); test isolation explicitly forbids writes to the configured database (T2, T4, T7).

## Findings

### F1: Wave-2 shared test-support files are not pre-assigned in file lists
- Severity: medium
- State: accepted tradeoff
- Evidence: TASKS.md Wave 2 file lists name only `backend/{auth,repository,prompt,ai}.py` and their four test files; if T2 or T3 later need a shared `backend/tests/conftest.py` fixture or a pytest-asyncio setting in T1-owned `backend/pyproject.toml`, those files belong to other tasks.
- Failure scenario and impact: minimal — Execution Rules already route this ("Test workers ... must not edit another task's production files; report corrections for a new implementation worker"), T1 pre-installs pytest-asyncio/HTTPX/Ruff/ty so configuration edits are unlikely, and T2's isolated-server provisioning can live inside its own test files.
- Required resolution: none. The correction mechanism in Execution Rules covers the residual case; F1 is recorded so implementation workers know the escalation path if pytest configuration must change.

### F2: Coverage table under-represents T7 verification of AC-1/AC-4
- Severity: low
- State: accepted tradeoff
- Evidence: TASKS.md Coverage lists AC-1: T5, T6 and AC-4: T2, T4, T5, while T7's test list ("landing/auth/profile/menu/adapt/meals/...") supplies the integrated end-to-end evidence for those flows under AC-10.
- Failure scenario and impact: none functional; the table maps task ownership of implementation, and AC evidence for AC-1/AC-4 exists in T7's own test specification.
- Required resolution: none; coverage for each AC is complete and the integrated evidence is explicitly assigned in T7's Tests line.

### F3: Missing-image edge case is not named as an explicit test
- Severity: low
- State: accepted tradeoff
- Evidence: SPEC Edge Cases ("Missing images: the existing page fallback remains functional") vs TASKS T2/T6 test lists, which name catalog/image joins and sorted catalog/images without a dedicated missing-image case.
- Failure scenario and impact: minimal — codegraph confirms the existing left-join plus UI fallback is untouched by the migration; T1 seeds deterministic existing image ids with conflict-do-nothing, and T6 requires preserving existing UI behavior and retaining relevant existing component assertions.
- Required resolution: none; the fallback is pre-existing behavior preserved by requirement, not newly implemented logic needing fresh tests.

### F4: `src/lib/types.ts` listed as a T5 file while it does not exist yet
- Severity: low
- State: resolved
- Evidence: `src/lib/` contains `schemas.ts`, `schemas.test.ts`, `server/`, `ui/`; TASKS T5 "Move presentation types out of obsolete DB modules, update affected imports" correctly makes this a new file, not a modification of an existing one.
- Failure scenario and impact: none; verified as intended creation, not a file-list error.

## Disposition of all findings

| ID | State | Main-agent response assessed | Reviewer conclusion and evidence |
|---|---|---|---|
| F1 | accepted tradeoff | pending (not raised in a prior round) | Execution Rules line 76 correction path plus T1 pre-installed tooling bounds the risk; recorded for implementers, no draft change needed |
| F2 | accepted tradeoff | pending | Coverage is complete per AC; T7 test list explicitly covers landing/auth/profile integrated flows |
| F3 | accepted tradeoff | pending | Missing-image fallback is existing preserved behavior (leftJoin confirmed in `src/routes/(app)/menu/+page.server.ts`); retention requirement in T6 covers it |
| F4 | resolved | pending | Verified `src/lib/types.ts` is a new T5 file by repository inspection; file list is accurate |

## Unresolved decisions and evidence gaps

- None. All tasks are actionable; hosted Vercel deployment verification remains correctly out of scope per SPEC Non-Goals and AC-10's local-vs-hosted evidence distinction.

## Agreement statement

I accept TASKS.md revision 1 against approved SPEC.md revision 1 and approved PLAN.md revision 3. All findings are either resolved through repository verification (F4) or explicitly accepted as bounded tradeoffs with a proportionate rationale (F1, F2, F3). Under the user's autonomous delegated-approval policy, the artifact is approved for execution. Delegated approval is recorded here and in the main agent's agreement.

Review limits: this review verified documents, the coverage matrix, ordering rules, and repository structure (via Read and codegraph). It did not execute tasks, run lint/typecheck/tests, build the backend, or exercise the future test harness, so runtime behavior remains unverified by design until task execution.

## Next action

Return to the main agent to record agreement and begin Wave 1 (T1) execution per the approved autonomous policy.
