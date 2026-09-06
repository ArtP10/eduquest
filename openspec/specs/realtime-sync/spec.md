# realtime-sync

## Purpose

Defines the Socket.IO room scoping and the server-authoritative match clock that drives all clients in a room through synchronized phase transitions, question freezes, and locked answers.

## Requirements

### Requirement: Socket.IO Room Scoping
The system SHALL use Socket.IO connections scoped per game room, such that server broadcasts for a room are delivered only to clients that have joined that room.

#### Scenario: Broadcast reaches only room members
- **WHEN** the server emits an event to a specific room
- **THEN** only clients currently joined to that room receive the event, and clients in other rooms do not

### Requirement: Server-Authoritative Match Clock
The system SHALL maintain the authoritative match phase and timing for each room on the server, and SHALL drive all clients in a room through the same phase transitions at the same wall-clock moment.

#### Scenario: Match phase cycle
- **WHEN** a host starts a match
- **THEN** the room's phase transitions through `climbing` → `frozen` → `results` → `climbing`, repeating for each question in the assigned quiz, until the quiz is exhausted, at which point the room transitions to `ended`

#### Scenario: Phase change is pushed to all clients simultaneously
- **WHEN** the server advances a room's phase (e.g., from `climbing` to `frozen`)
- **THEN** the server emits a phase-change event to every client in the room at that moment, and no client independently decides to change phase on its own

### Requirement: Question Freeze Timer
The system SHALL start a countdown timer when a room enters the `frozen` phase, and SHALL end the freeze when the timer elapses or when every connected player in the room has submitted an answer, whichever happens first.

#### Scenario: Freeze ends when timer elapses
- **WHEN** a room is in `frozen` phase and the countdown reaches zero before all players have answered
- **THEN** the server ends the freeze phase and transitions to `results`, treating any player who has not answered as having answered incorrectly

#### Scenario: Freeze ends when all players have answered
- **WHEN** every connected player in a room has submitted an answer for the current question before the countdown elapses
- **THEN** the server ends the freeze phase immediately and transitions to `results`

### Requirement: Locked First Answer
The system SHALL accept only a player's first answer submission for a given question and SHALL ignore subsequent answer submissions from the same player for that question.

#### Scenario: Player submits a second answer
- **WHEN** a player has already submitted an answer for the current question and submits another answer before the freeze ends
- **THEN** the server ignores the second submission and the player's recorded answer remains the first one submitted
