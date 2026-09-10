## 1. Dependencies & Config

- [x] 1.1 Add `multer`, `pdf-parse`, and `@google/genai` (plus `@types/multer`) to `server/package.json`
- [x] 1.2 Add `GEMINI_API_KEY` and `GEMINI_THINKING_LEVEL` (default `low`) to server config (`server/src/config.ts`) and `.env.example`
- [x] 1.3 Add an upload file-size limit and a max-extracted-text-length constant to config

## 2. PDF Extraction

- [x] 2.1 Create `server/src/quiz-generation/pdf.ts` with `extractPdfText(buffer): Promise<string>` using `pdf-parse`
- [x] 2.2 Add a check for empty/too-short extracted text, truncating text longer than the configured max length
- [x] 2.3 Add unit tests for `extractPdfText`: valid text-layer PDF, empty PDF, corrupt/non-PDF buffer

## 3. Question Count & Request Validation

- [x] 3.1 Create `server/src/quiz-generation/validation.ts` with a function validating question count is an integer multiple of 5 between 5 and 50 inclusive
- [x] 3.2 Add unit tests covering valid counts, non-multiples-of-5, and out-of-range counts

## 4. Gemini Client

- [x] 4.1 Create `server/src/quiz-generation/gemini-client.ts` wrapping `@google/genai`: builds the request with the structured response schema (`question_text`, 4 `choices`, `correct_choice`), model `gemini-3.8-flash`, configurable thinking level, and a request timeout
- [x] 4.2 Implement exponential-backoff retry on transient/retryable errors (rate limit, timeout) against the same model, with a bounded attempt count
- [x] 4.3 Implement response parsing/validation: correct question count, four non-empty choices, correct_choice in range 0-3 for every item; treat any mismatch as a failure
- [x] 4.4 Add unit tests using a mocked SDK client: success path, retry-then-success, retries-exhausted failure, malformed-response failure

## 5. Generation Route & Persistence

- [x] 5.1 Create `server/src/quiz-generation/routes.ts` with `POST /quizzes/generate` behind `requireAuth`, using `multer` (memory storage, size limit) for the PDF upload field and question count in the body
- [x] 5.2 Wire validation (question count, extracted text) before any Gemini call, returning clear 400 errors
- [x] 5.3 On successful generation, open a DB transaction that creates the quiz (`draft`, `author_id`) and all question rows via `quiz-builder`'s `createQuiz`/`createQuestion` (or transaction-scoped equivalents), committing only if all inserts succeed
- [x] 5.4 On any failure after the Gemini call (insert failure), roll back so no partial quiz/question rows remain; return a clear error
- [x] 5.5 Mount the new router in `server/src/index.ts` alongside the existing `quizBuilderRouter`
- [x] 5.6 Add integration tests: happy path (mocked Gemini) creates one quiz + N questions; invalid count rejected with no DB writes; empty-text PDF rejected with no DB writes; Gemini failure rejected with no DB writes; unauthenticated request rejected

## 6. Client: Generate-from-PDF Entry Point

- [x] 6.1 Add a "Generar desde PDF" option next to "Crear cuestionario" on `client/src/app/quiz-builder/my-quizzes/`, routing to a new generate screen
- [x] 6.2 Create `client/src/app/quiz-builder/generate-quiz/` component: PDF file picker + question-count control (5–50, step 5) built from `PixelButton`/`PixelInput`/`PixelPanel`
- [x] 6.3 Add a method to `quiz-builder.service.ts` (or a new `quiz-generation.service.ts`) posting multipart form data to `POST /quizzes/generate`
- [x] 6.4 Add the new route to `client/src/app/app.routes.ts`, protected by the existing `authGuard`

## 7. Client: Loading & Error States

- [x] 7.1 Implement a pixel-art-styled loading state shown for the duration of the generation request (no blank screen/unstyled spinner)
- [x] 7.2 Implement a pixel-art-styled error state with a clear message and a way to retry, ensuring no partial/broken quiz is shown anywhere in the UI on failure
- [x] 7.3 On success, navigate to the existing quiz editor route (`/quizzes/:id`) with the newly created draft's id

## 8. Verification

- [ ] 8.1 Manually test end-to-end: upload a real text-layer PDF, generate 5/20/50 questions, confirm the resulting draft opens correctly in the existing quiz editor and can be edited/published unmodified
- [ ] 8.2 Manually test failure paths in the browser: invalid question count, non-PDF file, empty-text PDF, simulated Gemini failure — confirm no stray quiz appears in My Quizzes
- [x] 8.3 Run server and client test suites
