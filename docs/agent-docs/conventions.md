# Conventions

## Input and form handling

Input schemas are centralized in `src/lib/schemas.ts`. The schemas cover registration, login, health profiles, adaptation requests, and saved meals. `zodFieldErrors` converts the first issue for each top-level field into a string error. The login and registration page actions use these schemas and return `fail(400, { errors, values })` on invalid input (`src/routes/auth/login/+page.server.ts`, `src/routes/auth/register/+page.server.ts`).

## Authentication and data ownership

`src/hooks.server.ts` resolves a session on every request and attaches the authenticated user to locals. Protected pages rely on `(app)/+layout.server.ts`. API handlers that need authentication check the session cookie themselves. Profile and meal data access accepts a user id and filters by it (`src/lib/server/profile.ts`, `src/lib/server/meals.ts`).

Session cookies are HTTP-only, use `sameSite: 'lax'`, and have path `/`. Session tokens are random base64url strings; the database stores their SHA-256 hashes (`src/lib/server/auth.ts`). Password hashing uses `scryptSync` with a random salt and compares derived hashes with `timingSafeEqual`.

## Svelte and tests

The project uses Svelte 5. Component tests and server-module tests use Vitest; `vite.config.ts` selects jsdom and includes `src/**/*.test.ts`. Route-level tests use ordinary filenames such as `auth-actions.test.ts` rather than a `+`-prefixed name. `src/lib/server/*` tests mock external database/auth dependencies where needed, so inspect individual tests before assuming an external service is required.

## Data changes and styles

Database tables are declared in `src/lib/server/db/schema.ts`; Drizzle's schema and migration output are configured in `drizzle.config.ts`. Zod validation is used before profile and meal writes (`src/lib/server/profile.ts`, `src/lib/server/meals.ts`). Global styles are in `src/app.css`, and the shell references the brand assets and remote font stylesheet in `src/app.html`.
