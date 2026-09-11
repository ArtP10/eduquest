## Context

Phase 3 (`quiz-builder`, not yet archived but fully implemented at `server/src/quiz-builder/` and `client/src/app/quiz-builder/`) gives every logged-in user CRUD over `quizzes`/`questions` (Postgres), owner-scoped via `requireAuth` + `requireQuizOwnership`/`requireQuestionOwnership`, with `createQuiz`/`createQuestion` inserting rows shaped exactly like `QuizRecord`/`QuestionRecord`. This change adds a second way to populate that same schema — generation from a PDF via Gemini — instead of a parallel data model or a bespoke review UI. The user's own prior prototype (Python) proved the approach (extract text locally, send only text to the model, never the PDF) but this change is a from-scratch Node implementation, not a port with a subprocess.

Constraints carried over from `quiz-builder`'s design: no gameplay/scoring changes, reuse of the pixel-ui kit, Spanish-language UI strings (see `my-quizzes.html`), and the "DB outage never blocks core flows" posture is not applicable here since this route requires the DB to create records anyway.

## Goals / Non-Goals

**Goals:**
- Turn a text-layer PDF + a question count into a `draft` quiz with generated questions, using the exact `createQuiz`/`createQuestion` functions the manual builder uses.
- Keep the Gemini API key and all AI-call logic server-side; the client never talks to Gemini directly.
- Make the generation entry point feel native to the existing My Quizzes / builder flow, not a separate product surface.
- Make the reasoning/"thinking" effort level a runtime config value, not a hardcoded constant.

**Non-Goals:**
- OCR or image-based PDF support (text-layer only, per proposal).
- Any new database table, column, or flag distinguishing AI-generated quizzes from manual ones.
- Multi-provider AI abstraction — this is a direct Gemini integration.
- Progress streaming (e.g., "question 6 of 20"); a single loading state suffices.
- Editing/regenerating a single question as part of this change (already covered by existing builder edit/delete).

## Decisions

### 1. New module `server/src/quiz-generation/`, not inside `quiz-builder/`
Generation is a distinct concern (upload handling, PDF parsing, external API call, retry policy) from CRUD/ownership. Keeping it in its own module avoids bloating `quiz-builder/routes.ts` and keeps the AI dependency import graph isolated — `quiz-builder/*` continues to have zero knowledge that generation exists. The generation route calls into `quiz-builder`'s `createQuiz`/`createQuestion` (imported, not duplicated) to write records.

**Alternative considered**: add a `generate` handler inside `quiz-builder/routes.ts`. Rejected — would pull `multer`/PDF/Gemini dependencies into the module every quiz CRUD request touches, and mixes ownership-scoped CRUD concerns with a one-shot generation pipeline.

### 2. `multer` (memory storage) for the multipart upload
The PDF is small (a document, not a video) and is only read once to extract text — memory storage avoids managing a temp-file lifecycle. `multer` is the de facto standard for Express multipart handling and pairs directly with `express` already in use.

**Alternative considered**: `busboy` directly. Rejected — more boilerplate for the same outcome; `multer` is sufficient given no streaming/chunking requirement.

### 3. `pdf-parse` for text extraction
Simple, synchronous-feeling API (`pdf-parse(buffer) -> { text }`) that's sufficient for text-layer PDFs, which is the only supported case. `pdfjs-dist` is more capable (needed for OCR/rendering) but that capability is explicitly out of scope, so the simpler library wins.

**Alternative considered**: `pdfjs-dist`. Rejected for this change — more setup (worker config) for capability we don't need yet; can be swapped later if OCR support is added, since extraction is isolated behind a single function (`extractPdfText`).

### 4. `@google/genai` SDK, direct call, no queue/job system
Generation is a single request/response cycle (no streaming progress requirement), so a synchronous HTTP handler that awaits the Gemini call is sufficient. A job queue would add operational complexity (worker process, job storage) for no user-visible benefit given the explicit non-goal of incremental progress.

**Alternative considered**: background job + polling endpoint. Rejected as over-engineering for a single bounded call with a generous timeout; revisit only if real-world latency/timeout data says otherwise.

### 5. Structured output via Gemini's response schema, not prompt-engineered JSON
Passing a JSON response schema (matching `{ question_text: string, choices: [string,string,string,string], correct_choice: 0|1|2|3 }` per item) to the API is more reliable than asking the model to "return JSON" in the prompt and parsing/guarding against malformed output. Reduces retry churn on parse failures.

### 6. Thinking level as env/config value, defaulting to `low`
`GEMINI_THINKING_LEVEL` (env var, default `low`) is read once at call time and passed into the generation request config. This is bounded structured extraction (map text → fixed-shape questions), not multi-step reasoning, so `low` is the right default cost/quality tradeoff; bumping to `medium` later requires only a config change, per the proposal's explicit requirement.

### 7. Retry: exponential backoff, same model only, bounded attempts
On a retryable error (rate limit, timeout, 5xx-class from the SDK), retry the identical request against `gemini-3.8-flash` with exponential backoff up to a fixed attempt budget (e.g. 3 attempts). No fallback to a different/cheaper model — the proposal is explicit that quality/consistency matters more than availability here, and a silent model swap would make output quality unpredictable.

### 8. Transactional-ish create-then-rollback, not a DB transaction wrapping the AI call
The Gemini call happens *before* any DB write (quiz is created only once generated questions are in hand), so the common failure path (AI error) already creates nothing. The only rollback needed is for the narrow window between `createQuiz` and finishing question inserts — if any `createQuestion` call fails there, the handler deletes the just-created quiz row before returning the error. A full DB transaction is unnecessary complexity since the AI call (the slow, failure-prone part) is deliberately kept outside any transaction.

**Alternative considered**: wrap quiz+question creation in a single SQL transaction. This is actually simpler and slightly more robust (atomic, no manual rollback code) — adopted as the implementation approach: open a transaction after the AI response is in hand, insert the quiz and all questions, commit; on any insert failure, the transaction rolls back automatically. This supersedes manual delete-on-failure.

### 9. Client: new route/component `generate-quiz`, reusing the existing quiz editor route for review
The upload form is its own routed component (`/quizzes/generate`) so it can own its own loading/error state cleanly. On success it navigates to the existing quiz editor route (`/quizzes/:id`) already built by `quiz-builder` — no new "review" UI is built, satisfying the proposal's core UX requirement.

## Risks / Trade-offs

- **[Risk]** Gemini latency (several seconds to tens of seconds for larger question counts) could exceed a naive HTTP timeout. → Mitigation: explicit generous request timeout on the Gemini call (configurable), and the client shows a loading state for the whole duration rather than a fixed spinner guess.
- **[Risk]** Malformed/partial structured output despite the schema (e.g., fewer questions than requested). → Mitigation: validate the shape and count of the parsed response server-side using the same `validateQuestionInput`-equivalent rules before writing anything; treat a mismatch as a failure (fail clean, no partial quiz), not a partial success.
- **[Risk]** Large PDF uploads could exhaust memory (memory-storage multer) or produce excessively long extracted text (token cost). → Mitigation: cap upload file size at the multer layer and cap/truncate extracted text length before sending to Gemini, rejecting with a clear error if the source document is too large.
- **[Risk]** Gemini API key leakage. → Mitigation: key lives only in server env config, read via the existing `server/src/config.ts` pattern; never included in any response payload or client bundle.
- **[Trade-off]** No background job/progress reporting means the HTTP request stays open for the full generation duration, tying up a server connection. Acceptable given expected low concurrent generation volume for this phase; revisit if usage grows.

## Migration Plan

- Additive only: new route, new module, new client route/component, new env vars (`GEMINI_API_KEY`, `GEMINI_THINKING_LEVEL`). No schema migration.
- No changes to existing endpoints, so no rollback coordination needed — reverting is deleting the new route/module/component and the "Generate from PDF" entry point.

## Open Questions

- Exact request/file-size ceiling for uploaded PDFs and max extracted-text length sent to Gemini — to be set to a concrete number during implementation (task-level detail, not a spec-level requirement).
- Exact retry attempt count/backoff timings — implementation detail within the "exponential backoff, same model" requirement.
