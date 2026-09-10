# quiz-builder

## Purpose

Defines the quiz builder capability: authenticated users creating, editing, and publishing their own multiple-choice quizzes for use in rooms.

## Requirements

### Requirement: Quiz Creation
The system SHALL allow any authenticated user to create a new quiz, owned by that user, starting in `draft` status.

#### Scenario: Authenticated user creates a quiz
- **WHEN** an authenticated client submits a request to create a quiz with a title
- **THEN** the server creates a new quiz record with `status` set to `draft`, `author_id` set to the requesting user, and returns the created quiz

#### Scenario: Unauthenticated client attempts to create a quiz
- **WHEN** a client with no valid JWT access token submits a request to create a quiz
- **THEN** the server rejects the request as unauthenticated and creates no quiz

### Requirement: Author's Own Quiz List
The system SHALL provide an endpoint that returns only the requesting user's own quizzes, in both `draft` and `published` status.

#### Scenario: Author lists their quizzes
- **WHEN** an authenticated client requests their own quiz list
- **THEN** the server returns every quiz whose `author_id` matches that user, regardless of status, and no quiz belonging to any other author

### Requirement: Quiz Retrieval Visibility
The system SHALL allow a quiz's author to fetch that quiz (with its questions) regardless of status, and SHALL allow any client to fetch a quiz only if its status is `published`.

#### Scenario: Author fetches their own draft
- **WHEN** the quiz's author requests that quiz by id, and it is still in `draft` status
- **THEN** the server returns the quiz and its questions

#### Scenario: Non-author attempts to fetch a draft
- **WHEN** a client that is not the quiz's author (including an unauthenticated client) requests a `draft` quiz by id
- **THEN** the server does not return the quiz's content

#### Scenario: Any client fetches a published quiz
- **WHEN** any client, authenticated or not, requests a quiz by id that is in `published` status
- **THEN** the server returns the quiz and its questions

### Requirement: Quiz Ownership Enforcement
The system SHALL allow only a quiz's author to update that quiz's title or status, or to add, edit, or remove its questions, and SHALL reject any such attempt by another user.

#### Scenario: Author updates their own quiz
- **WHEN** the quiz's author submits a title or status change for that quiz
- **THEN** the server applies the change

#### Scenario: Non-author attempts to modify a quiz
- **WHEN** an authenticated client that is not the quiz's author attempts to update its title, status, or questions
- **THEN** the server rejects the request and applies no change

### Requirement: Draft-to-Published Transition
The system SHALL allow a quiz's author to change that quiz's status from `draft` to `published`.

#### Scenario: Author publishes a draft quiz
- **WHEN** the quiz's author submits a status change to `published` for a quiz currently in `draft` status
- **THEN** the server updates the quiz's status to `published`

### Requirement: Question Content Validation
The system SHALL require that a question submitted to a quiz has non-empty question text, exactly four answer choices, and exactly one designated correct choice among them.

#### Scenario: Valid question is accepted
- **WHEN** a quiz's author submits a question with non-empty text, exactly four choices, and one of them marked correct
- **THEN** the server adds the question to the quiz

#### Scenario: Question missing text is rejected
- **WHEN** a quiz's author submits a question with empty or missing question text
- **THEN** the server rejects the submission and returns an error indicating the question text is required

#### Scenario: Question without exactly four choices is rejected
- **WHEN** a quiz's author submits a question with fewer or more than four choices
- **THEN** the server rejects the submission and returns an error indicating exactly four choices are required

#### Scenario: Question without exactly one correct choice is rejected
- **WHEN** a quiz's author submits a question with no correct choice designated, or with a correct-choice value outside the four submitted choices
- **THEN** the server rejects the submission and returns an error indicating exactly one correct choice is required

### Requirement: Question Editing and Removal
The system SHALL allow a quiz's author to edit or remove any question belonging to their quiz.

#### Scenario: Author edits a question
- **WHEN** the quiz's author submits changed text, choices, or correct choice for one of that quiz's questions
- **THEN** the server applies the change to that question, subject to the same content validation as creating a question

#### Scenario: Author removes a question
- **WHEN** the quiz's author requests deletion of one of that quiz's questions
- **THEN** the server removes that question from the quiz
