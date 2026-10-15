# DearDish

DearDish is an AI-powered foodtech demo that helps people facing health challenges enjoy restaurant-style meals adapted to their needs. A user registers with email and password, records a health profile (conditions, allergies, dietary preferences, notes), browses a seeded catalog of restaurant-style dishes, streams an AI adaptation of a dish tailored to that profile, and saves adapted meals for later.

The adaptation is a real streamed AI response: the server sends the dish data plus the diner's health profile to an OpenRouter-compatible model and streams the rewritten recipe back chunk by chunk.

## Features

- Email and password accounts with httpOnly session cookies and 7-day expiry.
- Health profile stored per user: conditions, allergies, dietary preferences, and free-text notes.
- Seeded catalog of six restaurant-style dishes across cuisines.
- Streamed AI adaptation of any dish to the signed-in user's profile, with a general healthy-cooking fallback when the profile is empty.
- Owner-scoped saved meals: save an adaptation, list it, and delete it.
- Plain CSS, warm food palette, no CSS framework.

## Tech stack

- SvelteKit 2 + Svelte 5 + TypeScript, run on bun.
- drizzle-orm + postgres.js against Neon Postgres.
- Vercel AI SDK (`streamText`) through `@openrouter/ai-sdk-provider`.
- zod for all input validation.
- vitest (jsdom) for unit tests.

## Requirements

- bun (package manager and runtime).
- A Neon Postgres database (or any Postgres reachable over SSL).
- An OpenRouter-compatible API key and model id.

## Quickstart

Copy `.env.example` to `.env` and fill in the values, then:

```bash
bun install
bun run db:push     # create/sync tables on Neon
bun run db:seed     # seed 6 restaurant-style dishes (idempotent)
bun run dev         # dev server
```

Open the printed local URL, register an account, and you land on the menu.

To run the production build locally:

```bash
bun run build
bun run preview     # node --env-file=.env build/index.js on :3000
```

## Environment variables

See `.env.example`. Never commit `.env` (already in `.gitignore`).

- `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` - Neon Postgres connection. The client connects with `ssl: 'require'` and `prepare: false` (the Neon pooler does not support prepared statements reliably).
- `AI_API_KEY`, `AI_MODEL` - OpenRouter-compatible endpoint used for streamed adaptations.

bun and vite auto-load `.env` in development. The built server does not, so the `preview` script runs it with `node --env-file=.env`.

## Scripts

| Command               | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `bun run dev`         | Vite dev server with HMR.                                             |
| `bun run build`       | Production build with `@sveltejs/adapter-node`, output in `build/`.   |
| `bun run preview`     | Runs the built server on `:3000` with `ORIGIN=http://localhost:3000`. |
| `bun run check`       | `svelte-kit sync` + `svelte-check` (types).                           |
| `bun run lint`        | ESLint over the project.                                              |
| `bun run test`        | `vitest run`, unit tests only.                                        |
| `bun run db:push`     | `drizzle-kit push`, create/sync tables on Neon.                       |
| `bun run db:generate` | `drizzle-kit generate`, write a SQL migration.                        |
| `bun run db:migrate`  | `drizzle-kit migrate`, apply migrations.                              |
| `bun run db:seed`     | `bun run scripts/seed.ts`, seed dishes (idempotent).                  |

Note: `bun run preview` pins `ORIGIN=http://localhost:3000` because adapter-node returns 403 on local form POSTs without a matching `ORIGIN`.

## Architecture

### Routes (`src/routes/`)

- `/` - public landing page with branding and mission text.
- `/auth/login`, `/auth/register` - form actions validate with zod. On failure they return `fail(400, { errors, values })` with visible field errors and refilled values. On success they set the session cookie and redirect to `/menu`.
- `/auth/logout` - POST action that destroys the session, clears the cookie, and redirects to `/auth/login`.
- `(app)/` - protected group. Its `+layout.server.ts` redirects to `/auth/login` (302) when there is no signed-in user. Contains:
  - `/menu` - the seeded dish list with name, cuisine, and description.
  - `/menu/[id]` - dish detail with ingredients and an "Adapt this dish" link. Unknown ids return 404.
  - `/adapt/[dishId]` - streams the adaptation and offers "Save as meal".
  - `/meals` - saved meals for the signed-in owner, with delete.
  - `/profile` - the health profile form.
- API:
  - `POST /api/adapt` - auth required (401 JSON without a session), validates `dishId` with zod (400), unknown dish 404, and returns a plain text streaming Response. If the AI provider fails before any content is sent it returns 502 friendly JSON.
  - `POST /api/meals` - 201 `{ id }` or 400 field errors.
  - `DELETE /api/meals/[id]` - 204 or 404. Owner-scoped: another user's meal id behaves as 404.

### Server modules (`src/lib/server/`)

- `auth.ts` - scrypt password hashing (`salt:hash` hex), random 32-byte base64url session tokens stored as sha256 hashes, 7-day expiry, and the cookie helpers (`httpOnly`, `sameSite lax`, path `/`). Duplicate email surfaces as a 23505 unique-violation conflict.
- `db/index.ts` - postgres.js client from the `PG*` env vars and the drizzle instance. `db/schema.ts` holds the tables.
- `profile.ts` - `getProfile`, `saveProfile` (validates before any write, atomic reject, upsert).
- `meals.ts` - `saveMeal`, `listMeals` (owner-scoped, newest first), `deleteMeal` (owner-scoped and uuid-checked).
- `ai/prompt.ts` - pure `buildAdaptPrompt(dish, profile)` with the general healthy-cooking fallback.
- `ai/adapt.ts` - `createAdaptationResponse(dish, profile)` builds the OpenRouter client and calls `streamText`, probes the first text chunk so a pre-stream failure becomes a 502 JSON error, then returns the text stream.

### Validation contracts

`src/lib/schemas.ts` holds the zod schemas (`registerSchema`, `loginSchema`, `profileSchema`, `adaptRequestSchema`, `mealSchema`) plus `zodFieldErrors`, which maps zod issues to `Record<string, string>` field errors. All input validation goes through these.

## Data model

Five tables in `src/lib/server/db/schema.ts` (uuid ids via `gen_random_uuid()`):

- `users` - `email` (unique, stored lowercase), `password_hash`, `created_at`.
- `sessions` - `token_hash` (sha256 of the cookie token, primary key), `user_id` (cascade), `expires_at`.
- `health_profiles` - `user_id` (primary key, cascade), `conditions`, `allergies`, `dietary_preferences`, `notes` (nullable), `updated_at`.
- `dishes` - `name`, `cuisine`, `description`, `ingredients` (jsonb string array).
- `meals` - `user_id` (cascade), `title`, `content`, `source_dish_id` (set null), `created_at`.

The seed in `scripts/seed.ts` exports `seedDishes` (six dishes) and replaces dishes by name, so re-running `bun run db:seed` is idempotent.

## Tests and checks

```bash
bun run lint
bun run check
bun run test
```

Unit tests run with vitest and jsdom, need no real env vars or database, and mock the db and auth modules with `vi.mock`. Test files live next to the source but never use the `+` prefix under `src/routes/` (SvelteKit reserves that prefix and `svelte-kit sync` crashes on it).

## Deployment

The build uses `@sveltejs/adapter-node`, so the output in `build/` is a standalone Node server started with `node --env-file=.env build/index.js`. Set the real public `ORIGIN` (and `PROTOCOL_HEADER` / `HOST_HEADER` behind a proxy) rather than the localhost value used by `preview`. Run `bun run db:push` and `bun run db:seed` once against the target database.

## Docs

- User guide for non-technical users: `USER-GUIDE.md`
- Spec: `docs/agent-docs/specs/261015-deardish-demo/SPEC.md`
- Plan and tasks: `docs/agent-docs/specs/261015-deardish-demo/PLAN.md`, `TASKS.md`
- Build report: `docs/agent-docs/specs/261015-deardish-demo/REPORT.md`
- Dev guide for agents: `AGENTS.md`
