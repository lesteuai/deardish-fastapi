# DearDish

DearDish is an AI-powered foodtech demo: it helps people facing health challenges enjoy restaurant-style meals adapted to their needs. Users register with email and password, record a health profile, browse a seeded catalog of dishes, stream an AI adaptation of a dish tailored to their profile, and save adapted meals. Built with SvelteKit 2 + Svelte 5 + TypeScript on bun, drizzle-orm + postgres.js on the Neon Postgres database, and the Vercel AI SDK (`streamText`) through `@openrouter/ai-sdk-provider`.

## Commands

- `bun install` - install dependencies
- `bun run dev` - dev server (bun auto-loads `.env`)
- `bun run build` - production build (`@sveltejs/adapter-node`, output in `build/`)
- `bun run preview` - run the built server on `:3000`; sets `ORIGIN=http://localhost:3000` and loads env via `node --env-file=.env` (adapter-node 403s local form POSTs without a matching `ORIGIN`)
- `bun run check` - `svelte-kit sync` + `svelte-check`
- `bun run lint` - `eslint .`
- `bun run test` - `vitest run` (unit tests only, no real env or db needed)
- `bun run db:push` - `drizzle-kit push` (create/sync tables on Neon)
- `bun run db:seed` - `bun run scripts/seed.ts` (idempotent, replaces dishes by name)

Env loading: bun and vite auto-load `.env`; the built server needs `node --env-file=.env` (the `preview` script does this).

## Architecture Map

### Routes (`src/routes/`)

- `/` (`+page.svelte`) - public landing page with DearDish branding and mission text.
- `+layout.server.ts` returns `locals.user` to the shared nav (`+layout.svelte`); `src/hooks.server.ts` resolves `locals.user` on every request from the `deardish_session` cookie via `validateSession`.
- `auth/login`, `auth/register` - form actions validating with zod schemas; on failure return `fail(400, { errors, values })` with visible field errors; on success set the session cookie and redirect to `/menu`.
- `auth/logout` - POST action; destroys the session, clears the cookie, redirects to `/auth/login`.
- `(app)/` - protected group. Its `+layout.server.ts` redirects to `/auth/login` (302) when `locals.user` is null. Contains `menu` (seeded dish list), `menu/[id]` (dish detail, `error(404)` on unknown id, link to `/adapt/[dishId]`), `meals` (saved meals with delete), `profile` (health profile form), `adapt/[dishId]` (streaming adaptation UI).
- `api/adapt` (POST) - auth required (401 JSON without session); validates `dishId` with zod (400), unknown dish 404; returns a plain text streaming Response from `createAdaptationResponse`.
- `api/meals` (POST, 201 `{ id }` or 400 field errors), `api/meals/[id]` (DELETE, 204 or 404). Owner-scoped: another user's meal id behaves as 404.

### Server modules (`src/lib/server/`)

- `auth.ts` - email/password auth: scrypt password hashing (`salt:hash` hex), random 32-byte base64url session tokens stored as sha256 hashes (sessions PK), 7-day expiry, `registerUser` (duplicate email via unique-violation 23505 returns conflict), `authenticate`, `createSession`, `validateSession`, `destroySession`, cookie helpers (`httpOnly`, `sameSite lax`, path `/`).
- `db/index.ts` - postgres.js client from `PG*` env vars, `ssl: 'require'`, `prepare: false` (the Neon pooler does not support prepared statements reliably), `max: 10`; drizzle instance with the schema. `db/schema.ts` - drizzle tables.
- `profile.ts` - `getProfile`, `saveProfile` (validates with `profileSchema` before any write; atomic reject; upsert on `health_profiles`).
- `meals.ts` - `saveMeal`, `listMeals` (owner-scoped, newest first), `deleteMeal` (owner-scoped delete; uuid-checked).
- `ai/prompt.ts` - pure `buildAdaptPrompt(dish, profile)` with a general healthy-cooking fallback when every profile field is empty.
- `ai/adapt.ts` - `createAdaptationResponse(dish, profile)`: `createOpenRouter({ apiKey })` + `streamText({ model: openrouter.chat(model) })`, probes the stream for the first text chunk so a pre-stream provider failure returns a 502 JSON `{ error }` Response; otherwise returns `createTextStreamResponse`.

### Contracts

- `src/lib/schemas.ts` - zod schemas (`registerSchema`, `loginSchema`, `profileSchema`, `adaptRequestSchema`, `mealSchema`) plus `zodFieldErrors(issues)` mapping zod issues to `Record<string, string>` field errors. All input validation goes through these.

## Conventions

- Svelte 5 runes (`$props`, `$state`, `$derived`, `{@render children()}`); snippets not slots.
- Form actions return `fail(400, { errors, values })`; `errors` comes from `zodFieldErrors`, `values` re-fills the form.
- All meal/profile queries are owner-scoped (filter by the session user id).
- Test files are colocated with source but never use the `+` prefix under `src/routes/` (SvelteKit reserves it; `svelte-kit sync` crashes on `+`-prefixed test files). Unit tests mock the `db` and `auth` modules (`src/lib/server/db`, `src/lib/server/auth`) with `vi.mock`; no test needs real env vars or a database.
- Styling is plain CSS in `src/app.css` (warm food palette, no CSS framework).
- Minimal comments; no em dashes in code or docs.
- `bun run build` output is `build/` (adapter-node); `drizzle-kit` migrations dir is `drizzle/`.

## Data Model

Five tables in `src/lib/server/db/schema.ts` (uuid ids via `gen_random_uuid()`):

- `users` - `email` (unique, stored lowercase), `password_hash`, `created_at`.
- `sessions` - `token_hash` (sha256 of the cookie token, PK), `user_id` (cascade), `expires_at`.
- `health_profiles` - `user_id` (PK, cascade), `conditions`, `allergies`, `dietary_preferences`, `notes` (nullable), `updated_at`.
- `dishes` - `name`, `cuisine`, `description`, `ingredients` (jsonb string array).
- `meals` - `user_id` (cascade), `title`, `content`, `source_dish_id` (set null), `created_at`.

Seed: `scripts/seed.ts` exports `seedDishes` (6 restaurant-style dishes) and replaces dishes by name (idempotent). Run with `bun run db:seed` after `bun run db:push`.

## Env Vars

See `.env.example`; never commit `.env` (already in `.gitignore`):

- `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` - Neon Postgres connection.
- `AI_API_KEY`, `AI_MODEL` - OpenRouter-compatible endpoint for streamed adaptations.

## Docs

- `docs/agent-docs/README.md` - index of agent docs.
- Feature docs for this demo: `docs/agent-docs/specs/261015-deardish-demo/` (SPEC.md, PLAN.md, TASKS.md, REPORT.md).
