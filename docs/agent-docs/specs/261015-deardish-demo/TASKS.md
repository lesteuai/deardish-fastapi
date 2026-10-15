# Tasks: DearDish Demo

Status: complete (approved: auto-approved per session instruction)

## Wave 1
- [x] T1: Scaffold SvelteKit project with bun (commit 6bad2f8)
  - Satisfies: AC-1, AC-7
  - Files: `package.json`, `bun.lock`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `.env.example`, `src/app.html`, `src/app.d.ts`, `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `static/favicon.svg`
  - Do: Create the SvelteKit 2 + Svelte 5 + TypeScript project with bun (sv create into a temp dir, then move contents into the project root, keeping the existing `.env`, `.gitignore`, and `docs/`). Configure `@sveltejs/adapter-node` in `svelte.config.js`. Install ALL dependencies for the whole project now: runtime `drizzle-orm`, `postgres`, `zod`, `ai`, `@openrouter/ai-sdk-provider`; dev `drizzle-kit`, `vitest`, `jsdom`, `@testing-library/svelte`, `eslint`, `eslint-plugin-svelte`, `typescript-eslint`, `prettier`, `prettier-plugin-svelte`, `eslint-config-prettier`, `globals`, `svelte-check`. Scripts: `dev`, `build`, `preview` (runs `node --env-file=.env build/index.js`), `check` (svelte-kit sync + svelte-check), `lint`, `test` (vitest run). Add a vitest section to `vite.config.ts` (environment jsdom, include src/**/*.test.ts) so later test tasks work. Write a plain CSS stylesheet (`src/app.css`) with a warm food-style palette, used by the shared layout with a nav (DearDish brand, Menu, My Meals, Profile, login/logout depending on `data.user`). Write the landing page with DearDish branding and mission text about making restaurant-style meals accessible to people facing health challenges, with calls to action to register and sign in. Export the session user type from `src/app.d.ts`.
  - Tests: vitest render test that the landing page (`/` route component) mounts and shows the mission text; vitest is configured and runs.
  - Done when: `bun run lint`, `bun run check`, `bun run test`, and `bun run build` all pass in the project root; landing page exists at `/`.

## Wave 2
- [x] T2: Database schema, client, and seed script (commit 7478dcb)
  - Satisfies: AC-2, AC-3, AC-4, AC-6
  - Files: `src/lib/server/db/schema.ts`, `src/lib/server/db/index.ts`, `drizzle.config.ts`, `scripts/seed.ts`, plus `db:push` and `db:seed` scripts appended to `package.json`
  - Do: Define the drizzle postgres tables exactly per PLAN.md Data Model (users, sessions, health_profiles, dishes, meals; uuid ids via `gen_random_uuid()`, cascade rules, jsonb ingredients). Create the postgres.js client from the `PG*` env vars (build the connection URL, `ssl: 'require'`), export the drizzle instance. Write `drizzle.config.ts` (dialect postgresql, schema path, url from env). Add scripts `db:push` (`drizzle-kit push`) and `db:seed` (`bun run scripts/seed.ts`). Write the seed script that upserts 6 restaurant-style dishes (varied cuisines; each with name, cuisine, description, 6-10 ingredients as a string array) and is idempotent (checks existing rows or truncates dishes before insert).
  - Tests: unit tests asserting the seed dish fixtures (exported from the seed script) each have a non-empty name, cuisine, description, and 6-10 ingredient strings; schema table/column shape sanity assertions.
  - Done when: `bun run db:push` runs clean against Neon; `bun run db:seed` inserts the 6 dishes; `bun run test` passes.

- [x] T3: Validation schemas and AI adaptation service (commit d082453)
  - Satisfies: AC-5, AC-2, AC-3, AC-6 (validation contracts)
  - Files: `src/lib/schemas.ts`, `src/lib/server/ai/prompt.ts`, `src/lib/server/ai/adapt.ts`
  - Do: Write zod schemas per PLAN.md (`registerSchema` RFC-shaped email + password min 8, `loginSchema`, `profileSchema` with max-200 conditions/allergies/dietaryPreferences and max-2000 notes all optional, `adaptRequestSchema` uuid dishId, `mealSchema` title non-empty max 200 + content non-empty). Write pure `buildAdaptPrompt(dish, profile)` that returns a prompt string including the dish name, cuisine, description, ingredients, and each non-empty profile field, with an explicit general healthy-cooking fallback section when every profile field is empty. Write `createAdaptationResponse(dish, profile)` that uses `createOpenRouter({ apiKey: AI_API_KEY })` + `streamText` (model `openrouter.chat(AI_MODEL)`; read the installed `ai` package types and use whatever plain-text-stream response helper exists, e.g. `result.toTextStreamResponse()` or `createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) })`): it must probe for the first text chunk before returning, so a provider failure before any content yields a 502 Response with `{ error }` JSON, and otherwise returns the streaming text Response.
  - Tests: prompt builder includes dish data and profile values, uses fallback text when profile is empty, and never includes empty profile fields; schema tests cover every limit and the accept cases; adaptation wrapper tests mock the AI provider (vi.mock or `ai` test utilities) covering: success yields a 200 text/plain streaming Response whose concatenated body contains text, pre-first-chunk failure yields 502 JSON `{ error }`.
  - Done when: `bun run test`, `bun run lint`, `bun run check` pass and the three modules exist with the contracts above.

## Wave 3
- [x] T4: Authentication and protected layout (commit b06c3f3)
  - Satisfies: AC-2, AC-4 (protection)
  - Files: `src/lib/server/auth.ts`, `src/routes/auth/login/+page.server.ts`, `src/routes/auth/login/+page.svelte`, `src/routes/auth/register/+page.server.ts`, `src/routes/auth/register/+page.svelte`, `src/routes/auth/logout/+page.server.ts`, `src/routes/(app)/+layout.server.ts`, `src/routes/(app)/+layout.svelte`
  - Do: Auth service in `src/lib/server/auth.ts` using node:crypto scrypt for password hashing, random base64url session tokens stored as sha256 hashes with a 7-day expiry, helpers: `registerUser`, `authenticate`, `createSession`, `validateSession` (token -> user, expires check), `destroySession`, plus `setSessionCookie`/`clearSessionCookie` cookie helpers (`deardish_session`, httpOnly, sameSite lax, path /). Login and register pages with form actions that validate via the wave 2 schemas, return `fail(400, { errors, values })` on invalid input (visible field errors, no cookie set), create the session cookie on success and redirect to `/menu`. Register treats an existing email as a visible error, stores emails lowercase. Logout action destroys the session, clears the cookie, redirects to `/auth/login`. `(app)` group layout server load: no valid session -> `redirect(302, '/auth/login')`; exposes the user to the layout and nav.
  - Tests: auth service unit tests with a mocked db module (password hash verifies, wrong password fails, duplicate email registration returns a conflict, token hashing is deterministic, expired session invalid); validation error paths for login/register forms via schema behavior; a render test of the login page showing field errors from a `form` prop.
  - Done when: `bun run test`, `bun run lint`, `bun run check` pass; the `(app)` layout redirects signed-out users to `/auth/login`.

## Wave 4
- [x] T5: Health profile page (commit 8a65e5c)
  - Satisfies: AC-3
  - Files: `src/lib/server/profile.ts`, `src/routes/(app)/profile/+page.server.ts`, `src/routes/(app)/profile/+page.svelte`
  - Do: Service `saveProfile(userId, input)` that validates the entire input with `profileSchema` before any write (atomic reject; on validation failure returns errors without touching the database) and upserts the health_profiles row (returning the saved profile). Page server load returns the existing profile (or empty defaults); the action calls the service, returning `fail(400, { errors, values })` on invalid input (previously saved values stay untouched) and redirecting back to `/profile` on success. Page renders a form with the four fields, current values, and visible errors.
  - Tests: service tests with a mocked db (valid input persists once with all fields; over-limit input returns errors and never calls the db upsert); render test that the profile form displays existing values.
  - Done when: `bun run test`, `bun run lint`, `bun run check` pass.

- [x] T6: Menu catalog and dish detail (commit a1ebdd0)
  - Satisfies: AC-4
  - Files: `src/routes/(app)/menu/+page.server.ts`, `src/routes/(app)/menu/+page.svelte`, `src/routes/(app)/menu/[id]/+page.server.ts`, `src/routes/(app)/menu/[id]/+page.svelte`
  - Do: `/menu` server load selects all dishes (name, cuisine, description) ordered by name; the page lists them as cards linking to `/menu/[id]`. `/menu/[id]` server load parses the uuid param, selects the dish, and throws `error(404, 'Dish not found')` when absent; the page shows name, cuisine, description, ingredient list, and an "Adapt this dish" link to `/adapt/[dishId]`.
  - Tests: render tests for the menu list (dishes passed as props appear with name, cuisine, description) and the detail page (dish data and the "Adapt this dish" link appear).
  - Done when: `bun run test`, `bun run lint`, `bun run check` pass.

- [x] T7: Adaptation endpoint and streaming UI (commit f49fca4)
  - Satisfies: AC-5
  - Files: `src/routes/api/adapt/+server.ts`, `src/routes/(app)/adapt/[dishId]/+page.server.ts`, `src/routes/(app)/adapt/[dishId]/+page.svelte`
  - Do: `POST` handler: 401 when no valid session (JSON `{ error }`); parse the JSON body with `adaptRequestSchema` -> 400 on missing/malformed dishId; look up the dish -> 404 when unknown; otherwise return the Response from the wave 2 `createAdaptationResponse(dish, profile)` (load the user's health profile, passing empty values when absent). The `/adapt/[dishId]` page load validates the dish (404 when unknown) and passes dish + profile to the page. The page has an "Adapt this dish" button that fetches `POST /api/adapt` with `{ dishId }`, reads the response body as a stream, and renders text as it arrives; a failed stream (non-ok response or mid-stream abort) shows a visible friendly error message without the stack trace; "Save as meal" (posting to `/api/meals` with title + accumulated content) is disabled until the stream completes; after saving, navigate to `/meals`.
  - Tests: API handler tests with mocked session/auth helpers, db lookups, and the wave 2 service (401 unauthenticated, 400 malformed body, 404 unknown dish, 200 delegates to the service Response); render test that the adapt page mounts with the dish name and a disabled save control before streaming.
  - Done when: `bun run test`, `bun run lint`, `bun run check` pass.

- [x] T8: Saved meals service, API, and page (commit 46df6e1)
  - Satisfies: AC-6
  - Files: `src/lib/server/meals.ts`, `src/routes/api/meals/+server.ts`, `src/routes/api/meals/[id]/+server.ts`, `src/routes/(app)/meals/+page.server.ts`, `src/routes/(app)/meals/+page.svelte`
  - Do: Service `saveMeal(userId, input, sourceDishId?)` (validates with `mealSchema`, inserts, returns the id), `listMeals(userId)` (owner-scoped, newest first), `deleteMeal(userId, id)` (owner-scoped delete returning whether a row was deleted, so another user's meal behaves as not found). `POST /api/meals`: 401 without a session, 400 invalid body, 201 `{ id }` on success. `DELETE /api/meals/[id]`: 401 without a session, 404 when no row was deleted for this user, 204 on success. `/meals` server load lists the user's meals; the page renders each meal (title, created date, content preview) with a delete control calling the DELETE endpoint (fetch) and refreshing the list; empty state with a link to `/menu`.
  - Tests: service tests with a mocked db (save validates and rejects empty/oversized titles without inserting; delete of another user's meal reports nothing deleted); API handler tests with mocked session helpers and service (401/400/201 and 401/404/204 paths); render test that meals passed as props are listed with their titles.
  - Done when: `bun run test`, `bun run lint`, `bun run check` pass.

## Coverage
- AC-1: T1
- AC-2: T4 (validation contracts from T3, storage from T2)
- AC-3: T5 (contracts from T2/T3)
- AC-4: T4, T6
- AC-5: T3, T7
- AC-6: T8
- AC-7: T1 plus each task's checks
