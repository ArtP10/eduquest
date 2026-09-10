## Why

Today, picking a quiz for a room is a flat `<select>` populated by `GET /quizzes/available` (mock quizzes + every published builder quiz, no search or filtering) inside the Lobby screen. As the number of published quizzes grows (manual and AI-generated), a flat dropdown stops scaling — players need to browse, search, and filter to find something worth playing, and authors need a way for their published work to actually be discoverable. A public, searchable Quiz Library (with tags and popularity) replaces the dropdown as the room-creation entry point.

## What Changes

- Add `tags` and `quiz_tags` (many-to-many) tables, and a `play_count` column on `quizzes` (default 0), with supporting indexes (`quizzes.title` for search, `tags.name`).
- Add `GET /quizzes/published` — paginated, card-grid-shaped data (title, author username, question count, tags, play_count), combinable `search` (title keyword), `tags` (match-any), and `sort` (`popular` by `play_count` desc, or `newest`, default) query params.
- Add `GET /tags` — list of all existing tags, for the filter-chip UI.
- Add a tag write path (author adds a tag from the quiz builder or after AI generation): server-side lowercase + trim before lookup/insert, reusing an existing matching tag row rather than creating a near-duplicate.
- Increment `quizzes.play_count` by 1 each time a room is created using that quiz (once per room, not per player join).
- Room creation (`room:create` / `resolveQuizForRoom`) now accepts any published library quiz id, not just ones surfaced by the old dropdown, and continues to validate the quiz is actually `published` before use.
- **BREAKING**: Remove `GET /quizzes/available` (the endpoint backing the old flat dropdown) — superseded by `GET /quizzes/published` + `GET /tags`. The mock quizzes it used to include stay purely as the local/dev random-fallback (`pickRandomQuiz`) and are not part of the public library.
- Add a new Quiz Library page (Angular): searchable/filterable/sortable card grid (poster-style cards: title, tag pills, author, question count, play-count indicator), pixel-art styled, using a new `PixelCard` component added to the shared kit. No login required to browse/search — only to publish (unchanged).
- Remove the quiz `<select>` dropdown from the Lobby entirely; "Crear sala" now routes into the Quiz Library, and picking a card carries the chosen quiz id back into room creation.
- Add a plain tag input (comma/enter to add, no autocomplete required for v1) to the quiz builder screen so authors can add/remove tags on a quiz, including one generated via AI (Phase 4) — same UI, no separate path.

Explicitly not changed:
- Jumper/gameplay mechanics, scoring, boost/slowdown.
- AI generation logic itself — generated quizzes get tags through the same builder UI as manual ones, nothing added to the generation pipeline.
- Mock/demo quizzes — they remain a separate hardcoded fallback (`server/src/quizzes.ts`), not part of the Postgres-backed library, and are not searchable/browsable in the new UI.

## Capabilities

### New Capabilities
- `quiz-library`: Public browsing, search, tag-filtering, and sorting of published quizzes (card-grid data + UI), plus the tag catalog (`GET /tags`) and case-insensitive tag dedup on write.

### Modified Capabilities
- `quiz-builder`: Removes `GET /quizzes/available`. Adds author-facing tag management — attaching/removing tags on a quiz (draft or published), authored through the existing builder screen.
- `quiz-content`: "Quiz Assignment to Room" changes from "the server assigns whichever mock-or-published quiz the client selected via the old available-quizzes list" to "the server assigns any client-selected published library quiz (sourced from the Quiz Library, not a dropdown), still falling back to a random mock quiz if none was selected or the selection is invalid, and increments that quiz's `play_count` by 1 when the room is created."

## Impact

- **New**: `server/migrations/*_create_tags_and_quiz_tags_tables.js` (+ `play_count` column migration), `server/src/quiz-library/` (published-quiz query/search/sort, tags list, tag write/dedup helper), `client/src/app/quiz-library/` (library page, search/filter/sort UI), `client/src/app/shared/pixel-ui/pixel-card/`.
- **Modified**: `server/src/quiz-builder/routes.ts` (remove `/quizzes/available`, add tag attach/detach endpoints on a quiz), `server/src/quiz-builder/gameplay.ts`/`resolveQuizForRoom` (play_count increment, library-sourced id), `client/src/app/lobby/` (remove `<select>`, route "Crear sala" into the library and carry the chosen quiz id + display name back through room creation), `client/src/app/quiz-builder/quiz-editor/` (tag input), `client/src/app/quiz-builder/quiz-builder.service.ts` (drop `listAvailable`, add library/tag calls), `client/src/app/app.routes.ts` (new public `/library` route, no `authGuard`).
- **Unaffected**: `quizzes`/`questions` core columns and the manual/AI question-authoring flow itself, `server/src/match.ts`, `server/src/scoring.ts`, the Phaser jumper scene, all existing auth endpoints, `server/src/quiz-generation/*`.
