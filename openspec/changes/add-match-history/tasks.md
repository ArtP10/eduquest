## 1. Database & Migration

- [x] 1.1 Add `create_match_history_tables` migration: `matches` (`id uuid pk default gen_random_uuid()`, `quiz_id uuid not null references quizzes(id) on delete restrict`, `quiz_title text not null` — snapshot so a renamed quiz doesn't change how past matches display, `room_creator_id uuid references users(id)` — nullable, see design.md Decision 2, `played_at timestamptz not null default now()`), `match_players` (`id uuid pk default gen_random_uuid()`, `match_id uuid not null references matches(id)`, `user_id uuid references users(id)` — nullable for guests, `nickname text not null`, `final_score integer not null`, `final_placement integer not null`), `match_answers` (`id uuid pk default gen_random_uuid()`, `match_id uuid not null references matches(id)`, `question_index integer not null` — position within the match's question order (see design.md Decision 6; `QuizQuestion` carries no DB id for any quiz, seeded or builder), `match_player_id uuid not null references match_players(id)`, `question_text text not null`, `choices jsonb not null`, `correct_choice_index smallint not null`, `selected_choice_index smallint` — nullable, null if the player didn't answer in time (see design.md Decision 3: a full question snapshot, not just right/wrong, so the drill-down can show the actual questionnaire), `is_correct boolean not null`, `answer_time_ms integer`)
- [x] 1.2 Add indexes: `match_players(match_id)`, `match_answers(match_id, question_index)`
- [x] 1.3 Add `add_sample_quiz_support` migration: `quizzes.author_id` → nullable, add `quizzes.is_sample boolean not null default false`; seed the two sample quizzes (`server/src/quizzes.ts`) as real `quizzes`/`questions` rows with fixed ids matching that file exactly, `author_id = null`, `is_sample = true`, `status = 'draft'` (see design.md Decision 6)
- [x] 1.4 Change the two sample quizzes' `id` fields in `server/src/quizzes.ts` from string slugs to the same fixed UUIDs seeded in 1.3; document the invariant that the two must stay in sync by id
- [x] 1.5 Add `isSample: boolean` to `QuizRecord`/`rowToQuiz` (`server/src/quiz-builder/quizzes.ts`, and the duplicate mapper in `server/src/quiz-generation/persistence.ts`); widen `authorId` to `string | null`
- [x] 1.6 Exclude sample quizzes from `GET /quizzes/published` (`server/src/quiz-library/published-quizzes.ts`) with an explicit `is_sample = false` condition, alongside the existing `status = 'published'` filter

## 2. Socket Payload & Identity Resolution

- [x] 2.1 Extend `RoomCreateRequest`/`RoomJoinRequest` (`shared/events.ts`) with an optional `authToken?: string`
- [x] 2.2 Extend `Player` (`server/src/rooms.ts`) with an optional `userId?: string`; extend `addPlayer()` to accept and store it
- [x] 2.3 In `index.ts`'s `room:create`/`room:join` handlers, verify `authToken` with `verifyAccessToken()` (reusing `server/src/auth/jwt.ts`) when present; pass the resolved `userId` (or `undefined` on missing/invalid token) into `addPlayer()` — never reject the socket call over an invalid token

## 3. Per-Question Answer Accumulation

- [x] 3.1 Add `Room.answerLog` (per-player, per-question correct/incorrect + answer time) in `server/src/rooms.ts`, initialized empty in `createRoom()`
- [x] 3.2 Append to `answerLog` inside `startResultsPhase()` (`server/src/match.ts`), where `isCorrect` is already computed per player — capture the full question snapshot (`questionText`, `choices`, `correctChoiceIndex`, `selectedChoiceIndex`) alongside `answer_time_ms` (from the existing `remainingMs`/duration data on `SubmittedAnswer`), since the drill-down needs to show the actual question/choices, not just right/wrong (see design.md Decision 3)

## 4. Backend Data Access

- [x] 4.1 Implement `server/src/match-history/matches.ts`: `persistMatch()` — writes one `matches` row, N `match_players` rows, N×questions `match_answers` rows in a single transaction, given a `Room` and its computed placements
- [x] 4.2 Implement query helpers: list matches for a user (`matches.mine`), match detail (leaderboard + per-question aggregate stats + participant list), one participant's per-question answers, and a quiz's aggregate percent-correct across all its matches
- [x] 4.3 Implement `server/src/match-history/access.ts`: helpers to check "is this user a participant (player or host) of this match" and "is this user this match's host"

## 5. Gameplay Integration

- [x] 5.1 In `endMatch()` (`server/src/match.ts`), after emitting `match:ended`, call `persistMatch()` with the room, its `answerLog`, and the already-computed `rankPlayersByClimbProgress()` placements as `final_placement`; catch and log persistence errors without affecting the emitted event or match teardown (see design.md Decision 4)

## 6. Backend Routes

- [x] 6.1 Implement `GET /matches/mine` (requireAuth): list the requester's matches (as player and/or host) with their own final score/placement per match
- [x] 6.2 Implement `GET /matches/:id` (requireAuth + participant check): full leaderboard, per-question stats (% correct, n/m), and the quiz's global average; 403 if requester was not a participant
- [x] 6.3 Implement `GET /matches/:id/players/:matchPlayerId/answers` (requireAuth + self-or-host check): per-question correct/incorrect breakdown; 403 otherwise
- [x] 6.4 Implement `GET /quizzes/:id/stats` in the existing quiz-builder router/module: aggregate percent-correct and 0-100 grade across all matches of that quiz; empty/null result if never played
- [x] 6.5 Mount the new match-history router in `server/src/index.ts` alongside the existing routers

## 7. Frontend Service & Routing

- [x] 7.1 Add a `MatchHistoryService` wrapping `/matches/mine`, `/matches/:id`, `/matches/:id/players/:matchPlayerId/answers`, and `/quizzes/:id/stats`
- [x] 7.2 Add `/matches` (My Matches list) and `/matches/:id` (match detail) routes to `app.routes.ts`, guarded by the existing `authGuard`

## 8. Shared Pixel UI Additions

- [x] 8.1 Add a per-question stats bar/table component (percentage + n/m) to `client/src/app/shared/pixel-ui/`, matching the existing visual language
- [x] 8.2 Verify new component(s) are responsive with visible keyboard focus states, consistent with the existing kit

## 9. Frontend Screens

- [x] 9.1 Build the "My Matches" screen: quiz title, date, the user's final score/placement, and whether they hosted, per match
- [x] 9.2 Build the match detail screen: leaderboard table, per-question stats, and the quiz's global average
- [x] 9.3 Add per-player answer drill-down on the leaderboard: clicking a row shows that player's overall score (e.g. "3/5, 60%" — not a percentage per question, which is meaningless for a single participant) plus the full questionnaire review (each question's text and choices, with the participant's pick and the correct answer both marked); enabled for the room creator on every row, and for a regular player only on their own row (other rows show no control, or a disabled one)
- [x] 9.4 Surface a quiz's global average on its Quiz Library card/detail view once `GET /quizzes/:id/stats` returns a non-empty result

## 10. Validation

- [x] 10.1 Manually verify a full match (mixed logged-in and guest players) persists correctly: match, participants, and per-question answers all present and correct after `match:ended`
- [x] 10.2 Manually verify `GET /matches/mine` returns only the requester's own matches, with correct own score/placement
- [x] 10.3 Manually verify `GET /matches/:id` returns full detail to any participant and 403s for a non-participant
- [x] 10.4 Manually verify the answer drill-down endpoint: a player can view their own answers, the host can view anyone's, and a non-host/non-owner is rejected
- [x] 10.5 Manually verify a guest-hosted match persists with no host user id, and that no authenticated user can use host access to view another participant's drill-down for it
- [x] 10.6 Manually verify `GET /quizzes/:id/stats` returns an aggregate for a played quiz and an empty result for an unplayed one
- [ ] 10.7 Manually verify a persistence failure (e.g., Postgres unreachable at match end) does not break the live match's `match:ended` event for connected clients
- [ ] 10.8 Manually verify live in-game leaderboard, scoring, boost/slowdown, and jumper mechanics are unchanged
