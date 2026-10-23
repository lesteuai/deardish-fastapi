# Directory Map

## Application source

- `src/routes/` contains SvelteKit route files. Top-level pages and layouts provide the public home page and shared navigation.
- `src/routes/auth/` contains login, registration, and logout flows.
- `src/routes/(app)/` contains the authenticated menu, dish details, profile, adaptation, and saved-meal pages. The route group's server layout requires `locals.user`.
- Protected page loaders and profile actions also guard `locals.user` directly; their backend operations use HTTP calls to Python.
- `src/lib/server/backend.ts` contains the native-fetch bridge, known session-cookie relay, and backend error translation. Its colocated test is the remaining server-module test.
- `src/lib/types.ts` contains frontend auth/profile/dish/meal presentation types; `src/hooks.server.ts` resolves sessions through the bridge.
- The former TypeScript `/api` handlers, auth/profile/meals/AI/database modules, and shared Zod schemas are retired. `/api/*` is served by Python.
- `src/lib/ui/` contains reusable components such as `Button.svelte`, `Dropdown.svelte`, and `RecipeCard.svelte`.
- `src/app.css` defines global styles; `src/app.html` provides the HTML shell and asset/font links.

## Python backend

- `backend/main.py` exposes FastAPI auth, profile, catalog, meal, adaptation, and health endpoints, cookie/origin handling, and shutdown cleanup.
- `backend/auth.py` preserves legacy scrypt and session-token formats.
- `backend/db.py` supplies lazy shared Psycopg pooling, fresh Embar wrappers, parameterized query execution, and typed result validation.
- `backend/models.py` defines existing-schema row models; `backend/schemas.py` validates request bodies.
- `backend/repository.py` implements owner-scoped profiles/meals and catalog reads.
- `backend/ai.py` streams LangChain ChatOpenRouter text; `backend/prompt.py` holds adaptation and original-recipe-format prompt references.
- `backend/manage.py` provides explicit setup/seed/check commands; `backend/seed.json` holds the six-dish catalog and image seed data.
- `backend/tests/` contains unit, real PostgreSQL, and integrated HTTP tests. `conftest.py` owns isolated clusters/databases; `deployment_harness.py` and `integration_app.py` support controlled integrated verification.
- `backend/pyproject.toml`, `backend/uv.lock`, and `backend/.python-version` declare Python 3.14 dependencies, checks, and locked resolutions.

## Other project directories

- `static/` contains the app manifest and image assets served as static files.
- `scripts/sql/` preserves historical recipe/image population SQL. The current insert-only seeder is Python, not these update scripts.
- `drizzle/` preserves three historical SQL migrations plus journal/snapshot metadata. Python fresh setup reads the top-level SQL files (`backend/manage.py`).
- `docs/agent-docs/` contains current references and an index distinguishing the current migration from historical specs, plans, and research.
- `venv/` is the isolated root Python environment selected by package scripts. `.gitignore` also excludes `.venv/`, `backend/.venv/`, Python caches, and local secrets.
- `.svelte-kit/`, `.vercel/`, and `build/` are generated framework/deployment paths when present. ESLint ignores them and Python environments/caches (`eslint.config.js`).

## Tests and configuration

Frontend tests use the `*.test.ts` suffix and are colocated under `src/`; Vitest uses jsdom (`vite.config.ts`). Backend tests use pytest under `backend/tests/` (`backend/pyproject.toml`).

Root configuration includes `package.json`, `svelte.config.js`, `vite.config.ts`, `vercel.json`, `tsconfig.json`, and `eslint.config.js`. `vercel.json` selects frontend/backend Services without changing API/page paths; Vite proxies `/api` in dev and preview. `drizzle.config.ts` is retired. `.env.example` lists runtime keys; agents must not inspect `.env`.
