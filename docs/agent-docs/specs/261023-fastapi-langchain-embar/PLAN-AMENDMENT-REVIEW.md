# Adversarial Review: PLAN revision 4 amendment (Embar parameterized API correction)

## Review identity

- Artifact: /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/PLAN.md, revision 4 (scoped amendment of revision 3, which this review round previously AGREED)
- Upstream: /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/SPEC.md, revision 1 (approved; unchanged)
- Prior reviews: SPEC-REVIEW.md (spec revision 1, AGREED); PLAN-REVIEW.md (plan revisions 1-3, AGREED at revision 3); TASKS-REVIEW.md (tasks revision 1, AGREED per TASKS.md execution rules)
- Amendment trigger: real isolated-PostgreSQL T2 testing, 7 failures reporting `Unexpected interpolation type str/UUID` from Embar's template SQL engine
- Verdict: AGREED

## Summary

The amendment is sound, correctly scoped, and evidence-backed. The claim it corrects was mine as well: PLAN revision 3 (and my round-1 report, relying on the Embar raw-SQL guide's prose) attributed psycopg-style value parameterization to `db.sql(t"...")`. Reality, now verified from committed code and Embar's own API reference, is that template interpolation is identifier-only; ordinary str/UUID interpolations are rejected at runtime. The revision 4 design substitutes the documented `QuerySingle(sql, params)` with `AsyncPgDb.fetch()`/`execute()` and fixed application-owned SQL strings with psycopg named placeholders, validating `fetch`'s returned dictionaries against the T1 Pydantic row models. I independently fetched both cited reference pages and every signature matches: `QuerySingle.__init__(sql: str, params: dict[str, Any] | None = None)` using `%(name)s` placeholders, `AsyncPgDb.execute(query: QuerySingle) -> None`, `AsyncPgDb.fetch(query: QuerySingle | QueryMany) -> list[dict[str, Any]]` (column-keyed dicts, empty when no description), and `sql(template)` retained for identifier interpolation. The committed `backend/repository.py` demonstrates the failing pattern firsthand in seven operations, confirming the factual basis and the size of the T2 correction. Parameter binding is preserved through a strictly safer mechanism (separate params mapping, fixed strings), every approved behavior contract is untouched, and SPEC.md revision 1 criteria are unchanged, so no behavior or acceptance re-verification is structurally required.

## Evidence and coverage

- Failing-pattern grounding: backend/repository.py contains seven `db.sql(t"...").model(...)` operations interpolating plain str/UUID values (`get_profile`, `save_profile`, `get_dish`, `list_meals`, `get_meal`, `save_meal`, `delete_meal`), plus one value interpolation in backend/auth.py L120 (`DELETE FROM sessions WHERE token_hash = {token_hash}`). These are precisely the calls the T2 runtime rejected, so the amendment's motive claim does not rest on assertion.
- Reference fidelity (fetched this round, no guessing): embar.rdrn.me/reference/embar/query/query/ documents `QuerySingle` (sql: str, params: dict) with the `%(my_var_name)s` named-placeholder convention and `merged()` restricted by docstring to DDL printing. embar.rdrn.me/reference/embar/db/pg/ documents `AsyncPgDb.execute(query: QuerySingle)`, `AsyncPgDb.fetch(query: QuerySingle | QueryMany) -> list[dict[str, Any]]` (rows built from `cur.description`, `[]` when `description is None`), `executemany`, retained `sql(template)`, and the query builders (`select`/`insert`/`update`/`delete`). Each rewritten plan clause in PLAN.md L26 maps to a documented signature.
- Row-model fit: backend/models.py (committed T1) defines Pydantic `DbRow` subclasses covering every queried shape (`AuthUser`, `Session`, `HealthProfile`, `Image`, `DishSummary`, `Dish`, `Meal`) with UUID, `list[str]` JSONB, and timestamptz `datetime` fields and a camelCase alias generator with `populate_by_name`, so `fetch`'s snake_case keyed dictionaries validate directly and serialize to the existing camelCase frontend contract. PLAN L12's "small shared typed result-validation helper if useful" remains an optional convenience, consistent with TASKS T2's conditional `db.py` file entry.
- Scope isolation: comparing revision 4 against the revision 3 text in the round-3 review, changes are confined to PLAN L12 (helper clause), PLAN L26 (the rewritten database-access clause), and new Agreement/Amendments sections (L80-L84). Architecture, HTTP contracts, origin rules (including the revision-3 `VERCEL_ENV` hosted/development distinction), seeding determinism, connections, stream semantics, Libraries, Risks, and Verification are unchanged. SPEC.md remains revision 1 with unchanged criteria.
- Task alignment: TASKS.md revision 1 (previously AGREED) now labels itself "Plan: PLAN.md revision 4 (amendment review pending)" and updates only T2's files (adds `backend/tests/conftest.py`, conditional `backend/db.py` helper) and its Do line (parameterized `QuerySingle` + `fetch/execute`, validating with T1 Pydantic models); Waves, file sets for T1/T3-T7, the AC coverage matrix, execution rules, and execution notes are unchanged. T2's tests line retains the real-PostgreSQL UUID/timestamp/JSONB/returning/join round-trip obligations that this correction is meant to satisfy.
- Parameter-binding safety: fixed application-owned SQL strings plus a separate params dict passed to `cursor.execute(sql, params)` is strictly safer than value-in-template interpolation, matching psycopg3's documented named-placeholder contract (already cited in PLAN's context7 list); `merged()` inlining remains Embar-internal DDL printing and is explicitly outside the plan's intended path ("values are passed separately in the params mapping").
- Runtime-path realism: `AsyncPgDb.execute` commits after execution (`_commit_after_execute: True`), `fetch` returns `[]` when there is no result description, so the plan's read-via-fetch / write-via-execute split maps one-to-one onto repository operations (reads returning `model_validate`-ed rows; the profile upsert and meal insert need `RETURNING`, which `fetch` supports through `QuerySingle` as implemented for single queries).

## Findings

None open. The amendment has no unresolved defect; the notes below are recorded observations, not defects.

- AM1 (factual basis): resolved by direct inspection of the committed failing pattern and real-PG test trigger.
- AM2 (API fidelity): resolved against both cited official reference pages, independently fetched this round.
- AM3 (spec invariance and scope): resolved by full-text comparison against the agreed revision 3; behavior contracts and governing acceptance criteria are untouched.
- AM4 (task alignment): resolved; T2 is the only task needing corrected wording, the conftest fixture is owned per the existing execution rules, and no other task's substance is affected.

## Disposition of all findings

| ID | State | Main-agent response assessed | Reviewer conclusion and evidence |
|---|---|---|---|
| AM1 | resolved | Revision 4 amendments section records the real-PG T2 failures (7 `Unexpected interpolation type str/UUID`) as the trigger | Committed backend/repository.py (seven value-interpolating operations) and backend/auth.py L120 show exactly the rejected pattern; motive claim verified |
| AM2 | resolved | Correction to documented `QuerySingle` + `AsyncPgDb.fetch/execute` with fixed SQL and named placeholders | Both reference pages fetched this round and every signature/behavior matches the rewritten PLAN L26 clause |
| AM3 | resolved | SPEC.md revision 1 unchanged; only the database-access mechanism corrected, preserving parameter binding and approved behavior | Revision 4 diff against agreed revision 3 confined to L12, L26, and appended Agreement/Amendments sections |
| AM4 | resolved | TASKS T2 files add conftest and optional db.py helper; precise corrected API wording; other tasks same | TASKS.md revision 1 diff shows only the T2 entries and plan-reference line changed; coverage matrix and execution rules intact |

## Unresolved decisions and evidence gaps

- None requiring user input. Hosted Vercel behavior remains the plan's labeled unverified surface (unchanged policy), and personal observation limits apply below; neither blocks the amendment. The implementing T2 correction is expected to be followed by the same real-PostgreSQL round-trip evidence promised in the T2 task tests before its done-gate closes.

## Agreement statement

AGREED. I accept the PLAN.md revision 4 amendment as a faithful, verified-by-official-reference correction of an infeasible design detail that real testing exposed, without changing any approved behavior, acceptance criterion, or task structure. The amendment section's own gate ("reopen only the plan gate before correcting T2") is satisfied by this review, and with it I reaffirm my revision-3 agreement on the remainder of the plan. Correctness of the eventual T2 code under the corrected API is a matter for T2's testing worker against the isolated PostgreSQL instance, exactly as the existing task contract already requires.

## Next action

Main agent records this amendment agreement (PLAN revision 4 approved under the delegated policy, SPEC revision 1 unchanged, TASKS revision 1 alignment accepted), unblocks the T2 implementation worker to rewrite the rejected `db.sql(t"...")` value interpolations to `QuerySingle` + `fetch/execute` with named placeholders, and proceeds under the unchanged task execution rules. I return for subsequent rounds when round gates or the final verification pass request review.

## File list

- /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/PLAN.md (reviewed, revision 4, unchanged by this review)
- /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/PLAN-AMENDMENT-REVIEW.md (this report, written this round)
- /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/TASKS.md (cross-checked, revision 1 against plan revision 4, unchanged by this review)
- /app/backend/repository.py, /app/backend/models.py, /app/backend/db.py, /app/backend/auth.py (workspace evidence read for grounding, unchanged)

Review limitations: I did not read `.env` (per instruction), run git commands, or make production edits; no code was executed or modified, and the 7 reported failures are evidenced by the committed failing pattern rather than by running the tests myself. Reference conclusions rest on the fetched Embar API reference pages for embar 0.4.0 (no local installation executed); hosted Vercel Services behavior remains unverified by design pending deployment access, as previously recorded in PLAN Risks and prior review rounds.
