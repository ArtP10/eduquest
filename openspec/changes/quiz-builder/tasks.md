## 1. Database & Migration

- [x] 1.1 Add `create_quizzes_and_questions_tables` migration: `quizzes` (`id uuid pk default gen_random_uuid()`, `title text not null`, `author_id uuid not null references users(id)`, `status text not null default 'draft'`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`) and `questions` (`id uuid pk default gen_random_uuid()`, `quiz_id uuid not null references quizzes(id)`, `question_text text not null`, `choices jsonb not null`, `correct_choice smallint not null`, `order_index integer not null`)
- [x] 1.2 Add a check constraint on `quizzes.status` restricting it to `'draft'` / `'published'`

## 2. Backend Data Access

- [x] 2.1 Implement `server/src/quiz-builder/quizzes.ts`: create quiz, find by id, list by author, update title/status
- [x] 2.2 Implement `server/src/quiz-builder/questions.ts`: create question (computing next `order_index`), find by id, list by quiz id, update, delete
- [x] 2.3 Implement content validation helpers (non-empty text, exactly 4 choices, correct choice within range) shared by question create and edit

## 3. Backend Ownership & Auth Middleware

- [x] 3.1 Add `optionalAuth` middleware to `server/src/auth/middleware.ts`: attaches `req.userId` if a valid token is present, never rejects
- [x] 3.2 Implement `requireQuizOwnership` middleware (loads quiz by `:id`, 404 if missing, 403 if `author_id !== req.userId`, attaches the loaded quiz to `req`)
- [x] 3.3 Implement `requireQuestionOwnership` middleware (loads question by `:id`, joins to its quiz, same 404/403 rules, attaches both to `req`)

## 4. Backend Routes

- [x] 4.1 Implement `POST /quizzes` (requireAuth): create a draft quiz owned by the requester
- [x] 4.2 Implement `GET /quizzes/mine` (requireAuth): list the requester's own quizzes, all statuses
- [x] 4.3 Implement `GET /quizzes/:id` (optionalAuth): return the quiz + questions if published, or if the requester is its author; otherwise 404
- [x] 4.4 Implement `PATCH /quizzes/:id` (requireAuth + requireQuizOwnership): update title and/or status, validating `draft -> published` as the only allowed transition this phase
- [x] 4.5 Implement `POST /quizzes/:id/questions` (requireAuth + requireQuizOwnership): add a validated question
- [x] 4.6 Implement `PATCH /questions/:id` (requireAuth + requireQuestionOwnership): edit a question, same validation as creation
- [x] 4.7 Implement `DELETE /questions/:id` (requireAuth + requireQuestionOwnership): remove a question
- [x] 4.8 Mount the new router in `server/src/index.ts` alongside (not replacing) the existing `/auth` router and Socket.IO setup

## 5. Gameplay Integration

- [x] 5.1 Implement a builder-quiz -> `shared/quiz.ts` `Quiz` converter (maps `choices` jsonb to the 4-tuple, `correct_choice` to `correctIndex`, injects the fixed `QUESTION_SECONDS` constant per question)
- [x] 5.2 Implement `GET /quizzes/available`: merges `loadQuizzes()` (mock) with published builder quizzes, catching DB connection errors and falling back to mock-only instead of failing the request
- [x] 5.3 Extend the `room:create` Socket.IO payload (`shared/events.ts`) with an optional `quizId`
- [x] 5.4 Update `createRoom()`/the `room:create` handler: resolve `quizId` against the available-quizzes pool (mock id, or a `published` quiz by id); fall back to `pickRandomQuiz()` if `quizId` is omitted or unresolvable — never reject room creation over an invalid selection

## 6. Frontend Routing & Guard

- [x] 6.1 Add `@angular/router`'s `provideRouter` to `app.config.ts`
- [x] 6.2 Add `app.routes.ts`: root route (`''`) renders today's existing lobby/match/leaderboard/auth-overlay tree unchanged; `/quizzes` and `/quizzes/:id` are new, guarded routes
- [x] 6.3 Add `<router-outlet>` to `app.html` alongside the existing conditional views, without altering their current behavior
- [x] 6.4 Implement `authGuard` (`CanActivateFn`): allow if `AuthService.isAuthenticated()`; otherwise redirect to `/` and set a shared "open login" signal on `AuthService`
- [x] 6.5 Update `AuthHeader` to watch that signal (same `effect()` pattern already used for the Google-pending-signup panel) and open the login panel when it's set

## 7. Shared Pixel UI Additions

- [x] 7.1 Add whatever new shared component(s) the question editor needs (e.g. `PixelChoiceRow`: choice text input + "mark as correct" control) to `client/src/app/shared/pixel-ui/`, matching the existing `PixelButton`/`PixelInput`/`PixelPanel` visual language
- [x] 7.2 Verify the new component(s) are responsive and have visible keyboard focus states, consistent with the existing kit

## 8. Frontend Screens

- [x] 8.1 Add a `QuizBuilderService` (or extend an existing service) wrapping the `/quizzes` and `/questions` HTTP calls
- [x] 8.2 Build the "My Quizzes" screen: lists the user's quizzes with draft/published status, a "New quiz" action, links into the builder per quiz
- [x] 8.3 Build the quiz builder screen: edit title, list/add/edit/delete questions (text + 4 choices + correct answer), "Save draft" and "Publish quiz" actions, inline validation errors matching the backend's messages
- [x] 8.4 Add a quiz picker to the room-creation flow (lobby "Crear sala"): list from `GET /quizzes/available`, defaulting to today's random-mock behavior if nothing is explicitly chosen

## 9. Validation

- [x] 9.1 Manually verify the full guest flow (create room, join, play) still works with zero regression, including with Postgres **not running**
- [x] 9.2 Manually verify an unauthenticated visitor hitting `/quizzes` is redirected to `/` with the login panel open, and lands back on `/quizzes` after logging in (or re-navigates manually — confirm whichever the implementation does)
- [x] 9.3 Manually verify create draft -> add questions -> save -> publish, then confirm the quiz appears in `GET /quizzes/available` and is selectable at room creation, and plays through identically to a mock quiz
- [x] 9.4 Manually verify a second user cannot fetch another user's draft, and cannot edit/delete/publish another user's quiz or questions (403/404 as appropriate)
- [x] 9.5 Manually verify question validation errors (empty text, wrong choice count, missing/invalid correct choice) surface clearly in the builder UI
- [x] 9.6 Manually verify `GET /quizzes/available` and room creation both keep working (mock-only) with Postgres **not running**

## 10. Per-Room Question/Choice Shuffling (refinement)

- [x] 10.1 Add a Fisher-Yates `shuffled()` helper (`server/src/rooms.ts`, using `crypto.randomInt` like the room-code generator) and `shuffleQuizForRoom()`, which reorders a quiz's questions and, independently, each question's four choices (remapping `correctIndex` to the choice's new position)
- [x] 10.2 Apply `shuffleQuizForRoom()` in `createRoom()` so every room gets its own shuffle without mutating the source quiz (a mock quiz is a shared in-memory object; a builder quiz may be reused across rooms)
- [x] 10.3 Verify via a scripted Socket.IO client across several rooms that both the first-presented question and the first-position choice vary run to run
- [x] 10.4 Verify via a full scripted playthrough that the shuffled `correctIndex` returned at `results` still names the quiz's true correct answer for every question
