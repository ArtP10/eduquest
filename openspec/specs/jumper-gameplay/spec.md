# jumper-gameplay

## Purpose

Defines the per-player Phaser jumper minigame: upward climbing movement, the no-elimination starting floor, and the boost/slowdown movement modifiers driven by quiz answers.

## Requirements

### Requirement: Upward Climbing Movement
The system SHALL render a Phaser 3 jumper character per player that climbs upward on platforms during the `climbing` phase, using client-side physics local to that player's own view.

#### Scenario: Player climbs during the climbing phase
- **WHEN** a room is in `climbing` phase
- **THEN** each client renders and simulates its own player's jumper moving upward across platforms independently of other players' positions

### Requirement: Starting Floor With No Elimination
The system SHALL provide a starting floor that a player's jumper can fall back to, and SHALL NOT remove a player from the match or end their run as a result of falling.

#### Scenario: Player falls back to the floor
- **WHEN** a player's jumper misses platforms and falls
- **THEN** the jumper comes to rest at the starting floor without being eliminated, and the player continues participating in the match, losing only height/progress

### Requirement: Boost and Slowdown Modifiers
The system SHALL apply a movement modifier to a player's jumper based on that player's locked answer to the most recently resolved question, and SHALL reset the modifier at the start of the next question's climbing phase.

#### Scenario: Correct answer grants a boost
- **WHEN** the `results` phase reveals that a player answered the current question correctly
- **THEN** that player's jumper receives a boost (higher jump arc and faster movement) for the following `climbing` phase

#### Scenario: Wrong or missing answer applies a slowdown
- **WHEN** the `results` phase reveals that a player answered the current question incorrectly or did not answer
- **THEN** that player's jumper receives a slowdown (reduced speed and lower jumps) for the following `climbing` phase

#### Scenario: Modifier resets after one question interval
- **WHEN** a new question's `climbing` phase begins
- **THEN** the previous question's boost or slowdown modifier no longer applies, and the player's movement returns to baseline until a new modifier is applied from the next `results` phase
