# DearDish Brand Theme: Report

Date: 2026-10-14. Adapts the DearDish design and theme to the brand artwork `static/deardish.jpg`.

## What was built

The whole UI was rethemed around the identity in `static/deardish.jpg`: a warm linen-cream background, rose-berry pink lettering, sunny golden accents, turquoise aqua, and leafy sage green, paired with rounded, friendly typography and pill-shaped controls. The brand artwork is now shown in the sticky site header and the landing hero, and every route (public, auth, and protected) picks up the new card, button, badge, and pill styles. All existing accessibility roles, labels, text strings, and user flows are unchanged.

## Color and typography system

Global tokens live in `src/app.css` under `:root`, with values taken from the artwork:

- Background and text: `--cream #f7f3eb`, `--cream-dark #eee7db`, `--ink #2d2327`, `--ink-soft #6e5f64`.
- Berry pink: `--berry #e36580`, `--berry-dark #c84b68`, `--berry-soft #fceef2`.
- Sun yellow: `--sun #f2c12e`, `--sun-dark #c4920d`, `--sun-soft #fef7dc`.
- Aqua: `--aqua #63c7c6`, `--aqua-dark #2f8f8e`, `--aqua-soft #e6f6f6`.
- Leaf green: `--leaf #5cb275`, `--leaf-dark #3f8c56`, `--leaf-soft #eaf6ee`.
- Legacy aliases kept so existing route styles keep working: `--tomato: var(--berry)`, `--tomato-dark: var(--berry-dark)`, `--basil: var(--leaf)`, `--basil-dark: var(--leaf-dark)`.
- Surfaces and shape: `--card #fffdf9`, `--border #e6ddd0`, `--radius 20px`, `--radius-pill 999px`, `--shadow 0 8px 24px rgba(45, 35, 39, 0.07)`.

Typography loads `Fredoka` (display) and `Nunito` (body) from Google Fonts in `src/app.html`, exposed as `--font-display` and `--font-body`. Headings and `.brand` use the display font.

`body` carries three soft radial background accents (aqua, sun, leaf). `.site-header` has an aqua bottom border, `.button` and `.button.primary` are rose-berry pills, `.card` is a rounded bordered surface, and `.card .cuisine` is an aqua pill badge.

## Files touched

- `src/app.css` - new token palette, body background accents, card, button, badge, and pill styles.
- `src/app.html` - Google Fonts links, `theme-color` meta, favicon switched to `/favicon.jpg`.
- `static/deardish.jpg`, `static/favicon.jpg` - brand artwork and favicon added; `static/favicon.svg` removed.
- `src/routes/+layout.svelte` - header brand renders the `/deardish.jpg` logo plus the `DearDish` text; nav links are pills.
- `src/routes/+page.svelte` - landing hero renders the `/deardish.jpg` logo above the heading.
- `src/routes/auth/login/+page.svelte`, `src/routes/auth/register/+page.svelte` - auth forms wrapped in a themed `.card` with an aqua top border.
- `src/routes/(app)/profile/+page.svelte` - profile form wrapped in a themed `.card`.
- `src/routes/(app)/meals/+page.svelte` - meal cards get a date pill; the empty state uses a `.card.empty` container.
- `src/routes/(app)/menu/+page.svelte` - dish-card hover lift and berry headings.
- `src/routes/(app)/menu/[id]/+page.svelte` - ingredient `<ul class="ingredients">` styled as sun pills; back link is a pill.
- `src/routes/(app)/adapt/[dishId]/+page.svelte` - adapted recipe panel styled as `.recipe-card` with a leaf dashed callout; back link is a pill.
- Tests updated: `src/routes/page.test.ts`, `src/routes/auth/login-page.test.ts`, `src/routes/(app)/profile/profile-page.test.ts`, `src/routes/(app)/meals/meals-page.test.ts`, `src/routes/(app)/menu/menu-page.test.ts`, `src/routes/(app)/menu/dish-detail-page.test.ts`, `src/routes/(app)/adapt/adapt-page.test.ts`.

## Verification

- `bun run check` (svelte-kit sync and svelte-check): 0 errors, 0 warnings.
- `bunx eslint src`: clean.
- Unit tests: full suite 167 passed. One pre-existing failure remains in `src/lib/server/ai/adapt.test.ts` ("returns a 502 JSON error when the AI configuration is missing"). It is unrelated to this work and is caused by `vi.stubEnv` not overriding `$env/dynamic/private` populated from the gitignored `.env`.
- `bun run lint` fails only because `eslint.config.js` scans the gitignored `.vercel/output/**` artifact directory. This is a pre-existing environment issue.
- `bun run build` (adapter-vercel): succeeds.
