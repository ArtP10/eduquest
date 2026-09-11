## 1. Schema

- [x] 1.1 Create migration adding `tags` (`id` uuid PK, `name` text unique not null) and `quiz_tags` (`quiz_id` FK -> quizzes cascade, `tag_id` FK -> tags cascade, composite PK)
- [x] 1.2 Create migration adding `quizzes.play_count` (integer, not null, default 0)
- [x] 1.3 Add index on `quizzes.title` and index on `tags.name` (in addition to the unique constraint)
- [x] 1.4 Run migrations locally and confirm `migrate:up`/`migrate:down` both succeed

## 2. Backend: Tag Storage & Dedup

- [x] 2.1 Create `server/src/quiz-library/tags.ts` with `findOrCreateTag(rawName)`: trims/lowercases, looks up by exact match, inserts with `ON CONFLICT (name) DO NOTHING RETURNING *` + fallback `SELECT` on conflict
- [x] 2.2 Add `listTags()` (all tags) and `listTagsForQuiz(quizId)` helpers
- [x] 2.3 Add unit tests: mixed-case/whitespace input normalizes and dedups against an existing tag; two concurrent first-uses of the same new tag don't create two rows

## 3. Backend: Published Quiz Listing

- [x] 3.1 Create `server/src/quiz-library/routes.ts` with `GET /quizzes/published` (no auth) — page/limit params, joins author username, question count, tags, play_count
- [x] 3.2 Add `search` param (case-insensitive title match)
- [x] 3.3 Add `tags` param (comma-separated, match-any via join + `ANY($1::text[])`, de-duplicated results)
- [x] 3.4 Add `sort` param (`popular` = play_count desc, `newest` default = created_at desc); validate against an allowlist, never string-interpolate into SQL
- [x] 3.5 Add `GET /tags` (no auth) returning the full tag catalog
- [x] 3.6 Add integration tests: default listing excludes drafts; search; tag filter (single + multi, match-any); sort=popular vs default; combined search+tags+sort; pagination bounds; unauthenticated access succeeds

## 4. Backend: Author Tag Management (quiz-builder)

- [x] 4.1 Add `POST /quizzes/:id/tags` (requireAuth + requireQuizOwnership) accepting a tag name, using `findOrCreateTag` + inserting into `quiz_tags` (idempotent if already attached)
- [x] 4.2 Add `DELETE /quizzes/:id/tags/:tagId` (requireAuth + requireQuizOwnership) removing the association only (never deletes the tag row itself)
- [x] 4.3 Add integration tests: author adds/removes a tag on draft and published quizzes; non-author is rejected (403); adding an existing-but-differently-cased tag reuses it

## 5. Backend: Room Creation & Play Count

- [x] 5.1 Remove `GET /quizzes/available` and `listAvailableQuizzes` (server/src/quiz-builder/gameplay.ts, routes.ts) — confirm no other caller via grep before deleting
- [x] 5.2 In `resolveQuizForRoom`, after successfully resolving a published quiz, increment `quizzes.play_count` by 1 for that quiz id, inside the existing try/catch so a failed increment falls through to the existing behavior rather than blocking room creation
- [x] 5.3 Add/extend tests: creating a room with a selected published quiz increments its play_count by exactly 1; joining additional players after room creation does not increment it further; mock-quiz and random-fallback room creation never increments any play_count

## 6. Frontend: Shared PixelCard Component

- [x] 6.1 Create `client/src/app/shared/pixel-ui/pixel-card/` (title, author, question count, tag pills, play-count indicator inputs; a "select" output), pixel-art styled consistent with `PixelPanel`/`PixelButton`

## 7. Frontend: Quiz Library Page

- [x] 7.1 Create `client/src/app/quiz-library/` component: card grid rendering `PixelCard`s from `GET /quizzes/published`
- [x] 7.2 Add search bar (debounced) wired to the `search` param
- [x] 7.3 Add tag filter chips row sourced from `GET /tags`, multi-select, wired to the `tags` param
- [x] 7.4 Add sort control (Popular / Newest) wired to the `sort` param
- [x] 7.5 Add basic page/limit pagination controls (prev/next, no infinite scroll)
- [x] 7.6 Add the new unguarded route `/library` to `client/src/app/app.routes.ts`

## 8. Frontend: Room Creation via Library

- [x] 8.1 Create a small root-provided `RoomCreationState`/service holding the pending display name and exposing a method the library page calls on card selection to create the room and navigate back
- [x] 8.2 Update `client/src/app/lobby/lobby.ts`/`.html`: remove the quiz `<select>` and `availableQuizzes`/`selectedQuizId` signals; "Crear sala" now stores the display name and navigates to `/library`
- [x] 8.3 Wire the library page's card selection to call the room-creation method and navigate back to the room/lobby view once created
- [x] 8.4 Remove `listAvailable`/`AvailableQuiz` from `client/src/app/quiz-builder/quiz-builder.service.ts`; add `quiz-library` service methods for `listPublished`/`listTags`

## 9. Frontend: Tag Input in Quiz Builder

- [x] 9.1 Add a plain tag input (comma/enter to add) to `client/src/app/quiz-builder/quiz-editor/`, listing currently attached tags with a remove control per tag
- [x] 9.2 Wire add/remove to the new `POST /quizzes/:id/tags` / `DELETE /quizzes/:id/tags/:tagId` endpoints via the quiz-builder service
- [x] 9.3 Confirm tags on an AI-generated draft (Phase 4) are editable through this same UI with no separate code path

## 10. Verification

- [x] 10.1 Manually test end-to-end: browse the library unauthenticated, search, filter by tag, sort by popular/newest, paginate
- [x] 10.2 Manually test: "Crear sala" -> library -> pick a card -> room created with that quiz; play count increments once per room, not per joining player
- [x] 10.3 Manually test: add/remove tags on a manual quiz and on an AI-generated quiz from the builder screen; confirm case-insensitive dedup (adding "Math" when "math" exists doesn't create a duplicate)
- [x] 10.4 Run server and client test suites and confirm both apps build
