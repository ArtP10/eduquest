## Context

QuizJumper's server today (`server/src/index.ts`, `rooms.ts`, `match.ts`, `scoring.ts`, `quizzes.ts`) is a stateless-per-process Node/Express/Socket.IO app with no database — quiz content is a static in-memory module and rooms live in memory. Postgres was named as the intended DB in the project's decision log (README) but nothing has been built against it yet: there is no DB client, no migration tooling, and no `server/migrations/` directory. This change is the first thing in the codebase to touch Postgres.

The frontend (`client/src/app/`) is an Angular app with a `PhaserBoard` component for the game canvas and a `SocketService` for the realtime connection; it has an established pixel-art visual language (`docs/design-system.md`: UCAB blue/gold/ink palette, hard edges over anti-aliasing, blocky pixel-style components) but no shared form/button component kit yet — this is also the first UI work outside the game canvas itself.

Constraint driving every decision below: this must be **additive only**. The lobby/room/Socket.IO join flow, the match clock, and scoring must not change in any way, and nothing may require the database to be reachable for the existing game to run.

## Goals / Non-Goals

**Goals:**
- Stand up `users` table + migration tooling as the first Postgres integration, in a way later phases (quiz builder) can build on.
- Email/password registration+login, Google OAuth login, JWT issuance/verification, logout, `/auth/me`.
- An auth middleware that *exists* and works, but is wired into zero existing routes.
- A small reusable pixel-art form kit (`PixelButton`, `PixelInput`, `PixelPanel`) and login/signup screens built from it.
- Keep the existing game fully functional even if Postgres is never started.

**Non-Goals (explicitly deferred, per proposal):**
- Password reset, email verification, profile editing, account linking, rate limiting.
- Any route guards or gating of gameplay/room/socket behavior behind auth.
- Token revocation / refresh tokens / server-side session storage.
- Production Postgres hosting/provisioning — this only covers local dev + the schema/migration itself.

## Decisions

**1. Migration tooling: `node-pg-migrate` + a new `server/migrations/` directory.**
No existing convention to follow (contrary to the "existing Phase 0 migration setup" assumption — there isn't one yet in this repo). `node-pg-migrate` is chosen over hand-rolling a runner because it gives up/down migrations and a CLI (`npm run migrate up`/`down`) for free, and over a heavier ORM (Prisma/TypeORM) because the rest of the server is deliberately dependency-light plain TypeScript with hand-written SQL-shaped logic (`rooms.ts` etc.) — an ORM would be a much bigger shift in style than this change warrants. This migration tool + directory becomes the pattern future phases (quiz builder) reuse.

**2. `pg` (`node-postgres`) with a `Pool`, connected via a new `DATABASE_URL` env var.**
The proposal's env var list didn't include a DB connection string; one is required to connect at all, so it's added here (`DATABASE_URL`, placeholder default `postgres://postgres:postgres@localhost:5432/quizjumper` for local dev — consistent with the other four being placeholders).

**3. The server must boot and serve the existing game even if Postgres is unreachable.**
The `Pool` is created lazily/non-blocking at startup (no connection attempt until the first auth query), and connection errors are caught per-request, returning `503` from auth endpoints rather than crashing the process. This is what makes "additive only" actually true in practice, not just in the routing table — someone running `npm run dev` without Postgres installed still gets a working game, just with auth endpoints unavailable.

**4. `bcryptjs` (pure JS) over native `bcrypt` for password hashing.**
Native `bcrypt` requires a C++ build toolchain, which is a common source of friction on Windows dev machines (this repo's primary dev environment per the session context) and in constrained CI/sandbox environments. `bcryptjs` is slower per-hash but at QuizJumper's expected scale (classroom-sized rooms, not high-volume auth traffic) that's not a meaningful cost, and it avoids adding a native-module install failure mode to a change whose whole point is to be low-risk.

**5. `users.id` is a `uuid` (`gen_random_uuid()`, Postgres ≥13 built-in), not a serial integer.**
User-facing identifiers shouldn't leak a sequential count, and UUIDs avoid PK collisions if data is ever merged across environments. Costs a little more storage/index size than `serial`, judged acceptable at this scale.

**6. Google OAuth via `passport` + `passport-google-oauth20`, run with `session: false`.**
Passport's Google strategy is the standard, well-maintained way to do this exchange without hand-rolling the OAuth2 dance. `session: false` is required — Passport defaults to server-side sessions, which would contradict the JWT-only decision; the callback instead issues a JWT directly, same as register/login.

**7. Placeholder Google credentials fail loud and clean, not crash.**
At request time, `GET /auth/google` checks whether `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are still the placeholder values and, if so, responds `503` with a JSON error (`{ error: "Google sign-in is not configured yet" }`) instead of attempting a broken OAuth redirect. The frontend's "Sign in with Google" button surfaces that message inline rather than following a dead redirect.

**8. JWT access token only, no refresh token, 7-day expiry, stored in `localStorage` client-side.**
Matches the proposal's explicit scope (no rate limiting / revocation infra this phase). A 7-day expiry is a reasonable default for a low-stakes classroom app; shortening it later is a non-breaking config change (`JWT_SECRET`/expiry are both server-side only). `localStorage` (vs. an httpOnly cookie) is chosen because there is no server-rendered page to set a cookie from and it matches the proposal's explicit instruction ("Store JWT client-side (e.g. localStorage or an auth service)").

**9. Angular `AuthService` + `HttpInterceptor` that attaches the JWT to outgoing requests, added now even though nothing consumes it yet.**
Cheap to add alongside the service itself, and every future protected endpoint (quiz builder) benefits without another pass through every HTTP call site.

**10. `docker-compose.yml` at the repo root, adding a local Postgres service.**
Nothing in the repo currently runs Postgres anywhere. Without this, "run the migration" has no target and the auth endpoints are unreachable in local dev. Kept minimal (one `postgres:16` service, a named volume, the `DATABASE_URL` default from decision 2) and entirely optional — the existing `npm start` scripts for client/server are untouched, so anyone not touching auth never needs to know it exists.

**11. Google sign-up defers account creation until the person picks a username, via a short-lived signed "pending" token instead of a server-side session.**
The original design auto-generated a username (sanitized display name + numeric suffix on collision) and created the account immediately on first Google sign-in. That's silent and occasionally ugly (`JohnSmith3`) with no chance to fix it before it's permanent, given profile editing is explicitly out of scope this phase. Instead, `/auth/google/callback` for a first-time sign-in now returns a signed, 15-minute JWT (`type: 'google_pending'`, distinct from an access token so `requireAuth` can never accept it) carrying the Google id/email/suggested username, and a new `POST /auth/google/complete` actually creates the account once a username is submitted. Alternatives considered: a server-side pending-signup table (rejected — reintroduces server-side session-like state this design otherwise avoids entirely) and prompting for a username inline during the OAuth redirect itself (not possible — the redirect target is our own frontend, not something Google lets us customize).

## Risks / Trade-offs

- **[Risk]** Postgres becomes a new piece of infrastructure to install/run locally, adding friction for anyone touching this part of the codebase. → **Mitigation**: `docker-compose up` is the one extra step (decision 10); the rest of the app (decision 3) works with zero DB setup.
- **[Risk]** No token revocation means a leaked/copied JWT stays valid until it expires (up to 7 days), and "logout" only clears the client's local copy. → **Mitigation**: explicitly accepted for this phase (matches proposal's out-of-scope list); short-ish 7-day expiry bounds the blast radius until refresh/revocation is built later.
- **[Risk]** No email verification means registration accepts any email address without proving ownership, and no rate limiting means the register/login endpoints can be hit repeatedly. → **Mitigation**: explicitly out of scope per proposal; acceptable because nothing is gated behind auth yet, so there's no privileged access to abuse.
- **[Risk]** `bcryptjs` is slower than native `bcrypt` under load. → **Mitigation**: acceptable at classroom scale; can swap to native `bcrypt` later as a drop-in change if it ever becomes a bottleneck.
- **[Trade-off]** Adding `node-pg-migrate` + `passport` + `passport-google-oauth20` + `pg` + `bcryptjs` + `jsonwebtoken` is a meaningfully larger dependency surface than the server has today. Accepted because each one directly maps to a scope item (DB, migrations, OAuth, hashing, JWT) rather than a convenience/nice-to-have.

## Migration Plan

1. Add `server/migrations/` + `node-pg-migrate` config and the single `create_users_table` migration (additive: one new table, no existing schema to touch).
2. Add `docker-compose.yml` and document `docker-compose up -d && npm run migrate up` in the server README/scripts.
3. Ship backend auth routes and middleware (unattached to existing routes) behind the new dependencies — safe to deploy at any time since nothing calls them yet except the new frontend screens.
4. Ship frontend login/signup screens and header auth state.
5. **Rollback**: since no existing route, socket flow, or table is modified, rollback is simply not deploying (or reverting) this change's files; there's no data migration on existing tables to undo. If the `users` table itself needs to be dropped after a bad deploy, `node-pg-migrate down` reverses the single migration.

## Open Questions

- Where Postgres runs in staging/production (managed service vs. self-hosted) is not decided here — out of scope for a change that only needs to work locally today. Revisit before Phase 2 (quiz builder) actually persists quizzes.
- Whether `JWT_SECRET` rotation is needed before real user data accumulates — deferred; today's placeholder-value approach is fine since no real accounts exist yet.
