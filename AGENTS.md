# DearDish

DearDish helps people facing health challenges adapt restaurant-style meals to their needs. SvelteKit provides pages, server-rendered loads, and form actions. A Python FastAPI backend owns authentication, PostgreSQL persistence through Embar, and recipe streaming through LangChain's OpenRouter integration. Existing accounts, sessions, profiles, catalog records, and meals retain their database formats.

## Tech Stack
- SvelteKit 2, Svelte 5, TypeScript, and Vite 8 (`package.json`)
- Python 3.14 and FastAPI 0.161.1 (`backend/pyproject.toml`)
- Embar 0.4.0 and Psycopg 3.3.6 with PostgreSQL
- LangChain 1.4.7 and langchain-openrouter 0.2.9 (`ChatOpenRouter`)
- Bun for frontend scripts, uv for the locked Python environment
- Vercel Services with adapter-vercel on `nodejs24.x`

## Directory Layout
- `backend/` - Python API, auth, persistence, AI, explicit database management, and tests.
- `src/` - Svelte pages, UI, presentation types, and the server-only HTTP bridge.
- `drizzle/` - Preserved historical SQL for explicit fresh-database setup.
- `scripts/sql/` - Historical recipe and image population SQL.
- `static/` - Public brand assets, dish images, and install manifest.
- `docs/agent-docs/` - Current references and historical workflow artifacts.

## Key Commands
- Install: `bun install`, then `bun run backend:install` with uv on PATH
- Build: `bun run build`
- Test: `bun run test`, `bun run backend:test` (isolated PostgreSQL prerequisites in workflows)
- Run: `bun run backend:dev` and `bun run dev` in separate terminals
- Lint: `bun run lint`, `bun run backend:lint`

## Conventions
- Keep database, auth, validation, and AI decisions in Python. `src/lib/server/backend.ts` is an HTTP bridge using native fetch, session-cookie relay, and friendly service errors.
- Use fixed SQL with Embar `QuerySingle(sql, params)`, named parameters, `fetch`/`execute`, and Pydantic `model_validate`. Keep data values out of SQL template interpolation.
- Scope every profile and meal operation to the authenticated user. Guard protected loaders/actions directly as well as the route layout.
- Preserve legacy scrypt hashes and SHA-256 session digests. Keep passwords out of returned form values.
- Startup performs no schema setup or seed writes. Existing configured databases need no setup or migration; management commands are explicit and seeding is insert-only.
- Keep PG/AI credentials in Python. Agents must not read `.env`; the application dev launcher may load it. See workflows for optional origins, backend URL, port, and SSL settings.
- Use Svelte 5 runes/snippets, plain CSS, and the tokens in `src/app.css`. Colocate `*.test.ts` tests; Python tests live in `backend/tests/`. Keep comments minimal and avoid em dashes.

## Agent Docs Index
- [Documentation Index](docs/agent-docs/README.md) - Current migration reference and historical archives.
- [Architecture](docs/agent-docs/architecture.md) - API, HTTP bridge, persistence, streaming, and routing.
- [Directory Map](docs/agent-docs/directory-map.md) - Source, tests, configuration, assets, and generated files.
- [Conventions](docs/agent-docs/conventions.md) - Validation, ownership, SQL binding, cookies, and tests.
- [Workflows](docs/agent-docs/workflows.md) - Installation, environment handling, local development, checks, and deployment limits.

## Specs and Plans
- Feature specs (sdd workflow): `docs/agent-docs/specs/<YYMMDD>-<slug>/`
- Implementation plans (pdd workflow): `docs/agent-docs/plans/<YYMMDD>-<slug>/`

<!-- docs-baseline: 58e37dad18ed273b182895e4e943761b12bb4bcf -->
