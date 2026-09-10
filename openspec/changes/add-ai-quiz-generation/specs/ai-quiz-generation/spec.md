## ADDED Requirements

### Requirement: Question Count Validation
The system SHALL accept a requested question count only if it is a multiple of 5 between 5 and 50 inclusive, and SHALL reject any other value with a clear error before performing any PDF processing or AI call.

#### Scenario: Valid question count
- **WHEN** an authenticated user submits a generation request with question count 20
- **THEN** the system proceeds to PDF extraction

#### Scenario: Question count not a multiple of 5
- **WHEN** an authenticated user submits a generation request with question count 12
- **THEN** the system rejects the request with a clear validation error and performs no PDF extraction or AI call

#### Scenario: Question count out of range
- **WHEN** an authenticated user submits a generation request with question count 55 or with question count 0
- **THEN** the system rejects the request with a clear validation error

### Requirement: Local PDF Text Extraction
The system SHALL extract plain text from the uploaded PDF locally on the server and SHALL NOT transmit the raw PDF file to any external AI API.

#### Scenario: Text-layer PDF is extracted locally
- **WHEN** an authenticated user uploads a PDF containing a text layer
- **THEN** the system extracts its text content in the Node process before any external API call is made

#### Scenario: Extracted text is empty or too short
- **WHEN** the extracted text is empty or too short to plausibly generate meaningful questions from
- **THEN** the system rejects the request with a clear error and makes no call to the AI API

### Requirement: Authenticated Access Only
The system SHALL require a valid authenticated session to generate a quiz from a PDF.

#### Scenario: Unauthenticated request is rejected
- **WHEN** a request to generate a quiz from a PDF is made without valid authentication
- **THEN** the system rejects the request and performs no PDF processing, AI call, or data creation

### Requirement: Gemini-Backed Question Generation
The system SHALL generate the requested number of questions by sending only the extracted plain text (never the raw PDF) to the Gemini API using a structured response schema that yields, for each question, question text, exactly four answer choices, and exactly one correct choice, using a configurable reasoning/thinking level.

#### Scenario: Structured questions are produced from extracted text
- **WHEN** the AI call succeeds for a request of 15 questions
- **THEN** the system receives 15 questions each with question text, four choices, and one correct choice

#### Scenario: Thinking level is configurable without a code change
- **WHEN** the server's generation thinking-level configuration value is changed
- **THEN** subsequent generation requests use the newly configured thinking level without requiring a code change

### Requirement: Retry on Transient AI Errors
The system SHALL retry a transient or rate-limit error from the Gemini API against the same model using exponential backoff, and SHALL NOT fall back to a different model.

#### Scenario: Rate limit is retried and eventually succeeds
- **WHEN** the Gemini API returns a rate-limit error on the first attempt and succeeds on a retry
- **THEN** the system returns the successfully generated questions to the caller without having called any other model

#### Scenario: Retries are exhausted
- **WHEN** the Gemini API continues to return transient errors past the configured retry budget
- **THEN** the system fails the generation request with a clear error and creates no quiz or question records

### Requirement: Draft Quiz Created in Existing Schema
On successful generation, the system SHALL create a new quiz with status `draft` owned by the requesting user and its generated questions, using the same quiz/question records and shape produced by the manual quiz builder, with no distinct data path or additional fields marking a quiz as AI-generated.

#### Scenario: Successful generation produces a builder-compatible draft
- **WHEN** generation succeeds for an authenticated user
- **THEN** the system creates one new quiz row with status `draft` and `author_id` set to that user, plus one question row per generated question, indistinguishable in shape from quizzes/questions created through the manual builder

### Requirement: No Partial State on Failure
The system SHALL leave no partial or broken quiz or question records when generation fails for any reason, including invalid input, extraction failure, or an AI API error.

#### Scenario: Failure after quiz creation rolls back
- **WHEN** a quiz row has already been created for a request and question generation or insertion subsequently fails
- **THEN** the system removes the created quiz row so no partial quiz is left behind, and returns a clear error

#### Scenario: Validation failure creates nothing
- **WHEN** a generation request fails validation (question count or extracted text)
- **THEN** the system creates no quiz or question records
