# Adversarial Review: FastAPI, LangChain, and Embar migration plan

## Review identity

- Artifact: /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/PLAN.md, revision 3
- Upstream: /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/SPEC.md, revision 1 (approved; SPEC-REVIEW.md agreed, main agent agrees, delegated autonomous approval recorded in SPEC.md Agreement section)
- Prior reviews: round 1 (PLAN revision 1, CHANGES REQUESTED, findings P1-P3), round 2 (PLAN revision 2, CHANGES REQUESTED, finding P4)
- Verdict: AGREED

## Summary

Revision 3 is a single-paragraph correction to the trusted-origin rule (PLAN.md L41) and nothing else; every other section was verified byte-identical to the already-reviewed revision 2. The correction answers round 2's P4 precisely and conservatively. Hosted mode is now pinned to `VERCEL_ENV` in {`production`, `preview`}, which per Vercel's system-environment model holds only on real deployments; development mode's local HTTP defaults (`http://localhost` and `http://127.0.0.1` on ports 5173, 3000, 8000) apply everywhere else, explicitly including `vercel dev`, and a local `VERCEL_URL=localhost:3000` is consumed as HTTP, removing the scheme mismatch. The verdict passes both observed vercel dev behaviors: where `VERCEL_ENV='development'` is injected (CLI source, restored values), the plan names it explicitly; where a CLI version leaves `VERCEL_ENV` undefined in vercel dev (issue 14450 output), undefined is neither `production` nor `preview`, so the plan's hosted gate still excludes it and local defaults remain allowed.

The fail-closed security posture is unchanged where it matters: on real preview and production deployments, local defaults are omitted, only the two HTTPS Vercel hostname origins plus optional `APP_ORIGIN` are trusted, and unknown origins receive 403. Combined with the previously verified pieces (Embar typed-SQL runtime layer and conflict APIs, historical drizzle DDL with migration ledger, scrypt/session format parity, deterministic UUIDv5 conflict-do-nothing seeding with skip-by-name legacy preservation, langchain/fastapi/embar version compatibility, Services rewrite shape, and the Verification section mapping AC-1 through AC-10 with `bun run build` as the final command), the plan now covers all spec acceptance criteria, all round-1 obligations, and all round-2 findings with no unresolved failure scenario I can construct from code or documentation.

## Evidence and coverage

- P4 correction (this round): PLAN.md L41 revised text verified directly; PLAN.md revision header confirms revision 3; sections L1-L10, L39-L48, and L72-L78 verified unchanged against the round-2 review, with the file's total line count intact at 78, so the correction is isolated to the trusted-origin paragraph.
- Hosted-vs-dev detection against Vercel evidence carried from round 2: vercel/vercel CLI source (packages/cli/src/util/dev/server.ts) injects `VERCEL_ENV='development'` and `VERCEL_URL = address.host` under `vercel dev`; github.com/vercel/vercel issue 14450 reproduce-verifies `VERCEL_URL: 'localhost:3000'` (and `VERCEL_ENV` undefined on CLI 49.1.2). Both cases route to development mode under the revised rule and allow `http://localhost:3000`, unblocking the bridge's synthesized `event.url.origin` and all browser-direct `/api/*` mutations in that flow.
- Fail-closed retention on hosted deployments: the revised L41 keeps a hosted-mode branch (omit local defaults, HTTPS origins only, fail closed 403) shaped by the SPEC AC-9 requirement, unchanged in substance from the revision 2 rule that round 2 accepted.
- Round 1 and round 2 verifications carried forward without re-fetch: embar.rdrn.me raw-sql/insert/connection-pool pages (`db.sql(t"...").model(Model)`, `on_conflict_do_nothing`/`do_update`/`returning`, `AsyncPgDb` pool wrapping), PyPI metadata (embar 0.4.0 requiring Python >=3.14; fastapi 0.161.1; langchain 1.4.7 with langchain-core >=1.6.13 co-resolving with langchain-openrouter 0.2.9's langchain-core >=1.5.5), vercel.com/docs/services (`services` key, `/api/(.*)` first rewrite, catchall frontend, `entrypoint: "main:app"`, `vercel dev`), and workspace sources (src/lib/server/auth.ts scrypt/session formats, drizzle/*.sql schema, scripts/ts/seed.ts retirement baseline, src/routes/api/* contracts).

## Findings

None open. All findings from rounds 1 and 2 are resolved, as recorded in the disposition table below.

## Disposition of all findings

| ID | State | Main-agent response assessed | Reviewer conclusion and evidence |
|---|---|---|---|
| P1 (round 1) | resolved | Trusted origin set, exact-match plus `Sec-Fetch-Site: cross-site` rejection, JSON-only bodies, no permissive CORS, bridge sends `event.url.origin`, `APP_ORIGIN` documented for custom domains and nondefault ports (L41, L44) | Verified sound in rounds 2 and 3; mechanism accepted |
| P2 (round 1) | resolved | Verification section mapping AC-1 through AC-10 with per-task worker ordering, integrated flows, and `bun run build` as the final validation command; hosted recorded unverified (L72-L78) | Satisfies SPEC AC-10; nonblocking note stands: evidence rows destined for SPEC.md should be a revision-bumping evidence appendix rather than silent modification of the approved criteria |
| P3 (round 1) | resolved | Deterministic UUIDv5 dish ids, conflict-do-nothing, skip-by-name legacy-id preservation, fixed image ids, never update or delete (L31-L32) | Idempotent on fresh databases and non-destructive on legacy data; accepted in round 2, unchanged in revision 3 |
| P4 (round 2) | resolved | Revision 3 pins hosted mode to `VERCEL_ENV` `production`/`preview`, allows local HTTP defaults in development including `vercel dev`, and treats local `VERCEL_URL` as HTTP (L41) | Correct against both observed vercel dev variants (`VERCEL_ENV='development'` and undefined); fail-closed posture on real deployments preserved. Meets the round-2 required resolution exactly as allowed ("equivalent formulations acceptable") |

## Unresolved decisions and evidence gaps

- None requiring user input. Hosted Vercel Services runtime behavior remains the plan's own labeled unverified surface (L67, L78) pending deployment access, consistent with the spec's Non-Goals and the delegated approval policy; it does not block plan agreement.

## Agreement statement

AGREED. I accept PLAN.md revision 3 as-is against SPEC.md revision 1, with the following explicitly accepted notes: the Verification section records AC evidence into SPEC.md, which should be executed as a revision-bumping evidence appendix to the approved spec rather than modification of its approved criteria; and hosted Vercel Services behavior remains unverified by design until a real deployment is performed, as the plan itself records. Round-1 findings P1, P2, and P3 and round-2 finding P4 are all resolved; no new gaps were introduced by revision 3, whose only change is the corrected trusted-origin paragraph.

## Next action

Main agent records mutual agreement in REVIEWS or the review history (equivalent to an updated plan-review record for PLAN.md revision 3), marks the plan approved under the user's delegated autonomous-mode policy alongside SPEC.md revision 1, and proceeds to task decomposition. Task-level artifacts become the review subject of the next round per the approval policy.

## File list

- /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/PLAN.md (reviewed, revision 3, unchanged by this review; sole content change from revision 2 is the trusted-origin paragraph at L41)
- /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/SPEC.md (upstream, revision 1, unchanged)
- /app/docs/agent-docs/specs/261023-fastapi-langchain-embar/PLAN-REVIEW.md (this report, written this round, superseding the round-2 report content)

Review limitations: I did not read `.env` (per instruction), run git commands, or make production edits; no runtime code was executed and no deployed behavior was observed. The vercel dev environment values are evidenced from Vercel's open-source CLI source and community verification rather than from running `vercel dev` locally. Round-1 external-documentation verifications (Embar pages, LangChain/FastAPI/PyPI metadata, vercel.com/docs/services) are carried forward unchanged and were not re-fetched; the plan's Risks section retains the obligation to verify Embar runtime round-trips against a real PostgreSQL instance during implementation.
