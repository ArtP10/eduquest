# quiz-content

## Purpose

Defines the hardcoded sample quiz data, its assignment to rooms, and server-side concealment of correct answers until results.

## Requirements

### Requirement: Hardcoded Sample Quizzes
The system SHALL provide at least one, and up to two, sample quizzes defined as static data loaded by the server at startup, each containing multiple-choice questions with four answer choices, one correct answer, and a per-question time limit.

#### Scenario: Server loads sample quizzes at startup
- **WHEN** the server starts
- **THEN** it loads the sample quiz data into memory and makes it available for assignment to rooms

#### Scenario: A quiz question has exactly one correct answer among four choices
- **WHEN** a sample quiz question is loaded
- **THEN** it has exactly four answer choices and exactly one of them is marked correct

### Requirement: Quiz Assignment to Room
The system SHALL assign a quiz to a room when the room is created: whichever quiz (a hardcoded sample quiz or a published builder quiz) the creating client selected, or a random sample quiz if no selection was made or the selected quiz could not be resolved. The assigned quiz's question order and each question's choice order SHALL be independently randomized for that room, without changing which choice is correct.

#### Scenario: Room is created with no quiz selected
- **WHEN** a client creates a new room without specifying a quiz
- **THEN** the server assigns a random sample quiz to that room, unchanged from prior behavior

#### Scenario: Room is created with a selected sample quiz
- **WHEN** a client creates a new room specifying the id of one of the hardcoded sample quizzes
- **THEN** the server assigns that sample quiz to the room

#### Scenario: Room is created with a selected published quiz
- **WHEN** a client creates a new room specifying the id of a quiz that is in `published` status
- **THEN** the server assigns that quiz to the room, converted to the same shape (question text, four choices, correct choice, fixed per-question time limit) as a sample quiz

#### Scenario: Room is created with an unresolvable quiz selection
- **WHEN** a client creates a new room specifying a quiz id that does not resolve to a sample quiz or a `published` quiz
- **THEN** the server assigns a random sample quiz to the room instead of failing room creation

#### Scenario: Available quizzes remain listable when the database is unreachable
- **WHEN** a client requests the list of quizzes available for room creation while Postgres is unreachable
- **THEN** the server returns the hardcoded sample quizzes only, omitting published quizzes, without failing the request or blocking room creation

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
