# Plan: Adapt DearDish Design and Theme from Brand Image

Status: approved
Request: look at static/deardish.jpg, make a plan to adapt the design and theme of the image to my app

## Approach
We will retheme the DearDish web application around the visual identity in `static/deardish.jpg`: a warm linen-cream background (`#f7f3eb`), rose-berry pink lettering (`#e36580`), sunny golden spoon yellow (`#f2c12e`), turquoise plate aqua (`#63c7c6`), and leafy sage green (`#5cb275`), paired with rounded, friendly typography and pill-shaped UI elements. We will update the global stylesheet (`src/app.css`), integrate the `/deardish.jpg` artwork into the sticky site header and landing hero, and refine component-scoped styles across the public, auth, and protected app routes while keeping all existing accessibility roles, labels, and user flows intact.

## Affected Code
- `src/app.html`: Load rounded display and body fonts (`Fredoka` and `Nunito` via Google Fonts with system fallbacks) and set page metadata matching the warm linen theme color.
- `src/app.css`: Replace the tomato/basil palette with CSS custom properties derived from `static/deardish.jpg` (`--cream`, `--berry`, `--sun`, `--aqua`, `--leaf`, plus backwards-compatible `--tomato` and `--basil` aliases), rounded card surfaces (`18px` radius, `2px` warm borders), pill buttons (`999px` radius), aqua pill `.cuisine` badges, and form card styling.
- `src/routes/+layout.svelte`: Render the `/deardish.jpg` logo emblem alongside the `DearDish` brand text in `.site-header` and style navigation links as rounded pills with leaf-green and aqua hover accents.
- `src/routes/+page.svelte`: Display `/deardish.jpg` as the centerpiece hero illustration above the `DearDish` heading, mission copy, and primary/secondary call-to-action buttons.
- `src/routes/auth/login/+page.svelte` and `src/routes/auth/register/+page.svelte`: Wrap auth forms in themed `.card` containers with centered headers and brand accent borders.
- `src/routes/(app)/menu/+page.svelte`, `src/routes/(app)/menu/[id]/+page.svelte`, `src/routes/(app)/adapt/[dishId]/+page.svelte`, `src/routes/(app)/meals/+page.svelte`, `src/routes/(app)/profile/+page.svelte`: Apply playful card hover states, sunny-yellow and aqua ingredient pills, golden recipe callout styling on the adaptation view, and cohesive section headers.

## Libraries
- `@sveltejs/kit@^2.70.3`: Serves `/deardish.jpg` from `static/` and renders route layouts and pages.
- `svelte@^5.57.2`: Component templates and scoped styles using Svelte 5 runes (`$props`, `$state`, `$derived`).

## Risks
- Existing unit tests query specific headings, link names, button labels, and form labels: Keep all semantic elements, accessible names, and text strings unchanged when adding visual wrappers and `<img>` elements.
- Hardcoded references to `--tomato` and `--basil` in route `<style>` blocks: Retain `--tomato`, `--tomato-dark`, `--basil`, and `--basil-dark` mapped to the new rose-berry and leaf-green tokens alongside the new semantic variables.
