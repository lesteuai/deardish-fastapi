# Tasks: Adapt DearDish Design and Theme from Brand Image

Status: complete
Plan: PLAN.md

## Wave 1
- [x] T1: Global theme palette, typography, and brand artwork in layout and landing hero (commit fb8ef00)
  - Files: `src/app.html`, `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/page.test.ts`
  - Do:
    - In `src/app.html`, add Google Fonts links (`preconnect` and stylesheet for `Fredoka:wght@500;600;700` and `Nunito:wght@500;600;700`) and `<meta name="theme-color" content="#f7f3eb" />`.
    - In `src/app.css`, update `:root` variables to match `static/deardish.jpg` (`--cream: #f7f3eb`, `--cream-dark: #eee7db`, `--ink: #2d2327`, `--ink-soft: #6e5f64`, `--berry: #e36580`, `--berry-dark: #c84b68`, `--berry-soft: #fceef2`, `--sun: #f2c12e`, `--sun-dark: #c4920d`, `--sun-soft: #fef7dc`, `--aqua: #63c7c6`, `--aqua-dark: #2f8f8e`, `--aqua-soft: #e6f6f6`, `--leaf: #5cb275`, `--leaf-dark: #3f8c56`, `--leaf-soft: #eaf6ee`, `--tomato: var(--berry)`, `--tomato-dark: var(--berry-dark)`, `--basil: var(--leaf)`, `--basil-dark: var(--leaf-dark)`, `--card: #fffdf9`, `--border: #e6ddd0`, `--radius: 20px`, `--radius-pill: 999px`, `--shadow: 0 8px 24px rgba(45, 35, 39, 0.07)`, `--font-display`, `--font-body`). Apply soft radial background accents on `body`, `var(--font-display)` on headings and `.brand`, pill-shaped `.button` (`border-radius: var(--radius-pill)`) with rose-berry `.button.primary` shadow, `2px solid var(--border)` on `.card`, and aqua pill badge styling on `.card .cuisine`.
    - In `src/routes/+layout.svelte`, render `<img class="brand-logo" src="/deardish.jpg" alt="" />` and `<span>DearDish</span>` inside `<a class="brand" href={data.user ? '/menu' : '/'}>`, and style `.brand-logo` (44x44px, `12px` radius, `2px solid var(--sun)`) and pill nav links with leaf-green hover states.
    - In `src/routes/+page.svelte`, render `<img class="hero-logo" src="/deardish.jpg" alt="DearDish logo" />` above `<h1>DearDish</h1>` inside `<section class="hero">`, keeping the exact mission text and `Register` / `Sign in` links.
  - Tests: Update `src/routes/page.test.ts` to assert that the landing page renders `<img alt="DearDish logo" src="/deardish.jpg" />` in addition to the existing heading, mission text, and action link checks.
  - Done when: `src/app.html`, `src/app.css`, `src/routes/+layout.svelte`, and `src/routes/+page.svelte` apply the `deardish.jpg` palette, typography, and brand image, and `bun run lint`, `bun run check`, and `bun run test` pass.

## Wave 2
- [x] T2: Auth, profile, and saved meals card theme styling (commit 2fd4d62)
  - Files: `src/routes/auth/login/+page.svelte`, `src/routes/auth/register/+page.svelte`, `src/routes/(app)/profile/+page.svelte`, `src/routes/(app)/meals/+page.svelte`, `src/routes/auth/login-page.test.ts`, `src/routes/(app)/profile/profile-page.test.ts`, `src/routes/(app)/meals/meals-page.test.ts`
  - Do:
    - In `src/routes/auth/login/+page.svelte` and `src/routes/auth/register/+page.svelte`, style `<section class="auth card">` as a centered auth card (`max-width: 28rem`, `margin: 1.5rem auto`, top accent border in `var(--aqua)`) while preserving all existing headings, labels, inputs, error paragraphs, and links.
    - In `src/routes/(app)/profile/+page.svelte`, place the profile `<form method="POST">` inside a themed `.card` surface with `var(--sun)` / `var(--leaf)` focus and accent styling while keeping all field labels (`Conditions`, `Allergies`, `Dietary preferences`, `Notes`) and `Save profile` button unchanged.
    - In `src/routes/(app)/meals/+page.svelte`, style the empty state in a `.card` container and add a header row inside each saved meal `.card` pairing the `<h2>{meal.title}</h2>` with a pill-styled date badge (`Saved {formatDate(meal.createdAt)}`) while preserving all existing text and `Delete` button behavior.
  - Tests: Update `src/routes/auth/login-page.test.ts`, `src/routes/(app)/profile/profile-page.test.ts`, and `src/routes/(app)/meals/meals-page.test.ts` to assert the `.card` container presence alongside all existing form, error, and meal list assertions.
  - Done when: Auth, profile, and meals pages use the themed card layout and `bun run lint`, `bun run check`, and `bun run test` pass.

- [x] T3: Menu catalog, dish detail ingredient pills, and adaptation recipe callout styling (commit 6147a07)
  - Files: `src/routes/(app)/menu/+page.svelte`, `src/routes/(app)/menu/[id]/+page.svelte`, `src/routes/(app)/adapt/[dishId]/+page.svelte`, `src/routes/(app)/menu/menu-page.test.ts`, `src/routes/(app)/menu/dish-detail-page.test.ts`, `src/routes/(app)/adapt/adapt-page.test.ts`
  - Do:
    - In `src/routes/(app)/menu/+page.svelte`, style `.dish-card` with hover lift (`transform: translateY(-3px)`, `border-color: var(--aqua)`) and rose-berry `h2` headings.
    - In `src/routes/(app)/menu/[id]/+page.svelte`, add `class="ingredients"` to the `<ul>` element and style ingredient `<li>` items as sunny-yellow pills (`background: var(--sun-soft)`, `border: 1px solid var(--sun)`, `border-radius: var(--radius-pill)`) and style `.back` as a pill link.
    - In `src/routes/(app)/adapt/[dishId]/+page.svelte`, style the adapted recipe card (`article.card.recipe-card`) with a leaf-green dashed callout border (`border: 2px dashed var(--leaf)`, `background: var(--leaf-soft)`) and `.back` as a pill link while keeping all headings, buttons (`Adapt this dish`, `Save as meal`), labels (`Title`), and streaming states intact.
  - Tests: Update `src/routes/(app)/menu/menu-page.test.ts`, `src/routes/(app)/menu/dish-detail-page.test.ts`, and `src/routes/(app)/adapt/adapt-page.test.ts` to verify the `.ingredients` list class on dish detail and themed card classes while keeping all existing unit tests passing.
  - Done when: Menu, dish detail, and adaptation pages render the new pill and callout styles and `bun run lint`, `bun run check`, and `bun run test` pass.
