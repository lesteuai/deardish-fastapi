# DearDish

DearDish is an AI-powered foodtech demo that helps people facing health challenges enjoy restaurant-style meals adapted to their needs. A user registers with email and password, records a health profile (conditions, allergies, dietary preferences, notes), browses a seeded catalog of restaurant-style dishes, streams an AI adaptation of a dish tailored to that profile, and saves adapted meals for later.

The adaptation is a streamed AI response: the server sends the dish data plus the diner's health profile to an OpenRouter-compatible model and streams the rewritten recipe back chunk by chunk.

## Features

- Email and password accounts with httpOnly session cookies and 7-day expiry.
- Health profile stored per user: conditions, allergies, dietary preferences, and free-text notes.
- Seeded catalog of six restaurant-style dishes across cuisines.
- Streamed AI adaptation of any dish to the signed-in user's profile, with a general healthy-cooking fallback when the profile is empty.
- Owner-scoped saved meals: save an adaptation, list it, and delete it.

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

## Scripts

| Command               | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `bun run dev`         | Vite dev server with HMR.                                             |
| `bun run build`       | Production build with `@sveltejs/adapter-node`, output in `build/`.   |
| `bun run preview`     | Runs the built server on `:3000` with `ORIGIN=http://localhost:3000`. |
| `bun run check`       | `svelte-kit sync` + `svelte-check` (types).                           |
| `bun run lint`        | ESLint over the project.                                              |
| `bun run test`        | `vitest run`, unit tests only.                                        |
| `bun run db:generate` | `drizzle-kit generate`, write a SQL migration.                        |
| `bun run db:migrate`  | `drizzle-kit migrate`, apply migrations.                              |
| `bun run db:seed`     | `bun run scripts/seed.ts`, seed dishes (idempotent).                  |

Note: `bun run preview` pins `ORIGIN=http://localhost:3000` because adapter-node returns 403 on local form POSTs without a matching `ORIGIN`.

## Docs

- User guide for non-technical users: `USER-GUIDE.md`
- Spec: `docs/agent-docs/specs/261015-deardish-demo/SPEC.md`
- Plan and tasks: `docs/agent-docs/specs/261015-deardish-demo/PLAN.md`, `TASKS.md`
- Build report: `docs/agent-docs/specs/261015-deardish-demo/REPORT.md`
- Dev guide for agents: `AGENTS.md`
