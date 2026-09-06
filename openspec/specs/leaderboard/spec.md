# leaderboard

## Purpose

Defines server-authoritative scoring (base correctness points, speed bonus, final placement bonus) and the live leaderboard broadcast to clients.

## Requirements

### Requirement: Server-Authoritative Scoring
The system SHALL compute every player's score on the server from that player's locked answers and final climb progress, and SHALL NOT accept client-reported scores.

#### Scenario: Correct answer awards base points
- **WHEN** a player's locked answer for a question is correct
- **THEN** the server adds a base point value to that player's score

#### Scenario: Wrong or missing answer awards no correctness points
- **WHEN** a player's locked answer for a question is incorrect or absent
- **THEN** the server adds zero correctness points for that question to that player's score

### Requirement: Speed Bonus
The system SHALL award a speed bonus, scaled by the remaining time on the question's countdown at the moment of a correct locked answer, in addition to the base correctness points.

#### Scenario: Fast correct answer earns a larger bonus
- **WHEN** a player answers a question correctly with more time remaining on the countdown
- **THEN** the server awards a proportionally larger speed bonus than it would for a correct answer submitted later in the countdown

#### Scenario: Wrong answer earns no speed bonus
- **WHEN** a player's locked answer for a question is incorrect
- **THEN** the server awards zero speed bonus for that question

### Requirement: Final Placement Bonus
The system SHALL, at the end of a match, rank players by final height/progress and award a descending placement bonus to each player based on that rank.

#### Scenario: Players are ranked and awarded placement points at match end
- **WHEN** a room transitions to `ended`
- **THEN** the server ranks all players by final climb height/progress, awards the highest placement bonus to first place, and progressively smaller bonuses down the ranking, and adds each player's placement bonus to their total score

### Requirement: Live Leaderboard Broadcast
The system SHALL broadcast the current ranked leaderboard (player, score, rank) to all clients in a room after every question's results are resolved and again at match end.

#### Scenario: Leaderboard updates after each question
- **WHEN** the server finishes computing scores for a resolved question
- **THEN** it broadcasts the updated ranked leaderboard to every client in the room

#### Scenario: Leaderboard reflects final placement bonus at match end
- **WHEN** the server finishes computing final placement bonuses at match end
- **THEN** it broadcasts the final ranked leaderboard, including placement bonuses, to every client in the room
