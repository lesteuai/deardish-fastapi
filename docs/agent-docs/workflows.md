# Workflows

The commands below are defined by root `package.json`. Run them from the repository root. Frontend dependencies use Bun; backend dependencies use uv, Python 3.14, `backend/pyproject.toml`, and `backend/uv.lock`.

## Install, develop, build, and check

- Install frontend dependencies: `bun install`
- Install backend dependencies: `bun run backend:install`
- Start Python in one terminal: `bun run backend:dev`
- Start Vite in another terminal: `bun run dev`
- Build: `bun run build`
- Preview the frontend build, keeping Python running: `bun run preview`
- Run tests: `bun run test` (`vitest run`)
- Run type checking: `bun run typecheck` (`svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`)
- Lint: `bun run lint` (`eslint .`)
- Backend lint: `bun run backend:lint` (`python -m backend.manage lint`, then Ruff)
- Backend type checking: `bun run backend:typecheck` (`python -m backend.manage typecheck`, then ty)
- Backend tests: `bun run backend:test` (`python -m backend.manage test`, then pytest; prerequisites below)

Install uv using the [official installation instructions](https://docs.astral.sh/uv/getting-started/installation/) and ensure `uv` is on PATH. Backend installation runs `UV_PROJECT_ENVIRONMENT=../venv uv sync --project backend --locked --python 3.14`. It selects the ignored root `venv/`, not a global Python environment. Python 3.14 is also declared in `backend/.python-version` and `backend/pyproject.toml`.

`backend:dev` runs `uv run --env-file .env --project backend --locked --python 3.14 uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000` with the same root environment. Loading `.env` is an application-launcher operation; agents must not inspect it. Backend lint/typecheck/test and database scripts have no `--env-file` option (`package.json`).

Vite dev and preview proxy `/api` to `BACKEND_URL` or `http://127.0.0.1:8000` and return friendly JSON 502 if Python is unavailable (`vite.config.ts`). The frontend preview command is `vite preview`. Production builds use `@sveltejs/adapter-vercel` on `nodejs24.x`, not an adapter-node `build/index.js` server (`svelte.config.js`).

Vite preview defaults to `http://localhost:4173`, which requires an explicit trusted origin. Start or restart Python with `APP_ORIGIN=http://localhost:4173 bun run backend:dev`, then run `bun run preview` in another terminal. Browse that exact hostname and port; use a matching `APP_ORIGIN` if you choose a different preview address.

## Database scripts

**Existing configured DearDish databases need no setup, migration, or reseeding.** Application startup performs none of these operations (`backend/main.py`, `backend/db.py`).

Only for a deliberately fresh database, export its PG values into the command environment, then use:

- Fresh-schema setup: `bun run db:setup`
- Optional missing-catalog inserts: `bun run db:seed`

These scripts run `uv run --project backend --locked python -m backend.manage setup` or `seed`, with `UV_PROJECT_ENVIRONMENT=../venv`. They do not load `.env`; use exported runtime PG settings. Never assume the development launcher's environment loading also applies to management commands (`package.json`).

Setup applies sorted historical `drizzle/*.sql` in a transaction under an advisory lock and records filenames in `public.deardish_schema_migrations`. It refuses preexisting application tables without that ledger and explains that existing DearDish databases need no setup. Repeated managed setup skips recorded files (`backend/manage.py`).

Seed reads `backend/seed.json`, inserts missing images with conflict-do-nothing, and assigns UUIDv5 dish ids from a fixed namespace and name. It skips existing ids or exact dish names, preserving legacy random ids and meal references. It never updates or deletes existing catalog rows. Historical `scripts/sql/` files contain update operations and are not the current insert-only seed workflow (`backend/manage.py`, `scripts/sql/populate-images.sql`, `scripts/sql/populate-dish-recipes.sql`).

The former `db:push`, `db:generate`, and `db:migrate` commands and Drizzle TypeScript configuration are not part of the current manifest. Preserved SQL remains the fresh-schema source, with row models in `backend/models.py`.

## Environment and services

`.env.example` supplies key names and blank placeholders. Configure local application values in an ignored `.env`, or export them; configure hosted values in deployment settings. Agents must not read `.env` or log credentials.

| Keys | Consumer and behavior |
| --- | --- |
| `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` | Python database config. Host/user/database must be nonempty; an absent password defaults to empty (`backend/db.py`). |
| `AI_API_KEY`, `AI_MODEL` | Python LangChain ChatOpenRouter config; missing values yield friendly adaptation 502 (`backend/ai.py`). |
| `PGPORT` | Optional PostgreSQL port. |
| `PGSSLMODE` | Optional SSL mode, default `require` even when blank. Isolated test databases explicitly use `disable`. |
| `BACKEND_URL` | Optional private frontend-to-Python address. The native-fetch bridge defaults to port 8000 in dev and the public request origin otherwise. Vite dev/preview proxies use this key with the port-8000 fallback (`src/lib/server/backend.ts`, `vite.config.ts`). Leave it unset on Vercel. |
| `APP_ORIGIN` | Optional trusted public origin, including a custom domain or nondefault local frontend port (`backend/main.py`). |

PG/AI credentials stay in Python. SvelteKit uses only HTTP integration, presentation types, and the private backend address. The bridge forwards the known session cookie, not arbitrary headers, and relays auth cookie changes (`src/lib/server/backend.ts`).

Origin checks use the public browser origin rather than an internal backend Host. With `VERCEL_ENV=production` or `preview`, Python trusts HTTPS origins derived from `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL`, plus a valid `APP_ORIGIN`; local defaults are omitted. Other modes, including `VERCEL_ENV=development` from `vercel dev`, allow HTTP localhost/127.0.0.1 on ports 5173, 3000, and 8000, plus a local HTTP `VERCEL_URL`. Set `APP_ORIGIN` to the exact public origin for custom domains or nondefault dev/preview ports. Foreign Origin and `Sec-Fetch-Site: cross-site` mutations return 403; missing Origin is permitted for server callers (`backend/main.py`).

## Isolated backend test prerequisites

Install frontend dependencies and the backend environment before the integrated suite. `backend/tests/test_deployment.py` uses the root `venv/bin/python`, `node_modules/.bin/vite`, and Node for legacy scrypt fixtures (`backend/tests/deployment_harness.py`).

Set `DEARDISH_TEST_POSTGRES_BIN` to a PostgreSQL distribution's bin directory containing executable `initdb` and `pg_ctl`. Run as an unprivileged user with permission to create temporary cluster files and start a local server. With a standard PostgreSQL installation exposing `pg_config` on PATH:

```bash
DEARDISH_TEST_POSTGRES_BIN="$(pg_config --bindir)" bun run backend:test
```

The directory must contain the server utilities; a client-only installation is insufficient. The fixture fails if the environment variable or required files are missing (`backend/tests/conftest.py`). The repository does not include a portable installer for these external PostgreSQL tools.

The fixture starts a fresh temporary PostgreSQL cluster on a free local port, creates a fresh database for each `test_database` invocation, applies historical setup there, and drops the database afterward. It stops the cluster at session end. An autouse fixture clears inherited `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGPORT`, `PGSSLMODE`, `AI_API_KEY`, and `AI_MODEL`. The integrated harness explicitly supplies isolated values and a controlled model seam. Tests must never use the configured application database (`backend/tests/conftest.py`, `backend/tests/deployment_harness.py`, `backend/tests/test_deployment.py`).

Frontend Vitest uses jsdom and discovers `src/**/*.test.ts`; tests cover the bridge, forms/loaders, components, streaming interruption, and save eligibility (`vite.config.ts`, `src/routes/(app)/adapt/adapt-page.test.ts`).

## Deployment and recorded verification

Root `vercel.json` defines Services with frontend root `./` and backend root `backend/`, entrypoint `main:app`. The first rewrite sends `/api/(.*)` to Python; the catchall sends page/static requests to SvelteKit with unchanged paths. `backend/.python-version` and `backend/pyproject.toml` select Python 3.14; `svelte.config.js` selects Node `nodejs24.x`. Configure Python PG/AI values and any custom `APP_ORIGIN` in the deployment environment; keep `BACKEND_URL` unset for same-origin Services routing.

The current migration's [SPEC verification](specs/261023-fastapi-langchain-embar/SPEC.md#verification) records both lint/typecheck suites passing, 76 frontend tests, 77 backend tests, real local Vite/FastAPI/PostgreSQL HTTP acceptance, and `bun run build` passing as the final validation command. It covers legacy auth/session compatibility, ownership, origin rejection, startup/seed preservation, Unicode streaming, pre-text errors, mid-stream transport abort, cancellation, and backend-unavailable errors. Controlled AI was used; no external model call was made.

That session used uv at `/tmp/opencode/uv/uv` and PostgreSQL binaries at `/tmp/opencode/postgres-tools/node_modules/@embedded-postgres/linux-x64/native/bin`. These are session-specific verification paths, not portable installation locations. Install uv on PATH and supply your own PostgreSQL server binary directory for future runs.

Interactive browser verification was skipped because playwright-mcp was unavailable; actual HTTP and component checks supplied local evidence. Hosted Vercel remains unverified, and no deployment was created. Backend pytest recorded an upstream LangChain/Pydantic v1 compatibility warning on Python 3.14.9. This documentation-only pass did not rerun checks, builds, servers, or database commands after final validation.
