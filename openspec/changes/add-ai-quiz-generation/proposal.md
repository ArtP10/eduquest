## Why

Authoring a quiz by hand, question by question, in the Phase 3 builder is slow for anyone starting from existing material (lecture notes, a textbook chapter, a study guide). Letting a user upload a PDF and get a fully populated draft quiz — which they still review and edit through the exact same builder UI before publishing — removes that authoring bottleneck without introducing a second, parallel review flow to build and maintain.

## What Changes

- Add `POST /quizzes/generate` (auth required): accepts a PDF upload plus a requested question count (multiple of 5, 5–50 inclusive), extracts text from the PDF locally in Node, and rejects clearly if the count is invalid or the extracted text is empty/too short.
- Add server-side Gemini integration (`server/src/quiz-generation/`) that sends only extracted plain text (never the raw PDF) to `gemini-3.8-flash` with a structured JSON response schema matching the questions shape (`question_text`, 4 `choices`, `correct_choice`), with a configurable thinking level (env-driven, default `low`) and exponential-backoff retry on transient errors (no cross-model fallback).
- On success, create the quiz and its questions as ordinary `quiz-builder` records (status `draft`, `author_id` the requesting user) via the existing `createQuiz`/`createQuestion` functions — no new tables, columns, or "AI-generated" flag.
- On any failure (bad PDF, extraction failure, Gemini error), leave no partial quiz or questions behind (delete-on-failure if a quiz row was already created) and return a clear error.
- Add a "Generate from PDF" option next to "Create quiz manually" on My Quizzes: an upload form (PDF picker + question-count control, step of 5) built from the existing `PixelButton`/`PixelInput`/`PixelPanel` kit, a pixel-art-styled loading state while generation runs, and on success a direct navigation into the existing quiz builder/editor screen with the new draft loaded — reusing it unmodified for review/edit/publish.

Explicitly not changed:
- The `quizzes`/`questions` Postgres schema, the quiz builder/editor UI, or gameplay/scoring/jumper mechanics.
- OCR/scanned PDFs, single-question regeneration, non-Gemini providers, incremental progress reporting, and regenerating an already-published quiz are all out of scope for this change.

## Capabilities

### New Capabilities
- `ai-quiz-generation`: PDF upload, text extraction, validation, Gemini-backed question generation, and creation of a draft quiz/questions from the result, plus the client upload flow that hands off into the existing builder.

### Modified Capabilities
(none — this change adds a new generation path in front of the existing `quiz-builder` capability without altering its requirements; the quiz builder/editor is reused as-is)

## Impact

- **New**: `server/src/quiz-generation/` (route, PDF text extraction, Gemini client, prompt/schema, retry logic), `client/src/app/quiz-builder/generate-quiz/` (upload form + loading/error states), a Gemini API key env var (server-only).
- **New dependencies**: server — a PDF text-extraction library (e.g. `pdf-parse` or `pdfjs-dist`), a multipart upload handler (e.g. `multer`), and a Gemini SDK (e.g. `@google/genai`); client — none beyond existing Angular/pixel-ui kit.
- **Modified**: `client/src/app/quiz-builder/my-quizzes/` (adds the "Generate from PDF" entry point and routes to it), `client/src/app/app.routes.ts` (new route for the generate screen).
- **Unaffected**: `quizzes`/`questions` schema and migrations, `server/src/quiz-builder/*` CRUD logic, the quiz editor component, `server/src/match.ts`, `server/src/scoring.ts`, the Phaser jumper scene, room/lobby flow, and all existing auth endpoints.
