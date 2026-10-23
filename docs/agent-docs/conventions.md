# Conventions

## Input and form handling

Python request schemas are centralized in `backend/schemas.py`. Pydantic models use strict strings, forbid extra fields, normalize emails, trim profile/title fields, and enforce lengths. `field_errors` retains the first issue for each field. `backend/main.py` handles JSON parsing and validation explicitly, returning 400 JSON `{error, errors?}` rather than default 422. Protected APIs authenticate before body validation, after mutation-origin checks.

SvelteKit auth/profile actions send form data through `backendJson`, map backend field errors into `fail(..., { errors, values })`, and use friendly service errors for backend failures. Auth actions return only the submitted email in values, never passwords (`src/routes/auth/login/+page.server.ts`, `src/routes/auth/register/+page.server.ts`, `src/routes/(app)/profile/+page.server.ts`). Frontend presentation types live in `src/lib/types.ts`; validation and persistence decisions stay in Python.

## Authentication and data ownership

`src/hooks.server.ts` resolves a present session cookie through Python and attaches the user to locals, using null on lookup failure. Protected loaders and profile actions guard `locals.user` directly in addition to `(app)/+layout.server.ts`; layout guards do not serialize child server loads. Python resolves the session independently for protected APIs (`backend/main.py`). Profile and meal data access accepts and filters by the authenticated user's id (`backend/repository.py`).

Session cookies are HTTP-only, SameSite=Lax, path `/`, seven-day expiry, and secure on HTTPS. Python preserves URL-safe session tokens and SHA-256 digests, plus legacy scrypt `salt:hash` hex with N=16384, r=8, p=1, dklen=64 and the literal hex salt string as salt bytes. Digest comparisons use `hmac.compare_digest` (`backend/auth.py`, `backend/main.py`).

The server bridge uses native fetch to a configured/local/public-origin target and forwards only `deardish_session`, not arbitrary browser headers. It relays only that cookie from backend responses and sends the public Origin on mutations (`src/lib/server/backend.ts`). Python uses its explicit trusted-origin set and rejects cross-site mutations, with JSON bodies required where applicable (`backend/main.py`). See [Workflows](workflows.md) for `APP_ORIGIN` and hosted/local defaults.

## Database and streaming boundaries

Use fixed application-owned SQL with Embar `QuerySingle(sql, params)`, named placeholders such as `%(user_id)s`, and separate parameter mappings. `fetch_models` calls `db.fetch` and validates dictionaries using Pydantic `model_validate`; writes also use `db.execute(QuerySingle(...))` (`backend/db.py`, `backend/auth.py`, `backend/repository.py`). Ordinary data values must never be interpolated through Embar SQL templates. A fresh Embar wrapper shares the bounded pool for each `get_db()` call because its operation context is mutable.

Profile updates use one validated upsert. Meal reads/deletes always include owner id; missing or invalid source dishes become null, with a key-share existence check protecting concurrent deletion (`backend/repository.py`). Startup performs no setup or seed writes. Preserve historical SQL and legacy records; explicit management uses Psycopg, while runtime CRUD uses Embar (`backend/manage.py`, `drizzle/*.sql`).

Stream plain UTF-8 text rather than SSE. Buffer the first nonempty AI text before committing the response, return friendly 502 JSON for pre-text failures, abort on mid-stream failure, and close the iterator in all paths. Keep provider details out of response text. The client keeps partial text visible but saving disabled after interruption (`backend/ai.py`, `src/routes/(app)/adapt/[dishId]/+page.svelte`).

## Svelte and tests

The project uses Svelte 5 runes and snippets. Component, hook, bridge, and route tests use Vitest; `vite.config.ts` selects jsdom and includes `src/**/*.test.ts`. Route-level tests use ordinary filenames such as `auth-actions.test.ts` rather than a `+`-prefixed name. Frontend tests exercise HTTP contracts with mocks rather than importing retired TypeScript business modules (`src/lib/server/backend.test.ts`, `src/routes/auth/auth-actions.test.ts`).

Python tests live in `backend/tests/` with pytest-asyncio auto mode (`backend/pyproject.toml`). The autouse fixture clears inherited PG/AI settings. Persistence and integrated tests use a temporary PostgreSQL cluster and fresh databases from `test_database`, never the configured application database (`backend/tests/conftest.py`). Integrated tests run real Vite/FastAPI processes with controlled AI streaming (`backend/tests/test_deployment.py`, `backend/tests/deployment_harness.py`). See [Workflows](workflows.md) for binary prerequisites.

## Data changes and styles

Database table definitions remain in historical `drizzle/*.sql`; typed rows are in `backend/models.py`. Fresh setup and insert-only seeding are explicit commands in `backend/manage.py`, with catalog data in `backend/seed.json`. Existing configured databases need no setup or migration. The former Drizzle config, TypeScript seed/backend, and Zod schemas have been retired.

Keep styles in plain CSS using the existing tokens in `src/app.css`. The shell references brand assets and the remote font stylesheet in `src/app.html`. Keep comments minimal and avoid em dashes in code and documentation.
