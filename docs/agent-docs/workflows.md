# Workflows

The commands below are defined by `package.json`. The repository requires bun according to `README.md`.

## Install, develop, build, and check

- Install dependencies: `bun install`
- Start Vite development mode: `bun run dev`
- Build: `bun run build`
- Run tests: `bun run test` (`vitest run`)
- Run type checking: `bun run typecheck` (`svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`)
- Lint: `bun run lint` (`eslint .`)

The current SvelteKit adapter is `@sveltejs/adapter-vercel`, configured in `svelte.config.js`. The `preview` script in `package.json` invokes `build/index.js`, but this is not confirmed to match the current Vercel adapter's build output. Verify deployment and preview commands against the chosen environment before use.

## Database scripts

- Generate SQL migration files: `bun run db:generate`
- Apply migrations: `bun run db:migrate`
- Seed the dish catalog: `bun run db:seed`

These scripts are defined in `package.json`; `drizzle.config.ts` selects PostgreSQL, points at `src/lib/server/db/schema.ts`, and writes migration artifacts to `drizzle/`. There is no `db:push` script in the current package manifest. `README.md` describes `db:push` in its quickstart, so that instruction does not match the currently declared scripts.

## Environment and services

`src/lib/server/db/index.ts` reads PostgreSQL connection values from `PGUSER`, `PGPASSWORD`, `PGHOST`, and `PGDATABASE`. `src/lib/server/ai/adapt.ts` reads `AI_API_KEY` and `AI_MODEL` from SvelteKit's dynamic private environment. A checked-in `.env.example` was not found in the repository inventory; configure required values using the deployment environment or a local ignored `.env` file.

`vite.config.ts` configures jsdom tests and discovers `src/**/*.test.ts`. The tests include route and server-module coverage; consult each test's mocks to see whether the test contacts a real service.
