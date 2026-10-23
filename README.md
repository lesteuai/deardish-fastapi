# DearDish

DearDish is an AI-powered foodtech demo that helps people facing health challenges enjoy restaurant-style meals adapted to their needs. A user registers with email and password, records a health profile (conditions, allergies, dietary preferences, notes), browses a seeded catalog of restaurant-style dishes, streams an AI adaptation of a dish tailored to that profile, and saves adapted meals for later.

The adaptation is a streamed AI response: Python sends the dish data plus the diner's health profile to OpenRouter through LangChain and streams the rewritten recipe back as plain UTF-8 text. A stream interruption shows an error and leaves saving disabled until a successful adaptation.

## Features

- Email and password accounts with httpOnly session cookies and 7-day expiry.
- Health profile stored per user: conditions, allergies, dietary preferences, and free-text notes.
- Seeded catalog of six restaurant-style dishes across cuisines.
- Streamed AI adaptation of any dish to the signed-in user's profile, with a general healthy-cooking fallback when the profile is empty.
- Owner-scoped saved meals: save an adaptation, list it, and delete it.

## Tech stack

- SvelteKit 2 + Svelte 5 + TypeScript, run on bun.
- Python 3.14 + FastAPI, with Pydantic request and database-row validation.
- Embar 0.4.0 + Psycopg async pooling against the existing PostgreSQL schema.
- LangChain with `langchain_openrouter.ChatOpenRouter`.
- Vitest (jsdom) for frontend tests; pytest, Ruff, and ty for Python.
- Vercel Services: SvelteKit frontend and Python backend on one public origin.

Versions and commands are declared in `package.json` and `backend/pyproject.toml`; Python resolutions are locked in `backend/uv.lock`.

## Requirements

- bun (package manager and runtime).
- uv on PATH, installed using the [official uv installation instructions](https://docs.astral.sh/uv/getting-started/installation/).
- Python 3.14, selected by the backend install script and `backend/.python-version`.
- A PostgreSQL database. SSL defaults to `require`, including when `PGSSLMODE` is blank.
- An OpenRouter API key and model id.

## Quickstart

Use `.env.example` as the key template for a local ignored `.env`: `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `AI_API_KEY`, and `AI_MODEL`. The application launcher may load that file; agents must not read it or emit secrets. Optional `PGPORT`, `PGSSLMODE`, `APP_ORIGIN`, and `BACKEND_URL` are explained in [Workflows](docs/agent-docs/workflows.md).

**An existing configured DearDish database needs no setup, migration, or reseeding.** Startup performs no schema or catalog writes. Install dependencies from the repository root:

```bash
bun install
bun run backend:install
```

Start two terminals from the repository root:

```bash
# Terminal 1: Python on http://127.0.0.1:8000, loading local .env
bun run backend:dev
```

```bash
# Terminal 2: SvelteKit with /api proxied to Python
bun run dev
```

Open the printed frontend URL. Sign in with an existing account, or choose **Create an account** on the sign-in page.

Only for a deliberately fresh, empty database, export its PG settings into the command environment before using `bun run db:setup` and, optionally, `bun run db:seed`. These scripts do not load `.env`. Setup applies preserved `drizzle/*.sql` with a ledger and refuses existing application tables without that ledger. Seeding reads `backend/seed.json`, inserts missing records, and preserves existing ids and dish names. See [database workflows](docs/agent-docs/workflows.md#database-scripts) before using either command.

To preview at Vite's default `http://localhost:4173`, start or restart Python with that public origin in one terminal:

```bash
APP_ORIGIN=http://localhost:4173 bun run backend:dev
```

Then build and preview in another terminal:

```bash
bun run build
bun run preview
```

Preview runs `vite preview` with an `/api` proxy. Use the same hostname and port as `APP_ORIGIN` for preview form/API mutations. The build uses adapter-vercel (`package.json`, `svelte.config.js`, `vite.config.ts`).

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Vite development server with `/api` proxy. |
| `bun run build` | Production frontend build with adapter-vercel. |
| `bun run preview` | Vite preview with `/api` proxy; Python runs separately. |
| `bun run typecheck` | SvelteKit sync and svelte-check. |
| `bun run lint` | ESLint. |
| `bun run test` | Vitest frontend tests. |
| `bun run backend:install` | Locked uv sync with Python 3.14 into ignored root `venv/`. |
| `bun run backend:dev` | Uvicorn reload server on port 8000; uv loads `.env`. |
| `bun run backend:lint` | Ruff via `backend.manage`. |
| `bun run backend:typecheck` | ty via `backend.manage`. |
| `bun run backend:test` | pytest, including isolated PostgreSQL and integrated HTTP tests. |
| `bun run db:setup` | Explicit fresh-schema setup using exported PG settings. |
| `bun run db:seed` | Insert-only catalog seeding using exported PG settings. |

Backend tests require PostgreSQL server binaries and frontend dependencies. With a standard PostgreSQL installation containing `initdb` and `pg_ctl`, run as an unprivileged user:

```bash
DEARDISH_TEST_POSTGRES_BIN="$(pg_config --bindir)" bun run backend:test
```

The fixture starts a temporary cluster and fresh test databases, clearing inherited PG/AI settings rather than using the configured database. See [Workflows](docs/agent-docs/workflows.md) for prerequisites and recorded verification.

## Deployment

Root `vercel.json` declares a frontend service rooted at `./` and a backend service rooted at `backend/` with entrypoint `main:app`. `/api/*` selects Python before the frontend catchall, preserving request paths. Python manifests select 3.14; `svelte.config.js` selects `nodejs24.x` for the frontend. Leave `BACKEND_URL` unset on Vercel so server-side bridge calls use the public origin. Configure private PG/AI values for Python and `APP_ORIGIN` for a custom public domain. Hosted Vercel deployment remains unverified; no deployment was created.

## Docs

- User guide for non-technical users: `USER-GUIDE.md`
- Current documentation and migration source of truth: [Documentation Index](docs/agent-docs/README.md).
- Current migration: `docs/agent-docs/specs/261023-fastapi-langchain-embar/` (SPEC revision 1, verified; PLAN revision 4; TASKS complete).
- Historical verified demo spec and build report: `docs/agent-docs/specs/261015-deardish-demo/`. Its original stack and commands describe that historical implementation.
- Dev guide for agents: `AGENTS.md`
