# DearDish Demo: Session Report

Date: 2026-10-15. Autonomous session (no user involvement): spec and plan were each reviewed by an `adversarial-agent` until agreement, then approved; TASKS.md was auto-approved per the session instruction.

## What was built

A demo of DearDish (AI foodtech: restaurant-style meals for people facing health challenges), per `SPEC.md` (status: verified), built with SvelteKit 2 + Svelte 5 + TypeScript, bun, drizzle-orm + postgres.js on the Neon database, and the Vercel AI SDK (`ai` v7 + `@openrouter/ai-sdk-provider`) for streamed dish adaptations. All 7 acceptance criteria pass end-to-end (see the Verification section of SPEC.md). 158 unit tests, 20 files. Commits: 6bad2f8 (scaffold), 7478dcb (db schema + seed), d082453 (zod schemas + AI service), b06c3f3 + 80ada0b (auth), 8a65e5c (profile), a1ebdd0 (menu), f49fca4 (adapt), 46df6e1 (meals), 51f2dca (status), e21c9a4 (verification fixes).

## What you need to fill in

Nothing is required to run the demo locally: `.env` already contains working Neon `PG*` credentials and the OpenRouter `AI_API_KEY`/`AI_MODEL`.

Optional fill-ins, by situation:

1. `.env` values if you move off the provided accounts: `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` (Neon Postgres), `AI_API_KEY` and `AI_MODEL` (OpenRouter-compatible endpoint). Copy the key names from `.env.example`.
2. Production deployment: set the real public `ORIGIN` (and `PROTOCOL_HEADER`/`HOST_HEADER` if behind a proxy) for the adapter-node server; `bun run preview` hardcodes `ORIGIN=http://localhost:3000` for local runs only.
3. Hosted Neon Auth (StackAuth) instead of the built-in email/password auth: no keys were provided, so this was a non-goal (see SPEC.md). To switch, fill in the Neon Auth project keys and replace `src/lib/server/auth.ts` + the session cookie handling.
4. Seeded dishes: edit `seedDishes` in `scripts/seed.ts` and re-run `bun run db:seed` (idempotent; it replaces dishes by name).
5. Domain branding (name, palette, copy) in `src/routes/+page.svelte` and `src/app.css` if you want them changed from the demo defaults.

## Assumptions made in this session

- "Neon database and auth" was read as: data on the Neon Postgres database, with auth implemented as email/password sessions stored in that same Neon database. Reason: the environment provides only `PG*` credentials; hosted Neon Auth needs project keys that were not provided.
- The AI endpoint (`AI_API_KEY` starting with `sk-or-v1`, `AI_MODEL=openai/gpt-6-luna`) was read as OpenRouter, wired through the official `@openrouter/ai-sdk-provider` package with the Vercel AI SDK `streamText` API.
- The demo scope was fixed as: landing page, register/login/logout, health profile, seeded menu of 6 dishes, streamed AI adaptation of a dish to the user's profile, and owner-scoped saved meals. Payments, sharing, uploads, i18n, production hardening, and a restaurant/partner side are non-goals.
- Streaming adaptations return a plain text stream (not the AI SDK UI-message protocol) to keep the client simple; the endpoint probes the first chunk so pre-stream provider failures surface as 502 JSON.
- Local run of the built server needs `node --env-file=.env` (env vars are in `.env`, not exported); the `preview` script does this and pins a localhost `ORIGIN` because adapter-node otherwise 403s local form POSTs.
- The Neon pooler endpoint does not support prepared statements reliably, so the postgres.js client runs with `prepare: false`.
- A git repository was initialized (`git init -b main`) because the session was autonomous and the SDD flow requires a repo; commits use the author `bachsofttrick <xuanbach1307@gmail.com>`.
- Context7/MCP library docs were unavailable in this environment; current Vercel AI SDK docs were fetched with the built-in web tools instead, and implementers cross-checked the installed package types (`ai` v7 resolved by bun).
- Test file names avoid the `+` prefix anywhere under `src/routes/` (SvelteKit reserves it; `svelte-kit sync` crashes on `+`-prefixed test files).
- Two implementation-level deviations, both reported by implementers and accepted: `tsconfig.json` gained `skipLibCheck: true` (drizzle-orm `.d.ts` errors under the installed TypeScript) and SvelteKit was pinned to the 2.x line (today's `sv` scaffolds SvelteKit 3, which dropped `svelte.config.js`; the plan targets kit 2 + adapter-node 5).

## How to run

```
bun install
bun run db:push     # create/sync tables on Neon
bun run db:seed     # seed 6 restaurant-style dishes (idempotent)
bun run dev         # dev server
# or the built server:
bun run build
bun run preview     # node --env-file=.env build/index.js on :3000
```

Checks: `bun run lint`, `bun run check`, `bun run test`.
