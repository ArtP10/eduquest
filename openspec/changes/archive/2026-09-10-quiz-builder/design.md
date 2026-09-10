## Context

The auth phase (`add-auth-layer`) established the patterns this change builds on: `pg` via a lazily-connected `Pool` (`server/src/db.ts`), `node-pg-migrate` migrations in `server/migrations/`, a JWT `requireAuth` Express middleware, and the non-negotiable rule that the core game must keep working with zero DB dependency — Postgres being down degrades only the DB-dependent surface, never crashes the process or blocks the socket-based game loop.

Quiz content today is entirely static: `server/src/quizzes.ts` exports two hardcoded `Quiz` objects (`shared/quiz.ts`: `{ id, title, questions: [{ text, choices: [4], correctIndex, seconds }] }`), and `createRoom()` (`server/src/rooms.ts`) always calls `pickRandomQuiz()` — the client never chooses. The Angular app has no router at all; every screen (lobby, match, leaderboard, and the auth login/signup panels added in the previous phase) is a signal-driven conditional in one component tree, with modals for auth instead of routes.

This phase introduces the first real Angular routing in the app (a proposal requirement — "route-guarded ... first use of route guards") and the first Postgres tables besides `users`.

## Goals / Non-Goals

**Goals:**
- Any logged-in user can create, edit, and publish a quiz through a UI, with drafts private to their author.
- A published builder quiz is selectable at room-creation time, indistinguishable to the game engine from a mock quiz.
- Zero risk to the existing game loop, including when Postgres is unreachable.
- Establish the routing + route-guard pattern the later phases (public discovery, AI generation) will also need.

**Non-Goals:**
- Public discovery/search/browsing of published quizzes (future phase) — only room creation and the author's own listing surface them.
- Per-question timer/choice-count configuration, drag-and-drop reordering UI, quiz deletion once it has game history, or multi-author editing — all explicitly deferred per the proposal.
- Migrating the two mock quizzes into the database.

## Decisions

**1. `choices` stored as a `jsonb` array, not four `choice_a..d` columns.**
The shared runtime type (`shared/quiz.ts`) already models choices as a 4-tuple array (`[string, string, string, string]`), and the game engine, the mock quizzes, and every client-side consumer expect that shape. A `jsonb` column round-trips directly to/from that tuple with no reassembly step; four scalar columns would require building the array back up in every read path for no benefit (the "exactly 4, non-empty" validation happens in the application layer either way, not the DB). `correct_choice` is a `smallint` (0-3), mirroring `correctIndex`.

**2. `quizzes.status` is `text` with an app-level `'draft' | 'published'` check, not a Postgres `enum` type.**
Consistent with the auth phase's minimalism (no enum type was introduced for anything there either); a two-value status doesn't earn the migration complexity of adding/altering a Postgres enum type later if a third status is ever needed. Validated at the application layer on every write.

**3. `order_index` is assigned by the application (`COUNT(*) WHERE quiz_id = $1` at insert time), not a DB sequence or trigger.**
Multi-author concurrent editing of the same quiz is explicitly out of scope, so the single-author race this could theoretically hit isn't a real concern this phase. Keeps question insertion a plain `INSERT`, matching the rest of the schema's hand-written-SQL style.

**4. `updated_at` is set explicitly by the application on every `PATCH`, not a DB trigger.**
Same rationale as decision 1 in the auth phase's design (no triggers introduced there either) — one more line in each mutating query is cheaper than introducing the first trigger to this schema.

**5. Ownership is enforced by a small Express middleware that loads the resource once and attaches it to `req`, not repeated inline checks per route.**
`requireQuizOwnership` (quiz routes) and `requireQuestionOwnership` (question routes, which joins through to the parent quiz) both 404 if the resource doesn't exist and 403 if `author_id` doesn't match `req.userId`, then attach the loaded row so the handler doesn't re-query. Mirrors `requireAuth`'s shape from the auth phase rather than inventing a different pattern.

**6. `GET /quizzes/:id` uses a new `optionalAuth` middleware (attaches `req.userId` if a valid token is present, never rejects), not `requireAuth`.**
This is the one route where the visibility rule depends on *whether* the requester is authenticated, not just *whether* an action is allowed — a published quiz is visible to anyone (including guests with no token), a draft only to its author. `requireAuth` would incorrectly force a token even for the guest-visible published case.

**7. `GET /quizzes/available` merges mock + published quizzes in the application layer and degrades to mock-only if Postgres is unreachable — it never 503s.**
Room creation today has zero DB dependency; this change must not regress that. The merge function catches the same connection-error class `withDbErrorHandling` recognizes (from the auth phase's `server/src/auth/errors.ts`) and falls back to `loadQuizzes()` (mock-only) rather than propagating the error, so a DB outage silently hides published quizzes instead of breaking room creation.

**8. `room:create` gains an optional `quizId`; omitting it keeps today's random-mock-quiz behavior exactly.**
Additive change to the Socket.IO contract (`shared/events.ts`) — existing clients/flows that never send `quizId` are unaffected. If `quizId` is provided but doesn't resolve (bad id, or a draft the requester doesn't own — room creation has no auth context to check ownership against, so an unpublished/foreign quiz id is simply treated as "not found"), the server falls back to a random mock quiz rather than rejecting room creation outright, keeping the "quiz selection can never block starting a game" guarantee.

**9. Converting a builder quiz to the engine's `Quiz` shape injects the fixed `QUESTION_SECONDS` constant per question rather than reading a stored value.**
The schema has no per-question timer column (by design — timer is a system-wide constant this phase, per the proposal's explicit non-goal). The conversion function is the single place that constant is referenced, so raising it later (if a future phase makes it configurable) touches one function, not the schema.

**10. Angular routing is added additively: the existing lobby/match/leaderboard tree stays exactly as it is, now rendered at the root route (`''`), while the two new screens get real routes (`/quizzes`, `/quizzes/:id`) behind a `authGuard`.**
Rewriting the existing game flow to be route-driven is out of scope and risky (it's the part of the app under the strongest "don't touch gameplay" constraint). `provideRouter` is added to `app.config.ts`, `app.html` gains a `<router-outlet>` alongside (not replacing) the existing conditional game views — the root route's component is effectively "today's `App` template," so nothing about the game/lobby/auth-modal flow changes behaviorally.

**11. `authGuard` is a functional `CanActivateFn` reading `AuthService.isAuthenticated()` directly (a signal, already synchronously available after the app's initial `/auth/me` restore), redirecting to the root route with the login panel opened, rather than a login *page*.**
The auth phase deliberately never built a dedicated login route/page — login is a modal panel (`AuthHeader`'s overlay) shown over whatever screen is active. A guard redirect to a separate `/login` page would be inconsistent with that pattern and require building a page this app otherwise doesn't have. Instead the guard redirects to `/` and sets `AuthService`'s existing panel-open mechanism (extended slightly so `AuthHeader` can be told "open login" from outside a click handler) so the person lands back on the home screen with the login panel already open.

## Risks / Trade-offs

- **[Risk]** The guard's "redirect to `/` with login panel open" depends on a bit of cross-component signal plumbing between the router and `AuthHeader` rather than the router's own state. → **Mitigation**: keep it to one shared signal on `AuthService` (e.g. `requestedLoginRedirect`) that `AuthHeader` already watches via the same `effect()` pattern it uses for the Google-pending-signup panel — no new mechanism, just one more producer of an existing consumer.
- **[Risk]** `GET /quizzes/available` merging two sources (static array + DB query) on every room-creation screen load adds a DB round-trip to a path that previously had none. → **Mitigation**: acceptable latency-wise at this scale (classroom-sized usage); the fallback (decision 7) means correctness/availability is never at risk, only a published quiz temporarily not showing up.
- **[Risk]** Introducing the router changes `app.config.ts`/`app.html`, which every existing screen depends on. → **Mitigation**: root-route-wraps-existing-tree (decision 10) keeps the change additive at the template level; validate with the same kind of full guest-flow-with-DB-down browser check used in the auth phase before calling this done.
- **[Trade-off]** No DB trigger for `updated_at` and no DB-level sequence for `order_index` means both are only as correct as the application code that sets them — acceptable given single-author, non-concurrent editing is the only supported case this phase.

## Migration Plan

1. Add the `create_quizzes_and_questions_tables` migration (two new tables, `questions.quiz_id` FK to `quizzes.id`, `quizzes.author_id` FK to `users.id`) — additive only, no existing table touched.
2. Ship backend quiz-builder routes + ownership middleware — safe to deploy any time, nothing calls them yet except the new frontend screens.
3. Ship `GET /quizzes/available` and the `room:create` `quizId` extension — additive to the socket contract; existing callers (today's lobby "Crear sala" button, unchanged) keep working with no code changes since `quizId` stays optional.
4. Add the router, guard, and the two new screens.
5. **Rollback**: no existing route, socket handler, or table is modified, so rollback is reverting this change's files; `node-pg-migrate down` reverses the one migration if the tables themselves need to go.

## Open Questions

- Whether a host should be able to see *which* quiz (mock or published) will be used before clicking "Crear sala," vs. today's silent random pick — the proposal's scope says quizzes become "selectable," so the builder work assumes a picker UI exists, but the exact lobby UI treatment (dropdown vs. list) is left to implementation.
- Long-term, `GET /quizzes/available` returning literally every published quiz in the system (once public discovery exists) won't scale as a flat list — out of scope to solve now since discovery/browsing is an explicitly deferred phase.
