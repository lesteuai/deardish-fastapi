# Plan: DearDish Demo

Status: approved (adversarial review round 1 disagreed, round 2 AGREED, 2026-10-15)
Spec: SPEC.md (approved 2026-10-15)

## Approach
A greenfield SvelteKit 2 (Svelte 5, TypeScript) app run with bun, using drizzle-orm over a postgres.js connection to the Neon Postgres database (credentials from `PG*` env vars), custom email/password auth with sessions stored in Neon (no hosted auth keys exist; see Non-Goals in SPEC.md), and the Vercel AI SDK (`streamText`) through `@openrouter/ai-sdk-provider` (key `AI_API_KEY`, model `AI_MODEL`) for streamed dish adaptations. Server logic lives in pure, unit-testable modules (`src/lib/server/...`, `src/lib/schemas.ts`); routes consume them. Tests run with vitest; the app builds with `@sveltejs/adapter-node`.

## Affected Code
- Project scaffold (`package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `src/app.html`, `src/app.d.ts`, `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `.env.example`, `vitest` config and scripts): installs every dependency used by all later tasks so later tasks never touch `package.json`; landing page and shared layout serve AC-1, AC-7.
- `src/lib/server/db/schema.ts`, `src/lib/server/db/index.ts`, `drizzle.config.ts`, `scripts/seed.ts`: drizzle tables (users, sessions, health_profiles, dishes, meals), db client built from `PG*` env vars, `db:push`/`db:seed` scripts; serves AC-2, AC-3, AC-4, AC-6.
- `src/lib/schemas.ts`: zod schemas for register, login, profile, meal, adapt request; serves AC-2, AC-3, AC-5, AC-6.
- `src/lib/server/ai/prompt.ts`, `src/lib/server/ai/adapt.ts`: pure `buildAdaptPrompt(dish, profile)` with empty-profile fallback, and `createAdaptationResponse(dish, profile)` wrapping `streamText` so a provider failure before the first text chunk returns a 502 JSON Response and otherwise returns a plain text streaming Response; serves AC-5.
- `src/lib/server/auth.ts`: password hashing (node:crypto scrypt), session token create/validate/destroy against the db, cookie helpers; serves AC-2, AC-4.
- `src/routes/(app)/+layout.server.ts` and `+layout.svelte`: protected group; a signed-out visit to any page in the group (covers `/menu`, `/menu/[id]`, `/meals`, `/profile`, `/adapt/[dishId]`) redirects to `/auth/login`; serves AC-4.
- `src/routes/auth/login/+page.server.ts` + `+page.svelte`, `src/routes/auth/register/+page.server.ts` + `+page.svelte`, `src/routes/auth/logout/+page.server.ts`: form actions calling the auth service; failures return `fail(400, { ...fieldErrors })` rendered as visible field errors, and no session cookie is set on failure; logout destroys the session and redirects to `/auth/login`; serves AC-2.
- `src/routes/(app)/profile/+page.server.ts`, `+page.svelte`: health profile form, load, and save; the action parses the entire input with `profileSchema` before any database write, so an invalid submission leaves previously saved values unchanged (atomic reject) and renders a visible error; serves AC-3.
- `src/routes/(app)/menu/+page.server.ts`, `+page.svelte`: loads and lists all seeded dishes (name, cuisine, description); serves AC-4.
- `src/routes/(app)/menu/[id]/+page.server.ts`, `+page.svelte`: loads a dish by id, throws `error(404)` for an unknown id, shows ingredients and an "Adapt this dish" link to `/adapt/[dishId]`; serves AC-4.
- `src/routes/api/adapt/+server.ts`, `src/routes/(app)/adapt/[dishId]/+page.server.ts`, `+page.svelte`: streaming adaptation endpoint and client UI; the `/adapt/[dishId]` page sits in the protected group and its load throws `error(404)` for an unknown dish; the client streams the response, shows a visible friendly error (no stack trace) if the stream fails or aborts mid-stream, and only enables "Save as meal" after a completed stream; serves AC-5.
- `src/lib/server/meals.ts`, `src/routes/api/meals/+server.ts`, `src/routes/api/meals/[id]/+server.ts`, `src/routes/(app)/meals/+page.server.ts`, `+page.svelte`: owner-scoped meal save/list/delete; all queries filter by the session user, so another user's meal id behaves as 404; serves AC-6.

Execution order (waves in TASKS.md): scaffold -> { db schema/seed + validation/AI service } -> auth -> app pages and API routes -> end-to-end verification.

## Data Model and Contracts
Drizzle (postgres dialect) tables, all ids `uuid default gen_random_uuid()`:
- `users`: `email` text unique not null (stored lowercase), `password_hash` text not null, `created_at` timestamptz default now.
- `sessions`: `token_hash` text primary key (sha256 of the cookie token), `user_id` uuid references users on delete cascade, `expires_at` timestamptz not null.
- `health_profiles`: `user_id` uuid primary key references users on delete cascade, `conditions`, `allergies`, `dietary_preferences`, `notes` text (nullable), `updated_at` timestamptz default now.
- `dishes`: `name`, `cuisine`, `description` text not null, `ingredients` jsonb not null (string array); seeded by `scripts/seed.ts` with 6 restaurant-style dishes.
- `meals`: `user_id` uuid references users on delete cascade, `title` text not null, `content` text not null, `source_dish_id` uuid references dishes on delete set null, `created_at` timestamptz default now.

Zod contracts (zod, `src/lib/schemas.ts`): `registerSchema` (RFC-shaped email, password min 8), `loginSchema`, `profileSchema` (`conditions`/`allergies`/`dietaryPreferences` max 200, `notes` max 2000, all optional strings, default empty), `adaptRequestSchema` (`dishId` uuid), `mealSchema` (title non-empty max 200, content non-empty).

HTTP contracts: `POST /api/adapt` body `{ "dishId": "<uuid>" }` -> 200 `text/plain; charset=utf-8` stream, or 400 (missing/malformed), 401 (signed out), 404 (unknown dish), 502 (provider failed before any content) JSON `{ "error": string }`. `POST /api/meals` body `{ "title": string, "content": string, "sourceDishId"?: string }` -> 201 JSON `{ id }` or 400/401. `DELETE /api/meals/[id]` -> 204, or 401 (signed out), 404 (no such meal for the signed-in user, including meals owned by others). Cookie `deardish_session`, httpOnly, sameSite lax, path /, 7-day expiry.

## Libraries
- svelte, @sveltejs/kit, @sveltejs/adapter-node, @sveltejs/vite-plugin-svelte (latest, resolved by bun): app framework and production build.
- vite (latest): dev server and build pipeline.
- typescript, svelte-check, eslint, eslint-plugin-svelte, typescript-eslint, prettier + prettier-plugin-svelte (latest): AC-7 checks.
- vitest, jsdom (latest): unit tests.
- zod (latest): input validation contracts.
- drizzle-orm, drizzle-kit, postgres (latest): schema, push, and queries against Neon.
- ai, @openrouter/ai-sdk-provider (latest): `createOpenRouter({ apiKey: AI_API_KEY })` + `streamText({ model: openrouter.chat(AI_MODEL), ... })` for streamed adaptations.

## Risks
- AI SDK API drift across majors (`toTextStreamResponse` vs `createTextStreamResponse`): the implementer must read the installed `ai` package types and use the text-stream response helper that exists; the endpoint must return a plain text stream either way.
- `streamText` suppresses provider errors into the stream: the adaptation wrapper must probe for the first text chunk before returning the streaming Response so pre-stream failures can surface as 502 JSON; the wrapper is a pure function unit-tested with mock streams.
- Env loading differs between bun and node: db and AI code reads `process.env` directly; `preview` runs the adapter-node output with `node --env-file=.env` so the built server gets the same vars; unit tests never require real env.
- Parallel tasks in one wave must not touch the same files: all dependencies are installed by the scaffold task; each later task only adds its own source and test files.
- Neon connection requires TLS: the postgres.js client must be created with `ssl: 'require'` (or the standard Neon connection options).
