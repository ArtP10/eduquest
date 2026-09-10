## Context

Matches are played entirely in-memory today (`server/src/rooms.ts`, `server/src/match.ts`): a `Room` holds `players`, per-question `answers` (overwritten every question), and running `scores`, and is deleted once everyone disconnects. Nothing survives a match ending.

Three gaps matter for this change:

0. **A room's quiz isn't always a Postgres row — resolved by seeding.** `resolveQuizForRoom()` (`server/src/quiz-builder/gameplay.ts`) resolves `room.quiz` to either a hardcoded sample quiz (`server/src/quizzes.ts`, the default/fallback path — including when Postgres itself is unreachable, so this content must stay in-memory) or a `published` quiz from the `quizzes` table. Rather than make `matches.quiz_id` nullable to work around that, the two sample quizzes are seeded as real `quizzes`/`questions` rows with fixed ids matching `quizzes.ts` exactly (migration `1788600000003_add-sample-quiz-support`, `is_sample = true`, `author_id = null`, `status = 'draft'` so they never surface via the quiz-builder/library routes) — see Decision 6. `resolveQuizForRoom()` itself is unchanged: it still resolves sample-quiz content from the in-memory array, not Postgres, preserving DB-outage resilience.
1. **No player identity in rooms.** `room:create` / `room:join` (`shared/events.ts`) carry only a `displayName` — no auth token — so `Player` (`rooms.ts`) has no `userId`. Persisting `match_players.user_id` for logged-in participants requires resolving identity at join time.
2. **No per-question answer history.** `room.answers` is a `Map<playerId, SubmittedAnswer>` that's reset at the start of every `climbing` phase (`startClimbPhase` in `match.ts`). By the time `endMatch()` runs, only the *last* question's answers are still in memory — everything needed for `match_answers` (per player, per question, correct/incorrect, answer time) must be captured earlier, in `startResultsPhase()`, where `isCorrect` is already computed once per question.

The existing quiz-builder ownership/auth patterns (`requireAuth`, `requireQuizOwnership`, `optionalAuth` in `server/src/auth/middleware.ts`, `verifyAccessToken` in `server/src/auth/jwt.ts`) are reused rather than re-invented.

## Goals / Non-Goals

**Goals:**
- Persist every completed match (host, players including guests, per-question answers) without changing observable in-game behavior.
- Resolve a participant's `userId` when they're logged in, at the moment they create or join a room, via a JWT already issued by the existing auth system — no new auth mechanism.
- Serve match history, match detail, per-player drill-down, and quiz global average with the access rules from the proposal (self, host, or public/participant as specified).

**Non-Goals:**
- Real-time updates to match history while a match is in progress (history is written once, at `endMatch()`).
- Any change to `buildLeaderboard()`, scoring, modifiers, or the climb/freeze/results phase machine itself.
- Retrofitting identity onto already-in-flight rooms — the auth token is only read at `room:create`/`room:join` time.

## Decisions

**1. Add an optional `authToken` to `RoomCreateRequest`/`RoomJoinRequest`, verified inline with the existing `verifyAccessToken()`.**
Socket.IO events aren't HTTP requests, so `requireAuth`/`optionalAuth` (Express middleware) don't apply directly. Rather than build a parallel socket-auth layer, the client sends its existing access token (already held by `AuthService` for HTTP calls) as a plain field in the same payload; the server calls `verifyAccessToken(token)` — the same function `optionalAuth` already uses — and sets `Player.userId` if it's valid, leaving it `undefined` for guests or invalid/expired tokens (never rejects the socket call). Alternative considered: a `socket.io` auth handshake (`io(url, { auth: { token } })`) verified once at connection — rejected because a single browser tab can hold multiple room sessions across reconnects/rejoins and per-event is simpler to reason about, matching how `optionalAuth` already treats a missing/invalid token as "anonymous," not an error.

**2. `matches.room_creator_id` is nullable, despite the proposal's schema sketch.**
Room creation has no auth requirement today (unlike quiz creation) and this change doesn't add one — a guest can still host a room. Making `room_creator_id` `NOT NULL` would either force login-to-host (out of scope) or silently drop guest-hosted matches from persistence (breaks "guests still count toward aggregate stats"). The host-only actions in the proposal (`/matches/:id/players/:matchPlayerId/answers` host access) are therefore only reachable when the match's host was logged in — a guest-hosted match still has full leaderboard/stats visibility for every logged-in participant, just no host-drill-down-into-others capability, which matches "no changes to guest tracking" from the proposal.

**3. Accumulate per-question answers on the `Room` during the match, flush to Postgres once in `endMatch()`.**
A new `Room.answerLog: MatchAnswerRecord[]` (or `Map<playerId, MatchAnswerRecord[]>`) is appended to inside `startResultsPhase()`, right where `isCorrect` and `score` are already computed per player — no new pass over players, no schema change to the live phase machine. Each record is a full snapshot of the question as presented to this room (`questionText`, `choices`, `correctChoiceIndex`, `selectedChoiceIndex`), not just `isCorrect` — the per-player drill-down needs to show the actual question and every option, not just right/wrong, and there's no `questions` FK to join back through to reconstruct it later (choices are shuffled per room; a sample quiz's questions have no `questions` row at all — see Decision 6). `endMatch()` then does one batch write (1 `matches` row, N `match_players` rows, N×questions `match_answers` rows) inside a single transaction. Alternative considered: write each answer to Postgres as it happens (per question) — rejected as unnecessary write load and complexity (partial-match persistence, cleanup on abandoned rooms) for no user-visible benefit, since nothing reads match history before a match ends.

**3a. The per-player drill-down shows one overall score, not a percentage per question.**
A percentage computed from a single participant's single answer to one question is always 100% or 0% — it adds no information beyond "right" or "wrong," so the drill-down instead shows one overall score (e.g. "3/5, 60%") derived client-side from the returned per-question array, plus the full question/choices/correct-answer/their-answer for review. This is distinct from the match-wide "Estadísticas por pregunta" aggregate (Requirement: Match Detail Visibility), which stays a genuine percentage since it's computed across every participant in the match, not one.

**4. Persistence failure never blocks or corrupts the live match.**
`endMatch()` already emits `match:ended` synchronously from in-memory state (`buildLeaderboard`, `rankPlayersByClimbProgress`). The Postgres write is fire-and-forget *after* that emit (matching the existing `GET /quizzes/available` pattern of degrading gracefully when Postgres is unreachable — see `quiz-content` spec's DB-outage scenario): if it fails, the match still ends normally for connected clients, just without a persisted history record. Logged server-side, not surfaced to clients.

**5. `match_players.final_placement` uses the same climb-progress ranking already computed in `endMatch()`** (`rankPlayersByClimbProgress`), not `score`/correct-answer count — placement in match history must match what players saw in the `match:ended` payload.

**6. Sample quizzes are seeded as real `quizzes`/`questions` rows, so `matches.quiz_id` is a plain `NOT NULL` FK for every match — no nullable-FK workaround.**
The two sample quizzes (`server/src/quizzes.ts`) get fixed ids and matching `quizzes`/`questions` rows via migration `1788600000003_add-sample-quiz-support`: `author_id = NULL`, `is_sample = true` (an explicit flag, not inferred from the null author — see `QuizRecord.isSample`), `status = 'draft'` so `GET /quizzes/published`, `GET /quizzes/:id`, and `GET /quizzes/mine` all continue to never surface them (`published-quizzes.ts` additionally filters `is_sample = false` explicitly, belt-and-suspenders on top of the `status` filter). This makes `matches.quiz_id` a straightforward `NOT NULL REFERENCES quizzes ON DELETE RESTRICT` — every match, sample or builder quiz alike, gets a real FK and a working `GET /quizzes/:id/stats` global average, and `persistMatch()` needs no branch at all.

Two things this does *not* change: (a) `resolveQuizForRoom()` still resolves a sample quiz's actual content from the in-memory array in `quizzes.ts`, not from Postgres — that in-memory copy remains the DB-outage-resilient source of truth for gameplay, the seeded rows exist purely as FK targets for match history; the two must be kept in sync by id (documented at both call sites) or persistence for that quiz silently no-ops (fails soft per Decision 4, not loudly). (b) `match_answers` still has no `question_id` column, for an unrelated, still-true reason: `QuizQuestion` (`shared/quiz.ts`), the shape every room's `quiz.questions` is made of, carries no question id at all even for a seeded/builder quiz — `toEngineQuiz()` (`server/src/quiz-builder/gameplay.ts`) drops it when converting DB rows into engine shape, and per-room shuffling reorders questions anyway. `match_answers` identifies a question by `question_index` (its position in that match's shuffled order) instead, which is all per-question stats need since they're only ever read back scoped to a single match.

Alternative considered (and rejected after discussion): give the two sample quizzes to a synthetic non-loginable "system" user account instead of a nullable `author_id` — rejected as an unnecessary extra row/concept when a nullable `author_id` plus an explicit `is_sample` flag says the same thing more directly, and keeps `quizzes.author_id = NULL` meaning exactly one thing (no real author) rather than two (no author, or "owned by a fake account nobody can log into").

**7. New `server/src/match-history/` module** (data access + routes), mounted in `index.ts` alongside `quizBuilderRouter`/`quizLibraryRouter`, following their existing shape (plain `pg` queries, no ORM, matching `server/src/quiz-builder/quizzes.ts`). `GET /quizzes/:id/stats` is added to the existing `quiz-builder` router/module instead, since it's a `/quizzes/:id/*` route reusing quiz lookup, not a `/matches/*` concern.

## Risks / Trade-offs

- **[Risk]** A room that never reaches `endMatch()` (e.g., every player disconnects mid-match) leaves no history record, silently. → **Mitigation**: acceptable per proposal scope (no abandoned-match handling requested); `deleteRoom()`'s existing cleanup is unaffected.
- **[Risk]** `Room.answerLog` grows unbounded for a very long quiz. → **Mitigation**: bounded by `quiz.questions.length × room.players.size`, the same bound `room.scores`/`room.modifiers` already have; no new order-of-magnitude concern.
- **[Trade-off]** Guest-hosted matches can't support the host-drill-down endpoint (Decision 2). → Accepted: matches "guests aren't tracked" from the proposal; a guest host simply never had `req.userId` to check ownership against in the first place, consistent with how quiz-builder already treats unauthenticated actors.
- **[Risk]** Client must be updated to pass `authToken` on `room:create`/`room:join`, or every match is recorded as guests-only. → **Mitigation**: purely additive/optional field — old clients keep working (all-guest history), just without user attribution until the client change ships as part of this same proposal.

## Migration Plan

1. Ship the `create_matches_tables` migration (three tables + indexes) via `node-pg-migrate`, additive only.
2. Ship backend changes (socket payload + persistence hook + new routes) — additive; no existing route or event payload shape is removed, only extended with optional fields.
3. Ship frontend changes (My Matches, match detail, drill-down, Quiz Library stat).
4. No backfill: history starts accumulating from matches played after deploy; nothing to migrate for matches played before this change.
5. Rollback: routes and the persistence hook can be reverted independently of the migration (tables left unused, no destructive `down` needed unless reclaiming schema space).

## Open Questions

- None outstanding — guest-hosted matches, persistence-failure handling, and placement source are resolved above per existing repo conventions (mock-quiz Postgres-outage fallback, `optionalAuth`'s anonymous-on-invalid-token behavior).
