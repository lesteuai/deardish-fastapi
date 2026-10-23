# Architecture

DearDish uses SvelteKit for presentation, server-rendered page loads, and form actions. FastAPI owns JSON endpoints, authentication, validation, persistence, and AI generation (`backend/main.py`). `src/lib/server/backend.ts` is the server-only HTTP bridge; the former TypeScript database, auth, AI, and `/api` implementations have been retired.

## Request and authentication flow

`src/hooks.server.ts` resolves a present `deardish_session` cookie through `GET /api/auth/session`, assigning the result to `event.locals.user`. Without a cookie, or if resolution fails, the user is null. `src/routes/+layout.server.ts` exposes that user to the shared layout. The `(app)` route group's server layout and individual protected page loaders redirect anonymous visitors to `/auth/login`.

Login, registration, and profile actions serialize form values to Python and map backend field errors into existing form results. Auth failures return only the submitted email, never passwords. Successful login/registration redirects to `/menu`; logout calls Python to destroy the session, relays cookie deletion, and redirects home (`src/routes/auth/*/+page.server.ts`, `src/routes/(app)/profile/+page.server.ts`).

The bridge uses native server `fetch`, not SvelteKit's internally dispatched `event.fetch`. It targets configured `BACKEND_URL`, defaults to `http://127.0.0.1:8000` in development, and otherwise uses the public request origin. It forwards only the known session cookie and sends the public Origin on mutations. It relays only `deardish_session` changes through SvelteKit cookies, with HTTP-only, SameSite=Lax, path `/`, seven-day expiry, and HTTPS-secure settings (`src/lib/server/backend.ts`).

Python preserves the legacy `salt:hash` password format: scrypt N=16384, r=8, p=1, dklen=64, using the literal hex salt string as salt bytes. Session tokens remain random URL-safe strings stored as SHA-256 digests, with seven-day expiry. Emails are normalized to lowercase and looked up case-insensitively; duplicate insert races are handled (`backend/auth.py`).

Python mutation handlers reject foreign Origin and `Sec-Fetch-Site: cross-site`. Optional `APP_ORIGIN` adds a custom public origin. Hosted mode (`VERCEL_ENV=production` or `preview`) trusts HTTPS platform hostnames from `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` and omits local defaults. Development, including `vercel dev`, allows localhost/127.0.0.1 on ports 5173, 3000, and 8000, plus a local HTTP `VERCEL_URL`. Missing Origin is permitted for server/non-browser callers; body endpoints require JSON and no permissive CORS is configured (`backend/main.py`).

## Routes and data flow

- `/` is the public landing page (`src/routes/+page.svelte`).
- `/menu` and `/menu/[id]` load catalog summaries and details through `/api/dishes` and `/api/dishes/{id}` (`src/routes/(app)/menu/`).
- `/profile` reads and saves the current user's profile through `GET`/`PUT /api/profile` (`src/routes/(app)/profile/+page.server.ts`).
- `/meals` and `/meals/[id]` load the current user's meals through Python (`src/routes/(app)/meals/`).
- `/adapt/[dishId]` loads its dish through the bridge; the browser posts `{dishId}` directly to same-origin `/api/adapt` (`src/routes/(app)/adapt/[dishId]/`).
- The browser saves adaptations with `POST /api/meals` and deletes with `DELETE /api/meals/{id}` (`src/routes/(app)/adapt/[dishId]/+page.svelte`, `src/routes/(app)/meals/+page.svelte`).

All `/api` handlers live in `backend/main.py`:

| Endpoint | Contract |
| --- | --- |
| `GET /api/health` | `{status: "ok"}` without database or AI access. |
| `GET /api/auth/session` | `{user}` or `{user: null}`. |
| `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Registration 201, login 200, logout 204; auth cookie creation/deletion. |
| `GET`/`PUT /api/profile` | Authenticated `{profile}`; validated atomic upsert. |
| `GET /api/dishes`, `/api/dishes/{id}` | Authenticated catalog in name order or detail with image, original content, and ingredients. Malformed id 400, unknown id 404. |
| `GET /api/meals`, `/api/meals/{id}` | Owner-scoped list/detail; malformed, unknown, or foreign meal id 404. |
| `POST /api/meals`, `DELETE /api/meals/{id}` | Owner-scoped save 201 `{id}`, delete 204. Invalid/missing source-dish references become null. |
| `POST /api/adapt` | Authenticated recipe text stream using dish and current profile. |

Protected APIs authenticate before parsing request bodies, after mutation-origin checks. Validation errors use 400 JSON `{error, errors?}` instead of default 422; anonymous access uses 401. Unexpected failures return a generic 500 (`backend/main.py`, `backend/schemas.py`).

`backend/prompt.py` contains adaptation prompts and the preserved `ORIGINAL_RECIPE_FORMAT_PROMPT` reference. It includes dish name, cuisine, description, ingredients, original recipe content, and populated profile fields, with healthy-cooking guidance when the profile is empty. Recipe-section and bold-change instructions are preserved.

`backend/ai.py` constructs LangChain `ChatOpenRouter` from `AI_API_KEY` and `AI_MODEL` and consumes `astream`. It buffers the first nonempty text chunk before returning `text/plain; charset=utf-8`, not SSE. Missing configuration, empty output, and provider failure before text return friendly 502 JSON. A later failure aborts the transport rather than adding an error to recipe text. The client displays an interruption and leaves saving disabled; the model iterator closes on completion, failure, or cancellation (`src/routes/(app)/adapt/[dishId]/+page.svelte`).

## Persistence

`backend/db.py` lazily creates a bounded Psycopg async pool with max size 10, connection/pool timeouts of 10 seconds, and prepared statements disabled. Each `get_db()` call returns a fresh Embar `AsyncPgDb` wrapper sharing that pool, avoiding shared mutable operation context during concurrent requests. Conninfo safely binds `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, optional `PGPORT`, and `PGSSLMODE`; SSL defaults to `require` for unset or blank values.

Runtime SQL uses Embar `QuerySingle(sql, params)` with named parameters and `fetch`/`execute`. `fetch_models` validates returned dictionaries with Pydantic `model_validate` against `backend/models.py`. `backend/auth.py` and `backend/repository.py` retain the historical PostgreSQL tables:

- `users` stores email and password hash.
- `images` stores catalog image locations and types.
- `sessions` stores token hashes, user references, and expiry timestamps.
- `health_profiles` stores conditions, allergies, dietary preferences, and notes per user.
- `dishes` stores catalog data and JSONB ingredient arrays.
- `meals` stores adapted recipe text per user and an optional source dish reference.

Profiles use an owner-keyed upsert. Meal reads/deletes constrain user id; meal saves validate titles and protect optional source references with a key-share existence check (`backend/repository.py`). UUIDs, JSONB ingredients, timezone timestamps, FK cascades, and set-null behavior remain defined by the preserved `drizzle/*.sql`.

Existing configured databases need no setup or migration. `backend/manage.py` explicitly applies historical SQL only for fresh setup, tracks filenames in `deardish_schema_migrations`, and refuses application tables without that ledger. Its seed command reads `backend/seed.json`, inserts missing images, and skips dishes with an existing id or exact name. It never updates or deletes catalog records. Imports/startup perform no schema or seed writes; FastAPI shutdown closes the pool (`backend/main.py`, `backend/db.py`).

## Client assets and install metadata

`src/app.html` links `static/manifest.json`, `static/favicon.jpg`, and Google Fonts. The manifest declares standalone display and uses `static/deardish.jpg` as its icon. No `src/service-worker.*` file exists in the current source tree.

## Deployment

`vite.config.ts` proxies `/api` to `BACKEND_URL` or `http://127.0.0.1:8000` in both development and preview, returning friendly 502 JSON when Python is unavailable. `package.json` runs `vite preview`, not `build/index.js`.

Root `vercel.json` declares frontend `root: "./"` and backend `root: "backend/", entrypoint: "main:app"`. The API-first rewrite selects Python; the catchall selects SvelteKit without changing paths. `svelte.config.js` configures adapter-vercel on `nodejs24.x`; `backend/.python-version` and `backend/pyproject.toml` select Python 3.14. Frontend source retains only HTTP integration and presentation, with private PG/AI values consumed by Python.

The current migration's `specs/261023-fastapi-langchain-embar/SPEC.md` records passing local HTTP/component verification and a final Vercel-adapter build. Interactive browser testing was skipped because playwright-mcp was unavailable. Hosted Vercel behavior remains unverified; no deployment was created.
