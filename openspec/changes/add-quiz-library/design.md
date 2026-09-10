## Context

Room creation today: Lobby (`client/src/app/lobby/lobby.ts`) loads `GET /quizzes/available` (mock quizzes + every published builder quiz, no pagination/search — `server/src/quiz-builder/gameplay.ts#listAvailableQuizzes`) into a flat `<select>`, and emits Socket.IO `room:create` with an optional `quizId` (`shared/events.ts#RoomCreateRequest`). The server resolves that id via `resolveQuizForRoom` (mock lookup, then `findQuizById` + published check, falling back to a random mock quiz on any failure — DB outages must never block room creation, an invariant established in the `quiz-builder` change's design.md decision 7 and preserved here). Room creation is a socket event, not a REST call, so wiring a card grid into it means the client has to carry a chosen quiz id from a page navigation back into `socketService.createRoom(displayName, quizId)`.

The `quiz-builder` change (not yet archived, but implemented) established `quizzes`/`questions` and their ownership model; this change adds two new tables (`tags`, `quiz_tags`) and one column (`quizzes.play_count`) without touching that schema's existing shape.

## Goals / Non-Goals

**Goals:**
- Replace the flat dropdown with a public, searchable/filterable/sortable card grid, without requiring login to browse.
- Keep room creation's DB-outage tolerance: the library page itself may show an error if Postgres is down, but resolving an already-chosen quiz id into a room must keep today's random-fallback behavior.
- Track play count per quiz, incremented exactly once per room (not per player), attributable directly to `resolveQuizForRoom`'s existing single call site.
- Case-insensitive tag dedup enforced at write time, so the tag catalog doesn't accumulate near-duplicates from casing alone.

**Non-Goals:**
- Recommendations, tag moderation/merging beyond casing, "match all" tag filtering, cursor pagination, trending/decay scoring — all explicitly deferred per the proposal.
- Any change to how mock quizzes are chosen or stored — they stay outside Postgres and outside the library.
- Any change to the AI generation pipeline itself — it produces quizzes exactly as before; tags are added afterward through the same builder UI a manual quiz would use.

## Decisions

### 1. New module `server/src/quiz-library/`, not folded into `quiz-builder/`
Search/filter/sort/pagination and the tag catalog are read-heavy, publicly-accessible concerns distinct from owner-scoped CRUD. A new module keeps `GET /quizzes/published` and `GET /tags` free of `requireAuth`/ownership middleware entirely, and keeps `quiz-builder/routes.ts` from growing query-building logic it doesn't otherwise need. `quiz-builder` still owns the tag *write* path (attach/detach on a specific owned quiz) since that's ownership-scoped; `quiz-library` owns the shared lowercase-dedup helper both the write path and, indirectly, the tag catalog rely on — implemented once in `quiz-library/tags.ts` and imported by `quiz-builder`'s tag-attach handler, avoiding duplicated dedup logic in two modules.

**Alternative considered**: put everything in `quiz-builder/`. Rejected — mixes an owner-scoped, auth-required module with public, unauthenticated read endpoints, muddying the ownership-middleware story the existing module already has (see `ownership.ts`).

### 2. Schema: `tags(id, name unique)`, `quiz_tags(quiz_id, tag_id)` composite PK, `quizzes.play_count integer default 0`
Standard many-to-many. `tags.name` gets a unique index (case sensitivity doesn't matter here since every write path lowercases before insert/lookup — see decision 3), plus the b-tree index on `tags.name` and `quizzes.title` requested for search. `play_count` is a plain column on `quizzes`, not a separate stats table — a single UPDATE ... SET play_count = play_count + 1 on room creation is simpler than a derived count and matches this schema's existing minimalism (e.g. `order_index` is a plain column on `questions`, not computed).

**Alternative considered**: a separate `quiz_plays` log table (one row per room) for future analytics. Rejected as premature — proposal explicitly excludes trending/decay, so there's no current consumer of per-play granularity; a raw counter is enough and is trivially migrated to a log table later if needed.

### 3. Tag dedup: lowercase+trim in application code before every INSERT/lookup, backed by a unique index as a safety net
The write path (`quiz-library/tags.ts#findOrCreateTag`) always normalizes (`trim().toLowerCase()`) before querying `WHERE name = $1` and inserting on miss. The unique index on `tags.name` is a backstop against a race (two concurrent first-uses of the same new tag), handled with `ON CONFLICT (name) DO NOTHING RETURNING *` followed by a `SELECT` on conflict — not relied upon as the sole dedup mechanism, since a bare unique constraint alone wouldn't stop "Math" and "math" from being treated as different strings pre-normalization.

### 4. `GET /quizzes/published`: keyset-free offset pagination, `ILIKE` search, `tags && $1` any-match, `ORDER BY` switch on `sort`
Given the proposal's explicit non-goal of anything beyond basic page/limit, plain `LIMIT`/`OFFSET` is used. Search is a case-insensitive `title ILIKE '%term%'` (the `quizzes.title` index defined in decision 2 is a plain b-tree, which `ILIKE '%term%'` cannot use for a leading wildcard — acceptable for this phase's scale; a `pg_trgm` index is the natural upgrade path if search performance becomes a real problem, not needed now). Tag match-any is a join against `quiz_tags`/`tags` filtered with `tag.name = ANY($1::text[])` and `DISTINCT` on quiz id to avoid duplicate rows from multi-tag matches. Sort is `play_count DESC` for `popular`, `created_at DESC` for `newest` (default) — a small `switch` on the validated `sort` param, never string-interpolated into SQL.

### 5. Play-count increment lives inside `resolveQuizForRoom`, at the point a published quiz is actually resolved
`resolveQuizForRoom` (`server/src/quiz-builder/gameplay.ts`) is already the single choke point where a client-supplied `quizId` becomes an actual assigned quiz, and it already distinguishes "resolved to a published quiz" from "fell back to random." The increment (`UPDATE quizzes SET play_count = play_count + 1 WHERE id = $1`) is added right after that resolution succeeds, inside the same try/catch that already treats DB errors as non-fatal (falls through to a random quiz) — so a failed increment never blocks room creation, consistent with the existing DB-outage-tolerance invariant. It does not fire for mock-quiz or fallback-random resolutions, matching the proposal's "increment on room creation" (using *that* quiz) requirement.

**Alternative considered**: incrementing from the Socket.IO `room:create` handler in `index.ts` after `resolveQuizForRoom` returns. Rejected — the handler only has the final `Quiz` (engine shape), which no longer carries whether it came from a published DB row, a mock quiz, or a random fallback; keeping the increment inside `resolveQuizForRoom` keeps that distinction where it's already known.

### 6. Client: quiz id + display name carried into the library via a small injectable state service, not query params
Room creation's `displayName` currently lives as a Lobby-local signal. Routing "Crear sala" into `/library` needs that name to survive the navigation and come back out once a card is picked. A minimal injectable `RoomCreationState` (root-provided, one or two signals: `pendingDisplayName`, plus a method the library page calls on card-select that performs the actual `socketService.createRoom(...)` call and navigates back to `/`) avoids URL-encoding a free-text display name and avoids introducing a heavier state-management dependency for two fields.

**Alternative considered**: pass `displayName` as a router query param (`/library?displayName=...`). Rejected — marginally simpler but pushes arbitrary user text through the URL/history for no benefit, and doesn't naturally extend to "library page triggers room creation directly" (a query param can't carry a callback).

### 7. New `PixelCard` shared component
Added to `client/src/app/shared/pixel-ui/pixel-card/`, following the exact pattern of `PixelPanel`/`PixelButton` (a `changeDetection: OnPush` component with `input()`s for the pieces a poster card needs — title, author, question count, play count, tags — and an output for "selected"), rather than a one-off `.card` class inside the library component, per the proposal's explicit instruction to extend the shared kit.

### 8. `/library` is a new top-level route, unguarded (no `authGuard`)
Unlike `/quizzes` and `/quizzes/:id` (which require auth because they're the *authoring* surface), `/library` is the *browsing* surface and must work for anonymous players per the proposal ("no login required to browse/search/play"). It's added to `app.routes.ts` alongside, not replacing, the existing routes.

## Risks / Trade-offs

- **[Risk]** `ILIKE '%term%'` search doesn't scale indefinitely (sequential scan under a leading wildcard even with a b-tree index on `title`). → Mitigation: acceptable at current/expected data volume; documented upgrade path to `pg_trgm` + a GIN index if it becomes a real bottleneck, not built now (non-goal).
- **[Risk]** Incrementing `play_count` inside `resolveQuizForRoom`'s existing try/catch means a transient DB error there silently drops a play-count increment (room creation still succeeds via fallback). → Mitigation: acceptable — play count is a popularity signal, not a billing/audit figure; correctness of room creation takes priority, matching the existing DB-outage-tolerance design.
- **[Risk]** Removing `GET /quizzes/available` is a breaking API change for any other caller of that endpoint. → Mitigation: it's only consumed by the Lobby dropdown being removed in this same change; grep confirms no other caller.
- **[Trade-off]** The injectable `RoomCreationState` couples the Lobby and Library components through shared root-provided state rather than pure routing. Acceptable — it's two signals and one method, far simpler than introducing a routing-level resolver/guard for this one flow.

## Migration Plan

- Additive schema changes (`tags`, `quiz_tags`, `quizzes.play_count` with a default, so existing rows backfill to 0 with no data migration needed) plus one breaking API removal (`GET /quizzes/available`), landing in the same deploy as the new client routes/components that stop calling it — no window where the client expects an endpoint that no longer exists.
- Rollback: drop the new tables/column and revert the client/server changes; no other code path depends on the new schema.

## Open Questions

- Exact default `limit`/max `limit` for `GET /quizzes/published` — implementation detail, not spec-level (reasonable default e.g. 20, max e.g. 50).
- Whether `PixelCard`'s play-count indicator shows a raw number or an abbreviated form (e.g. "1.2k") — a presentation detail decided during implementation, not a requirement.
