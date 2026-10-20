# Architecture

DearDish is a SvelteKit server-rendered application. Page data loads and form actions live alongside their pages in `src/routes/`; JSON endpoints live under `src/routes/api/`. Shared business logic, database access, and AI generation are in `src/lib/server/`.

## Request and authentication flow

`src/hooks.server.ts` reads the `deardish_session` cookie and resolves it with `validateSession`, assigning the result to `event.locals.user` for each request. `src/routes/+layout.server.ts` exposes that user to the shared layout. The `(app)` route group's server layout redirects anonymous visitors to `/auth/login`.

The login and registration page actions validate credentials with schemas in `src/lib/schemas.ts`, call functions in `src/lib/server/auth.ts`, set the session cookie, and redirect successful users to `/menu`. Logout destroys the stored session and clears the cookie. Authentication hashes passwords with Node's scrypt implementation and stores a SHA-256 hash of each random session token in the database. Sessions expire after seven days (`src/lib/server/auth.ts`).

## Routes and data flow

- `/` is the public landing page (`src/routes/+page.svelte`).
- `/menu` loads dishes from `dishes`; `/menu/[id]` loads one dish (`src/routes/(app)/menu/+page.server.ts`, `src/routes/(app)/menu/[id]/+page.server.ts`).
- `/profile` reads and saves the current user's health profile through `src/lib/server/profile.ts`.
- `/meals` lists saved meals; `/meals/[id]` displays a user-owned saved meal. Meal reads and deletes in `src/lib/server/meals.ts` are scoped by user id.
- `/adapt/[dishId]` hosts the adaptation UI. `POST /api/adapt` validates the session and dish id, loads the dish and profile, then calls `createAdaptationResponse` (`src/routes/api/adapt/+server.ts`).
- `POST /api/meals` validates and saves a meal; `DELETE /api/meals/[id]` deletes only a meal owned by the current user (`src/routes/api/meals/+server.ts`, `src/routes/api/meals/[id]/+server.ts`).

`src/lib/server/ai/prompt.ts` builds a prompt from dish information and profile fields. When all profile values are empty it includes general healthy-cooking guidance. `src/lib/server/ai/adapt.ts` streams model text through the Vercel AI SDK and returns JSON 502 errors for missing configuration or failures detected before the first text chunk.

## Persistence

`src/lib/server/db/index.ts` creates a postgres.js client using `PGUSER`, `PGPASSWORD`, `PGHOST`, and `PGDATABASE`, with SSL required, a maximum pool size of 10, and prepared statements disabled. Drizzle uses the tables in `src/lib/server/db/schema.ts`:

- `users` stores email and password hash.
- `sessions` stores token hashes, user references, and expiry timestamps.
- `health_profiles` stores conditions, allergies, dietary preferences, and notes per user.
- `dishes` stores catalog data and JSONB ingredient arrays.
- `meals` stores adapted recipe text per user and an optional source dish reference.

`scripts/seed.ts` supplies the catalog data. Drizzle configuration reads the schema and uses `drizzle/` for migrations (`drizzle.config.ts`).

## Client assets and install metadata

`src/app.html` links `static/manifest.json`, `static/favicon.jpg`, and Google Fonts. The manifest declares standalone display and uses `static/deardish.jpg` as its icon. No `src/service-worker.*` file exists in the current source tree.

## Deployment

`svelte.config.js` configures `@sveltejs/adapter-vercel` with the `nodejs24.x` runtime. `package.json` includes a `preview` script that invokes `build/index.js`, but that path belongs to the prior adapter-node workflow and has not been verified against the current adapter output.
