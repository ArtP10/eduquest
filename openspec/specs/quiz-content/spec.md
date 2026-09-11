# quiz-content

## Purpose

Defines the sample quiz data, its assignment to rooms, and server-side concealment of correct answers until results.
## Requirements
### Requirement: Sample Quizzes
The system SHALL provide at least one, and up to two, sample quizzes stored in Postgres and flagged `is_sample`, each containing multiple-choice questions with four answer choices, one correct answer, and a per-question time limit.

#### Scenario: A quiz question has exactly one correct answer among four choices
- **WHEN** a sample quiz question is loaded
- **THEN** it has exactly four answer choices and exactly one of them is marked correct

### Requirement: Quiz Assignment to Room
The system SHALL assign a quiz to a room when the room is created: the client MUST select a quiz id, either a sample quiz (`is_sample`) or a published quiz sourced from the Quiz Library, both resolved from Postgres. The assigned quiz's question order and each question's choice order SHALL be independently randomized for that room, without changing which choice is correct. When a published library quiz is assigned to a room, the system SHALL increment that quiz's play count by exactly 1 for that room, regardless of how many players subsequently join.

#### Scenario: Room creation requires a selected quiz
- **WHEN** a client creates a new room without specifying a quiz id
- **THEN** the server rejects room creation with an error, without creating a room

#### Scenario: Room is created with a selected sample quiz
- **WHEN** a client creates a new room specifying the id of a sample quiz
- **THEN** the server assigns that sample quiz to the room, and no published quiz's play count changes

#### Scenario: Room is created with a selected published quiz
- **WHEN** a client creates a new room specifying the id of a quiz that is in `published` status
- **THEN** the server assigns that quiz to the room, converted to the same shape (question text, four choices, correct choice, fixed per-question time limit) as a sample quiz, and increments that quiz's play count by 1

#### Scenario: Room creation fails for an unresolvable quiz selection
- **WHEN** a client creates a new room specifying a quiz id that does not resolve to a sample quiz or a `published` quiz
- **THEN** the server rejects room creation with an error, without creating a room

#### Scenario: Play count increments once per room regardless of player count
- **WHEN** a room is created with a selected published quiz and multiple players subsequently join that room
- **THEN** that quiz's play count increases by exactly 1 for the room's creation, not once per joining player

#### Scenario: Room creation fails when the database is unreachable
- **WHEN** a client creates a new room while Postgres is unreachable
- **THEN** the server rejects room creation with an error, without creating a room

#### Scenario: Question order is shuffled per room
- **WHEN** a room is created and assigned a quiz with more than one question
- **THEN** the order questions are presented in that room is independently randomized, not the quiz's authored order

#### Scenario: Choice order is shuffled per room without changing the correct answer
- **WHEN** a room is created and assigned a quiz
- **THEN** each question's four choices are presented in a randomized order for that room, and the choice revealed as correct at `results` still matches the quiz's originally authored correct answer

### Requirement: Server-Side Answer Concealment
The system SHALL send clients only the question text and answer choices during the `frozen` phase, and SHALL NOT reveal which choice is correct until the `results` phase for that question.

#### Scenario: Question payload omits the correct answer
- **WHEN** the server emits the question for a `frozen` phase
- **THEN** the payload includes the question text and choices but does not indicate which choice is correct

#### Scenario: Correct answer is revealed at results
- **WHEN** the room transitions to the `results` phase for a question
- **THEN** the server emits the correct answer to all clients in the room

