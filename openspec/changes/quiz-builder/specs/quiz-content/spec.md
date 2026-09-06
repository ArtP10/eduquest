## MODIFIED Requirements

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
