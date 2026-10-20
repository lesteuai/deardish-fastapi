# Directory Map

## Application source

- `src/routes/` contains SvelteKit route files. Top-level pages and layouts provide the public home page and shared navigation.
- `src/routes/auth/` contains login, registration, and logout flows.
- `src/routes/(app)/` contains the authenticated menu, dish details, profile, adaptation, and saved-meal pages. The route group's server layout requires `locals.user`.
- `src/routes/api/` contains adaptation and saved-meal HTTP endpoints.
- `src/lib/server/` contains server-only auth, data access, database schema/client, and AI code.
- `src/lib/ui/` contains reusable components such as `Button.svelte`, `Dropdown.svelte`, and `RecipeCard.svelte`.
- `src/app.css` defines global styles; `src/app.html` provides the HTML shell and asset/font links.

## Other project directories

- `static/` contains the app manifest and image assets served as static files.
- `scripts/` contains `seed.ts`, the dish catalog seeder.
- `drizzle/` contains a SQL migration and Drizzle journal/snapshot metadata.
- `docs/agent-docs/specs/` and `docs/agent-docs/plans/` contain feature workflow artifacts. The research note is in `docs/agent-docs/research/`.
- `build/` and `.svelte-kit/` are generated outputs when present; ESLint ignores `build/` and `.svelte-kit/` (`eslint.config.js`).

## Tests and configuration

Tests use the `*.test.ts` suffix and are colocated with the corresponding source under `src/`. `vite.config.ts` includes `src/**/*.test.ts` in Vitest and sets jsdom as the test environment. Root configuration includes `package.json`, `svelte.config.js`, `vite.config.ts`, `drizzle.config.ts`, `tsconfig.json`, and `eslint.config.js`.
