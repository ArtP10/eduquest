## ADDED Requirements

### Requirement: Hardcoded Sample Quizzes
The system SHALL provide at least one, and up to two, sample quizzes defined as static data loaded by the server at startup, each containing multiple-choice questions with four answer choices, one correct answer, and a per-question time limit.

#### Scenario: Server loads sample quizzes at startup
- **WHEN** the server starts
- **THEN** it loads the sample quiz data into memory and makes it available for assignment to rooms

#### Scenario: A quiz question has exactly one correct answer among four choices
- **WHEN** a sample quiz question is loaded
- **THEN** it has exactly four answer choices and exactly one of them is marked correct

### Requirement: Quiz Assignment to Room
The system SHALL assign one of the available sample quizzes to a room when the room is created, so that the match can start once the host initiates it.

#### Scenario: Room is created with a quiz assigned
- **WHEN** a client creates a new room
- **THEN** the server assigns one of the available sample quizzes to that room

### Requirement: Server-Side Answer Concealment
The system SHALL send clients only the question text and answer choices during the `frozen` phase, and SHALL NOT reveal which choice is correct until the `results` phase for that question.

#### Scenario: Question payload omits the correct answer
- **WHEN** the server emits the question for a `frozen` phase
- **THEN** the payload includes the question text and choices but does not indicate which choice is correct

#### Scenario: Correct answer is revealed at results
- **WHEN** the room transitions to the `results` phase for a question
- **THEN** the server emits the correct answer to all clients in the room