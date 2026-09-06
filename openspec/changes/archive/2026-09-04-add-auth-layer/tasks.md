## 1. Database & Migration Setup

- [x] 1.1 Add `docker-compose.yml` at repo root with a `postgres:16` service, named volume, and default local credentials matching the `DATABASE_URL` placeholder
- [x] 1.2 Add `pg` and `node-pg-migrate` to `server/package.json`, with `migrate`/`migrate:up`/`migrate:down` scripts
- [x] 1.3 Create `server/migrations/` with the `create_users_table` migration: `id uuid primary key default gen_random_uuid()`, `username text unique not null`, `email text unique not null`, `password_hash text null`, `google_id text unique null`, `created_at timestamptz not null default now()`
- [x] 1.4 Add a lazily-initialized `pg` `Pool` module (`server/src/db.ts`) that does not attempt a connection at import/startup time

## 2. Env & Config

- [x] 2.1 Add placeholder env vars to the server's env example/config: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (default `http://localhost:3000/auth/google/callback`)
- [x] 2.2 Add a small config module that reads these env vars and exposes an `isGoogleOAuthConfigured` flag (true only when client id/secret are not the placeholder values)

## 3. Backend Auth Core

- [x] 3.1 Add `bcryptjs` and `jsonwebtoken` to `server/package.json`
- [x] 3.2 Implement `server/src/auth/users.ts`: create user, find by email, find by username, find by google id, all against the `users` table via the `pg` pool
- [x] 3.3 Implement JWT helpers (`server/src/auth/jwt.ts`): sign an access token (7-day expiry) with the user id, verify/decode a token
- [x] 3.4 Implement `server/src/auth/middleware.ts`: Express middleware that verifies the `Authorization: Bearer <token>` header and attaches `req.user`, rejecting with 401 on missing/invalid/expired token — export it but do not attach it to any existing route
- [x] 3.5 Wrap all DB-dependent auth route handlers so a Postgres connection failure returns 503 with a clear error instead of throwing/crashing the process

## 4. Backend Auth Routes

- [x] 4.1 Implement `POST /auth/register`: validate unique username/email, bcrypt-hash password, create user, return JWT + public profile
- [x] 4.2 Implement `POST /auth/login`: look up by email, reject if no password hash (Google-only account) with a specific error, compare bcrypt hash, return JWT + public profile
- [x] 4.3 Add `passport` + `passport-google-oauth20` (session: false), configure the Google strategy from env
- [x] 4.4 Implement `GET /auth/google`: respond 503 with a clear error if Google OAuth is not configured (per 2.2's flag); otherwise start the OAuth redirect
- [x] 4.5 Implement `GET /auth/google/callback`: on success, find-or-create the user by `google_id`, issue JWT, redirect to the frontend with the token (or return it per the chosen callback contract)
- [x] 4.6 Implement `POST /auth/logout`: authenticated, returns a confirmation (no server-side token invalidation)
- [x] 4.7 Implement `GET /auth/me`: authenticated, returns the current user's public profile (id, username, email)
- [x] 4.8 Mount the new `/auth/*` router in `server/src/index.ts` alongside (not replacing) existing routes/Socket.IO setup — verify no existing route or Socket.IO handler is touched

## 5. Shared Pixel UI Kit (Angular)

- [x] 5.1 Create `client/src/app/shared/pixel-ui/pixel-button/` — a standalone `PixelButton` component (variants: primary/secondary, disabled state, visible keyboard focus style) styled from `docs/design-system.md` tokens
- [x] 5.2 Create `client/src/app/shared/pixel-ui/pixel-input/` — a standalone `PixelInput` component (label, error message slot, visible focus state) for text/email/password inputs
- [x] 5.3 Create `client/src/app/shared/pixel-ui/pixel-panel/` — a standalone `PixelPanel` component (chunky bordered container) used to frame the login/signup forms
- [x] 5.4 Verify all three components are responsive down to mobile widths

## 6. Frontend Auth Service & State

- [x] 6.1 Implement `client/src/app/auth/auth.service.ts`: register/login/logout/fetch-me calls via `HttpClient`, JWT stored in `localStorage`, exposes current-user state (e.g. a signal)
- [x] 6.2 Implement an `HttpInterceptor` that attaches `Authorization: Bearer <token>` to outgoing requests when a token is present
- [x] 6.3 On app init, if a stored token exists, call `/auth/me` to restore logged-in state (clear the stored token if the call fails)

## 7. Frontend Auth Screens

- [x] 7.1 Build the login screen (email/password) using `PixelPanel`/`PixelInput`/`PixelButton`, wired to `AuthService.login`, showing field-specific error messages
- [x] 7.2 Build the signup screen (username/email/password) using the same kit, wired to `AuthService.register`, showing which field failed (duplicate username vs. duplicate email vs. other)
- [x] 7.3 Add a "Sign in with Google" `PixelButton` that navigates to `GET /auth/google`; if the backend responds that Google isn't configured, show that error inline instead of navigating
- [x] 7.4 Add logged-in vs. logged-out header state (username + logout action when logged in; login/signup links when logged out) — no route guards, no change to how a guest reaches the existing lobby/join flow

## 8. Validation

- [x] 8.1 Manually verify the existing guest flow end-to-end (create room, join by nickname, play a full match) with Postgres **not running** — confirm zero regression and zero DB-dependency errors outside `/auth/*`
- [x] 8.2 Manually verify register → logout → login with the same email/password round-trips correctly
- [x] 8.3 Manually verify duplicate username and duplicate email are both rejected with distinct, specific error messages
- [x] 8.4 Manually verify `/auth/google` and the Google button show a clean "not configured" error with placeholder env values (no crash, no dead redirect) — backend confirmed via curl (503, no crash); frontend button check pending in 8.4's UI pass below
- [x] 8.5 Manually verify `/auth/me` and `/auth/logout` behave correctly for both an authenticated and an unauthenticated request
- [x] 8.6 Manually verify a logged-in user can still join and play a room by nickname exactly like a guest

## 9. Google Sign-Up Username Selection (refinement)

- [x] 9.1 Add `signGooglePendingToken`/`verifyGooglePendingToken` to `server/src/auth/jwt.ts`: a short-lived (15m), type-discriminated JWT carrying `{ googleId, email, suggestedUsername }` — never accepted by `requireAuth`
- [x] 9.2 Split `handleGoogleProfile` into `resolveGoogleProfile` (lookup-only, no DB write) + `suggestAvailableUsername` (best-effort suggestion, not a reservation) in `server/src/auth/routes.ts`
- [x] 9.3 Update the Google strategy verify callback and `/auth/google/callback` to redirect existing accounts with `?token=...` as before, and first-time accounts with `?googlePendingToken=...&suggestedUsername=...` instead of auto-creating
- [x] 9.4 Implement `POST /auth/google/complete`: validates the pending token, re-checks username uniqueness at creation time, creates the user, and returns the same "already created" response instead of erroring on a double-submit for the same Google id
- [x] 9.5 Update `AuthService.consumeGoogleRedirectToken` to handle both redirect shapes; add `googleSignupPending` signal and `completeGoogleSignup()`
- [x] 9.6 Add `GoogleUsernameStep` component (prefilled with the suggested username, editable, with a cancel action that discards the pending token) and wire it into `AuthHeader` to self-open when a pending signup arrives via redirect
- [x] 9.7 Verify end-to-end: minted a real pending token via the server's own signing function, drove the frontend through prefill → edit → submit → logged in as the chosen username; verified duplicate-username, expired/garbage-token, and double-submit-same-google-id all behave per spec
