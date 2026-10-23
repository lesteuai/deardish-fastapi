# Documentation Index

## Current references

- [Agent Guide](../../AGENTS.md): project orientation, migration boundaries, commands, and conventions.
- [Architecture](architecture.md): FastAPI, the SvelteKit HTTP bridge, persistence, streaming, and same-origin routing.
- [Directory Map](directory-map.md): current source, tests, assets, configuration, and generated output.
- [Conventions](conventions.md): validation, session compatibility, ownership, SQL parameter binding, and test patterns.
- [Workflows](workflows.md): dependency installation, runtime environment handling, local servers, isolated tests, database safeguards, and deployment limits.
- [User Guide](../../USER-GUIDE.md): account, profile, adaptation, and saved-meal operations.

## Current migration reference

`specs/261023-fastapi-langchain-embar/` is the current backend migration source of truth:

- [SPEC.md](specs/261023-fastapi-langchain-embar/SPEC.md): revision 1, status verified, with per-criterion Phase 5 evidence.
- [PLAN.md](specs/261023-fastapi-langchain-embar/PLAN.md): revision 4, including parameterized Embar queries and the frontend/backend boundary.
- [TASKS.md](specs/261023-fastapi-langchain-embar/TASKS.md): complete, with T1 through T7 implementation commits and execution notes.

Recorded final validation passed 77 backend tests, 76 frontend tests, both stacks' lint/type checks, and the frontend production build as the last validation command. Real local HTTP and component tests ran. Interactive browser testing was skipped because playwright-mcp was unavailable; hosted Vercel deployment remains unverified. This documentation pass does not rerun validation.

## Historical archives

- [Verified demo spec](specs/261015-deardish-demo/SPEC.md), [plan](specs/261015-deardish-demo/PLAN.md), [tasks](specs/261015-deardish-demo/TASKS.md), and [report](specs/261015-deardish-demo/REPORT.md): preserve the original implementation and verification. Their TypeScript backend and adapter-node commands are historical, not current operating instructions.
- [Image/theme plan](plans/261014-deardish-image-theme/PLAN.md): historical branding work, with tasks and report in the same directory.
- [AI recipe opportunities research](research/deardish-ai-recipe-opportunities-2026-10-18.md): dated product research, separate from the current migration contract.

Historical specs, plans, and research remain unchanged.
