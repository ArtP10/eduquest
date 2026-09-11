## ADDED Requirements

### Requirement: Quiz Global Stats
The system SHALL provide an endpoint that returns a quiz's aggregate performance across all matches it has ever been played in: the overall percentage of answers that were correct, and that same value presented as a 0-100 average grade. The system SHALL return an empty result, not an error, for a quiz that has never been played.

#### Scenario: Client requests stats for a quiz with match history
- **WHEN** a client requests global stats for a quiz that has been played in at least one match
- **THEN** the server returns the overall percentage of correct answers across every match of that quiz and the same value expressed as a 0-100 grade

#### Scenario: Client requests stats for a quiz never played
- **WHEN** a client requests global stats for a quiz with no recorded matches
- **THEN** the server returns an empty result indicating no stats are available, not an error
