## Why

QuizJumper's roadmap (Phase 2, quiz authoring) will need real user accounts to own and persist quizzes. Building the auth system now — before anything depends on it — lets it be developed and tested in isolation, with zero risk to the working multiplayer game loop.

## What Changes

- Add a `users` table and its migration (first Postgres integration in this repo — no DB or migration tooling exists yet, so this change also establishes that pattern).
- Add backend auth endpoints: `POST /auth/register`, `POST /auth/login`, `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/logout`, `GET /auth/me`.
- Issue JWT access tokens on register/login/OAuth callback; no server-side sessions.
- Add an auth middleware (JWT verification) available for future protected routes. It is not attached to any existing route in this change.
- Add Angular login and signup screens, a "Sign in with Google" button, a client-side auth service (JWT storage + attach-to-request), and logged-in/logged-out header state.
- Add a small shared pixel-art UI kit (`PixelButton`, `PixelInput`, `PixelPanel`) used by the new screens, reusable by future screens (quiz builder, etc.).
- Add placeholder env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `JWT_SECRET`.

Explicitly not changed:
- The existing lobby/room/Socket.IO join flow — guest nicknames keep working exactly as today, independent of login state.
- No route guards, no gating of any gameplay/room/socket capability behind auth.
- No password reset, email verification, profile editing, account linking, or rate limiting (future work).

## Capabilities

### New Capabilities
- `user-auth`: Account registration (email/password + username), email/password login, Google OAuth login, logout, JWT issuance and verification, and a `GET /auth/me` endpoint. Covers both the backend contract and the frontend login/signup UI and auth state.

### Modified Capabilities
(none — this change is additive only; no existing requirement in `room-management`, `realtime-sync`, `jumper-gameplay`, `quiz-content`, or `leaderboard` changes)

## Impact

- **New**: `server/src/auth/` (routes, JWT middleware, Google OAuth strategy, password hashing), `server/migrations/` (new — first migration + runner setup), `client/src/app/auth/` (login/signup components, auth service), `client/src/app/shared/pixel-ui/` (PixelButton/PixelInput/PixelPanel).
- **Dependencies added**: server — `pg`, a migration runner, `bcrypt`, `jsonwebtoken`, a Google OAuth library (e.g. `passport` + `passport-google-oauth20`, or a direct OAuth client). client — none expected beyond existing Angular/HttpClient.
- **Env**: new required (placeholder-valued for now) env vars on the server: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `JWT_SECRET`, plus Postgres connection config.
- **Unaffected**: `server/src/rooms.ts`, `match.ts`, `scoring.ts`, `quizzes.ts`, all Socket.IO event handling, and every existing Angular game/lobby component.
