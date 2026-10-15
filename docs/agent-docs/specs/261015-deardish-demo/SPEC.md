# Spec: DearDish Demo

Status: implemented (approved: adversarial review round 1 disagreed, round 2 AGREED, 2026-10-15)
Request: "Build a demo version of this project: DearDish, an AI-powered foodtech startup focused on making restaurant-style meals more accessible to people facing health challenges. Build it with SvelteKit, Neon database and auth, bun, Vercel AI SDK."

## Overview
DearDish helps people facing health challenges enjoy restaurant-style meals adapted to their needs. This demo delivers a working web application in which a user registers, records a health profile, browses a seeded catalog of restaurant-style dishes, streams an AI adaptation of a dish tailored to that profile, and saves adapted meals for later.

## User Stories
- As a visitor, I want a landing page explaining what DearDish does, so that I understand the product before signing up.
- As a user, I want to register and sign in with email and password, so that my profile and saved meals stay private to me.
- As a user, I want to record a health profile (conditions, allergies, dietary preferences, notes), so that dish adaptations respect my health needs.
- As a user, I want to browse a catalog of restaurant-style dishes, so that I can pick something appealing.
- As a user, I want an AI-adapted version of a dish streamed to me, so that I quickly get a version that is safe and tasty for my profile.
- As a user, I want to save adapted meals, so that I can revisit them later.

## Acceptance Criteria
- AC-1: `GET /` returns 200 and renders DearDish branding and mission text; it is reachable without signing in.
- AC-2: Registration with a valid email (RFC-shaped, case-insensitively unique) and a password of at least 8 characters creates the user, sets an httpOnly session cookie, and leaves the user signed in. Invalid email, short password, or duplicate email fails with a visible field error and creates no user. Login rejects a wrong password or unknown email with a visible error and no session cookie. Logout destroys the session so protected pages redirect to the login page.
- AC-3: A signed-in user can create and update a health profile via a form with these fields: `conditions`, `allergies`, `dietaryPreferences` (optional, each a short free-text line, max 200 characters) and `notes` (optional, max 2000 characters). Values persist across reload. Invalid submissions (over-limit text) show a visible error and leave previously saved values unchanged (atomic reject, nothing partially saved).
- AC-4: The protected pages are `/menu`, `/menu/[id]`, `/meals`, and `/profile`; signed-out visits redirect to `/auth/login`. `/menu` lists the seeded restaurant-style dishes with name, cuisine, and description. `/menu/[id]` shows a dish's ingredients and offers an "Adapt this dish" action; an unknown dish id returns 404.
- AC-5: `POST /api/adapt` while authenticated with a valid `dishId` streams an adapted recipe as a plain text stream. The server-side prompt to the AI provider must include the dish data and the user's health profile, and when the profile is empty it must fall back to a general healthy-cooking prompt. Signed-out requests receive 401. A missing or malformed `dishId` in the body receives 400 JSON; an unknown `dishId` receives 404 JSON. If the AI provider fails before any content is sent, the endpoint returns 502 with a friendly JSON error; if it fails mid-stream, the stream ends with a visible error surfaced by the client, with no stack trace exposed.
- AC-6: After an adaptation the user can save it as a meal with a non-empty title (max 200 characters) and non-empty content (the adapted recipe text); empty title or content is rejected with a visible error. Saved meals are listed on `/meals` (only the signed-in owner's meals) and can be deleted from the list by their owner. Saving and deleting require authentication; requests touching another user's meal by id behave as 404 (not found for that user).
- AC-7: `bun run lint`, `bun run check`, `bun run test`, and `bun run build` all pass in the project root.

## Edge Cases
- Invalid email format or password shorter than 8 characters on registration: visible error, no user row created.
- Duplicate email on registration: visible error, no second user row created.
- Wrong or missing credentials on login: visible error, no session cookie set.
- Visiting `/menu`, `/menu/[id]`, `/meals`, or `/profile` signed out: redirect to `/auth/login`.
- Empty health profile: adaptation falls back to a general healthy-cooking prompt.
- Missing or malformed `dishId` on `POST /api/adapt`: 400 JSON error; unknown `dishId`: 404 JSON error; unknown `dishId` on `/menu/[id]`: 404 page.
- AI provider error before first streamed token: 502 friendly JSON error; AI provider error mid-stream: stream ends, client shows a visible error, no stack trace exposed.
- Oversized profile input (over the limits in AC-3) or oversized/empty meal title: visible validation error, nothing saved.

## Non-Goals
- Hosted OAuth, social login, or the Neon hosted Auth (StackAuth) service; no auth provider keys are available, so this demo implements email and password auth on the Neon database. Switching to hosted Neon Auth is a follow-up.
- Payments, subscriptions, image uploads, sharing between users, mobile apps, i18n, production hardening, and restaurant/partner side features.

## Open Questions
- Q-1: Switching to Neon hosted Auth once its project keys are provided. (blocks: nothing)
