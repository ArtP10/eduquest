## Why

Every quiz in QuizJumper today is one of two hardcoded mock quizzes (`server/src/quizzes.ts`). Phase 2 of the roadmap (manual quiz authoring) lets any logged-in user build their own quiz through a UI instead of editing server source — a prerequisite for both real classroom use and the later AI-generation phase, which will populate the same builder data instead of a separate path.

## What Changes

- Add `quizzes` and `questions` tables (Postgres) — a draft/published quiz owned by its author, each with up to a fixed set of 4-choice questions.
- Add backend CRUD for quizzes/questions (`server/src/quiz-builder/`), all owner-scoped (403 for anyone but the author), reusing the existing JWT auth (`requireAuth`) from the auth phase.
- Add a new `GET /quizzes/available` endpoint that merges the hardcoded mock quizzes with published builder quizzes into one selectable list for room creation — falling back to mock-only if Postgres is unreachable, so a DB outage never blocks creating a room (same guarantee the auth phase established).
- Extend the `room:create` Socket.IO event with an optional `quizId` so a host can pick a specific quiz (mock or published); omitting it keeps today's behavior (a random mock quiz).
- Add Angular routing (`@angular/router`) to the app for the first time, plus a route guard (`authGuard`) protecting the two new screens: "My Quizzes" (list/status) and the quiz builder (title + question editor, save draft / publish).
- Extend the shared pixel-art component kit with whatever the 4-choice question editor needs (e.g. a `PixelChoiceRow`), rather than one-off styling.

Explicitly not changed:
- Jumper physics, the freeze/checkpoint timer, boost/slowdown, or scoring — a builder-authored quiz is converted into the exact same `Quiz`/`QuizQuestion` shape (`shared/quiz.ts`) the engine already consumes from mock quizzes, timer included (the fixed 10s constant is applied when converting, not stored per question).
- The two existing mock quizzes — they stay hardcoded and keep showing up in the selectable list permanently, not migrated into the database.
- Public discovery/browsing of published quizzes by non-authors (future phase) — a published quiz is reachable by anyone who has its id (needed so `GET /quizzes/available` and room creation can use it) but is not searchable/listed to non-authors beyond that.

## Capabilities

### New Capabilities
- `quiz-builder`: Draft/published quiz and question CRUD, owned by the authoring user, with the validation and ownership rules described above.

### Modified Capabilities
- `quiz-content`: "Quiz Assignment to Room" changes from "the server always assigns a random mock quiz" to "the server assigns whichever quiz (mock or published) the client selected, falling back to a random mock quiz if none was selected or the selection is invalid." The two mock-quiz requirements (hardcoded content, one-correct-answer-among-four) are unchanged.

## Impact

- **New**: `server/migrations/*_create_quizzes_and_questions_tables.js`, `server/src/quiz-builder/` (routes, ownership middleware, DB access), `client/src/app/quiz-builder/` (My Quizzes list, builder screen), `client/src/app/auth/auth.guard.ts`, `client/src/app/app.routes.ts`, new shared pixel-ui pieces alongside the existing `PixelButton`/`PixelInput`/`PixelPanel`.
- **Modified**: `server/src/quizzes.ts` (or a new sibling module) gains a function merging mock + published quizzes; `server/src/rooms.ts`/`server/src/index.ts`'s `room:create` handler accepts an optional `quizId`; `shared/events.ts` socket contract gains that optional field (additive, non-breaking); `client/src/app/app.config.ts` adds the router provider; `client/src/app/app.ts`/`app.html` adopt a `<router-outlet>` for the new screens while the existing lobby/match/leaderboard flow keeps working unrouted at the root, per the "no changes to gameplay" constraint.
- **Dependencies added**: client — `@angular/router` (already ships with the Angular version in use; just not wired up yet). No new server dependencies (reuses `pg`, `bcryptjs`/`jsonwebtoken` are irrelevant here — only `requireAuth` is reused).
- **Unaffected**: `server/src/match.ts`, `server/src/scoring.ts`, the Phaser jumper scene, and every existing auth endpoint/screen.
