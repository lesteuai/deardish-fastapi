# Adversarial Review: FastAPI, LangChain, and Embar migration spec

## Review identity

- Artifact: /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/SPEC.md, revision 1
- Upstream: none. The historical demo spec remains historical per user instruction; this review covers the migration-specific spec only.
- Verdict: AGREED

## Summary

The spec is faithful to the user's migration request and traces closely to the current codebase. Every acceptance criterion was cross-checked against the live sources listed below; the catalog and API behaviors AC-2 through AC-7 describe match the existing implementation precisely, including several details that look deliberate: 400 for malformed dish identifiers and 404 for unknown ones on `/menu/[id]`, 400/404 for meals, 201-with-id on save, 204 on delete, 502 JSON for missing AI config or pre-stream provider failure, plain UTF-8 streaming with a visible interruption error and saving unavailable until a clean stream end. The archived Postgres schema (scrypt `salt:hash` password hashes, SHA-256-hex session token hashes, uuid/jsonb/timestamptz columns) is compatible with a Python verification layer, so AC-3's legacy-compatibility requirement is achievable without any rewrite.

Three findings remain, all low or speculative and all resolvable as plan-phase verification obligations rather than spec defects. Python 3.14 is mandatory for Embar (template strings) and is supported by Vercel's Python runtime, so AC-8 pins the one version that satisfies both. Vercel's Services full-stack model with top-level rewrites matches AC-9 as written.

## Evidence and coverage

- AC-2 / registration, validation, sign-in on success, conflict handling: `src/routes/auth/register/+page.server.ts` (fields, min-8 password, confirmation check, conflict field error, session creation), `src/lib/schemas.ts` (trim + lowercase email, min-8 password), `src/lib/server/auth.ts` (`hashPassword` scrypt salt:hash hex, `verifyPassword`, `createSession`, cookie `httpOnly`/`SameSite=lax`/path `/`/seven-day max age). Case-insensitive duplicate-email checking is achievable at the query level against the existing `users.email` case-sensitive unique constraint (see F2).
- AC-3 / legacy data compatibility: `src/lib/server/auth.ts` L13-30 (scrypt with node default parameters N=16384, r=8, p=1, key length 64; `verifyPassword` reads `salt:hash` hex), `hashToken` SHA-256 hex of the raw base64url cookie token, `src/lib/server/db/schema.ts` (tables users, sessions, health_profiles, dishes, images, meals with the exact column names the spec requires Embar to retain). Python `hashlib.scrypt` reproduces the node scrypt format for these parameters.
- AC-4 / profile: `src/routes/(app)/profile/+page.server.ts`, `src/lib/server/profile.ts` (single upsert `onConflictDoUpdate` returning, matching "atomically update"; trim/max limits match `profileSchema`; empty-profile fallback rows return empty strings).
- AC-5 / catalog: `src/routes/(app)/menu/+page.server.ts` (name-order asc, image leftJoin), `src/routes/(app)/menu/[id]/+page.server.ts` (400 for malformed id, 404 for unknown), `src/app` image fallback retained.
- AC-6 / adapt: `src/routes/api/adapt/+server.ts` (401 JSON, 400 JSON with auth checked first, 404, missing config 502), `src/lib/server/ai/adapt.ts` (pre-stream failure 502 JSON; mid-stream failure aborts the stream, which yields a visible interruption error and leaves `canSave` false in the retained frontend), `src/lib/server/ai/prompt.ts` (complete-section/markdown sections, bolded changes, EMPTY_PROFILE_FALLBACK healthy-cooking guidance), `src/routes/(app)/adapt/[dishId]/+page.svelte` (frontend already parses plain UTF-8 text and `{error}` JSON, expects 201 on save).
- AC-7 / meals: `src/routes/api/meals/+server.ts` (auth first, 400 with field errors, 201 `{id}`), `src/routes/api/meals/[id]/+server.ts` (401, 404, 204), `src/lib/server/meals.ts` (title trim/max 200/content nonempty, uuid guard for invalid identifiers returning 404, owner-scoped queries). AC-7's "nonexistent source-dish references cannot cause a server error" is a deliberate tightening over the current code, which would raise an FK violation on a valid-UUID nonexistent reference, so this criterion is new required behavior for the Python backend and is testable.
- AC-8 / env keys and venv: `.env.example` contains exactly the six keys listed in the spec; `src/lib/server/db/index.ts` reads only `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGDATABASE`; `AI_API_KEY`/`AI_MODEL` read from dynamic private env in `src/lib/server/ai/adapt.ts`. `venv`/`.venv` are not yet in `.gitignore`, so adding the ignore entry is in migration scope as implied by AC-8.
- AC-9 / Vercel deployment: Verifying feasibility against Vercel's own documentation. Python runtime docs (https://vercel.com/docs/functions/runtimes/python) state available Python versions are 3.12 (default), 3.13, 3.14, that streaming is supported, and that Services deploys a frontend and a Python backend in one project with top-level rewrites; https://vercel.com/changelog/python-3-13-and-3-14-are-now-available (Feb 2026) confirms 3.14 support and https://vercel.com/changelog/python-on-vercel-is-now-generally-available (Oct 2026) confirms the Services rewrite model with local `vercel dev`. AC-9's requirement is documented-feasible.
- Embar constraints: https://embar.rdrn.me/ documents that Embar uses Python 3.14 template strings and is therefore 3.14-only (consistent with AC-8), is alpha status (user-selected in the request, recorded in the spec's Request line), and supports Postgres via async psycopg3 with joins, transactions, raw SQL (Template-string escape hatch), and PG types including Text, Jsonb, and Timestamp; its documented migration diffing engine is roadmap-stage (see F1).
- AC-1 / page inventory: all current pages enumerated under `src/routes` (landing, menu, menu/[id], adapt/[dishId], meals, meals/[id], profile, auth/login, auth/register) with the `(app)` layout guard redirecting anonymous visits to `/auth/login`.
- AC-10 / verification: consistent with `bun run` typecheck/lint/test commands plus new Python-side commands; local-vs-hosted evidence split matches the no-deployment-access constraint in Non-Goals.

## Findings

### F1: Schema-setup command ownership in AC-8 is ambiguous
- Severity: medium
- State: resolved (spec-level), carried as a mandatory plan verification
- Evidence: AC-8 requires "repeatable commands cover backend startup, lint, type checking, tests, schema setup, and non-destructive catalog seeding" without naming the DDL source; Embar's docs (https://embar.rdrn.me/schemas/data-types-pg/, https://embar.rdrn.me/) document a type list without first-class UUID or TIMESTAMPTZ and state that the migration diffing engine is still on the roadmap, while `src/lib/server/db/schema.ts` uses uuid primary keys with `defaultRandom()` (gen_random_uuid), `timestamp ... withTimezone`, and jsonb.
- Failure scenario and impact: A plan could interpret "schema setup" as Embar-generated migrations for fresh test databases, producing subtly different DDL (timestamps without timezone, different default semantics) than the retained production schema, which would violate AC-3's "retaining existing table and column names and ownership constraints" and leave E2E verification testing a divergent schema.
- Required resolution: The spec already binds the correct reading: AC-3 says Embar is the runtime access layer and startup performs no schema changes, and "database hosting changes" is a Non-Goal, so existing drizzle migrations remain the DDL source for fresh dev/test databases with Embar reading and writing the retained schema. Under that reading no spec revision is needed. The plan must pin this explicitly and verify, before committing to query builders, that Embar can express the required uuid PK reads/writes, timestamptz values, jsonb ingredients arrays, FK cascades, the dishes/images join, and insert-returning of generated ids (raw SQL escape hatch exists if the ORM layer falls short).

### F2: Case-insensitive duplicate-email enforcement mechanism is unspecified
- Severity: low
- State: resolved
- Evidence: AC-2 requires case-insensitive duplicate email rejection; `src/lib/server/db/schema.ts` has `users.email` as a case-sensitive `text` unique column; AC-3 forbids schema changes at startup and requires retaining ownership constraints.
- Failure scenario and impact: A sequential `lower(email)` pre-check plus the existing exact-case unique constraint satisfies AC-2 for both sequential attempts and the same-case concurrent race covered by Edge Cases. The residual gap is theoretical: two concurrent registrations differing only in email case could both pass the pre-check and insert since the DB constraint cannot catch cross-case occurrences. Impact is negligible in practice and outside the spec's stated edge scope.
- Required resolution: No spec change required. The plan should implement the lower(email) pre-check plus unique-violation conflict handling; handling the exotic cross-case race would require a one-time functional unique index, which the plan may adopt if it is judged non-destructive, or document as a known limitation.

### F3: SvelteKit as a Vercel Services frontend root is not explicitly documented by Vercel
- Severity: low
- State: resolved
- Evidence: AC-9 requires the checked-in Vercel configuration to route `/api/*` to FastAPI and pages to SvelteKit on one origin following the Services template. Vercel's Services documentation examples show a Next.js frontend root (https://vercel.com/changelog/python-on-vercel-is-now-generally-available), and SvelteKit service-root support is not asserted in the fetched docs; the referenced Next.js + FastAPI starter demonstrates the same one-origin rewrite principle via framework-native rewrites.
- Failure scenario and impact: If Services does not accept a SvelteKit adapter-vercel root, the deployment task could stall at configuration time. A documented fallback exists: the SvelteKit project plus a Python function/service with top-level `vercel.json` rewrites achieves the same one-origin routing.
- Required resolution: No spec change required. The plan must verify SvelteKit support in Services at configuration time or adopt the documented rewrites fallback, and AC-10 already requires distinguishing locally verified evidence from hosted deployment, which needs external access and is a stated Non-Goal to invent without it.

## Disposition of all findings

| ID | State | Main-agent response assessed | Reviewer conclusion and evidence |
|---|---|---|---|
| F1 | resolved | Pending (first round) | Spec is internally coherent under AC-3's binding language; plan-phase verification obligation recorded from Embar docs and current schema |
| F2 | resolved | Pending (first round) | AC-2 is implementable against the existing schema with a query-level check; residual cross-case race negligible and outside stated edge scope |
| F3 | resolved | Pending (first round) | Feasibility verified from Vercel Python runtime and Services docs; fallback routing exists; hosted verification gated behind deployment access per Non-Goals |

## Unresolved decisions and evidence gaps

- None requiring user input. The user delegated approval after review pass. All three findings are recorded as plan-phase verification obligations for the plan review to enforce.

## Agreement statement

AGREED. I accept SPEC.md revision 1 as-is. No spec revision is requested; the three findings are the kind of implementation choices the spec correctly defers, and each carries a concrete verification obligation that the plan phase must satisfy (F1 schema DDL source and Embar capability check being the strongest). The spec's acceptance criteria are observable and, where AC-6 and AC-7 deliberately tighten existing behavior (mid-stream saving prevention, nonexistent source-dish references), the retained SvelteKit frontend's existing semantics already make those behaviors verifiable end to end.

## Next action

Main agent records mutual agreement on SPEC.md revision 1, marks spec approval per the delegated autonomous-mode policy, and proceeds to plan drafting with the three recorded plan-phase verification obligations from F1, F2, and F3 explicitly handed over.

## File list

- /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/SPEC.md (reviewed, revision 1, unchanged)
- /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/SPEC-REVIEW.md (this report, written this round)

Review limitations: I did not read `.env` (per instruction), execute any commands, modify source, or verify any runtime behavior; all checks are static source reads plus fetched Embar and Vercel documentation. Hosted Vercel behavior remains unverified by design, since deployment access does not exist and creating a hosted deployment is a stated Non-Goal.
