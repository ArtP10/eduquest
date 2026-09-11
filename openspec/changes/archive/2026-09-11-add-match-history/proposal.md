## Why

Once a QuizJumper match ends, its results vanish — a logged-in player has no way to look back at how they or others did, and quiz authors have no signal on how their quiz performs over time. Persistent match history lets participants review a match's leaderboard and per-question breakdown afterward, and gives every quiz a global average grade once it's been played.

## What Changes

- Persist every completed match to Postgres: the match itself, each participant (including guests), and every player's per-question answers.
- Add `GET /matches/mine` — a logged-in user's own match history (as player and/or host).
- Add `GET /matches/:id` — full match detail (leaderboard, per-question stats, quiz global average) for any participant.
- Add `GET /matches/:id/players/:matchPlayerId/answers` — one player's per-question correct/incorrect breakdown, viewable by that player or the match's host.
- Add `GET /quizzes/:id/stats` — a quiz's global average (percent-correct / 0-100 grade) aggregated across all matches it's been played in.
- Add a "My Matches" screen and a match detail screen (leaderboard + per-question stats + global average + per-player drill-down) to the Angular client.
- Surface a quiz's global average on its Quiz Library card/detail once it has at least one played match.
- Guests are never attached to a user account, but their scores/answers are stored and counted in aggregate stats.

## Capabilities

### New Capabilities
- `match-history`: persisting completed matches (players, answers) and serving per-user match history, single-match detail, and per-player answer drill-down, with host/self-only access control.

### Modified Capabilities
- `quiz-builder`: adds a global-stats requirement (`GET /quizzes/:id/stats`) — a quiz's aggregate percent-correct/grade across all its played matches, empty/null if never played.

## Impact

- **Database**: three new tables (`matches`, `match_players`, `match_answers`) with FKs into `quizzes`/`users`, plus indexes on `match_players(match_id)` and `match_answers(match_id, question_index)`. Also alters the existing `quizzes` table: `author_id` becomes nullable and a new `is_sample` flag is added, so the two hardcoded sample quizzes can be seeded as real `quizzes`/`questions` rows (`author_id = null`, `status = 'draft'`) — this lets `matches.quiz_id` be a plain `NOT NULL` FK for every match instead of a nullable one (see design.md Decision 6).
- **Backend**: hooks into the existing game-end flow (`endMatch()` in `server/src/match.ts`) to write match records; new `server/src/match-history/` route/data-access module; new routes mounted alongside existing ones; `resolveQuizForRoom()`'s sample-quiz content still resolves from the in-memory array (DB-outage resilience unchanged), now just carrying fixed ids that match the seeded rows.
- **Frontend**: new routed screens (My Matches, match detail) under route guard (reuses `authGuard`), linked from the main nav; Quiz Library card gains an additive stat display; new shared pixel-UI component for per-question stats, reusing the existing kit.
- **No changes** to live in-game leaderboard, scoring, boost/slowdown, jumper mechanics, or Quiz Library browse/search/tag/sort behavior — sample quizzes remain excluded from the public library listing.
