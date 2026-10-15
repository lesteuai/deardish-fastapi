# DearDish

DearDish is an AI-powered foodtech demo that helps people facing health challenges enjoy restaurant-style meals adapted to their needs. Register with email and password, record a health profile (conditions, allergies, dietary preferences, notes), browse a seeded catalog of restaurant-style dishes, stream an AI adaptation of a dish tailored to your profile, and save adapted meals for later.

Built with SvelteKit 2 + Svelte 5 + TypeScript on bun, drizzle-orm + postgres.js on the Neon Postgres database, and the Vercel AI SDK (`streamText`) through `@openrouter/ai-sdk-provider`.

## Quickstart

Copy `.env.example` to `.env` and fill in the values, then:

```bash
bun install
bun run db:push     # create/sync tables on Neon
bun run db:seed     # seed 6 restaurant-style dishes (idempotent)
bun run dev         # dev server
```

To run the production build locally:

```bash
bun run build
bun run preview     # node --env-file=.env build/index.js on :3000
```

## Tests and checks

```bash
bun run lint
bun run check
bun run test
```

Unit tests run with vitest (jsdom), need no real env vars or database, and mock the db and auth modules.

## Environment variables

- `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` - Neon Postgres connection.
- `AI_API_KEY`, `AI_MODEL` - OpenRouter-compatible endpoint for streamed adaptations.

See `.env.example`. Never commit `.env`.

## Docs

- Spec: `docs/agent-docs/specs/261015-deardish-demo/SPEC.md`
- Build report: `docs/agent-docs/specs/261015-deardish-demo/REPORT.md`
- Dev guide for agents: `AGENTS.md`
