## ADDED Requirements

### Requirement: Match Persistence on Game End
The system SHALL persist a completed match when it ends: one match record, one participant record per player who was in the room (including guests), and one answer record per player per question.

#### Scenario: Match ends with a mix of logged-in and guest players
- **WHEN** a match's final question resolves and the match transitions to its ended state
- **THEN** the server writes one match record, a participant record for every player in the room (logged-in players linked to their user id, guests with no user id), and one answer record per player per question, each marked correct or incorrect

#### Scenario: Persistence failure does not affect the live match
- **WHEN** a match ends and writing its history to the database fails
- **THEN** the match still ends normally for all connected clients with their final leaderboard and placements, and the failure is not surfaced to clients

#### Scenario: A guest-hosted match is still persisted
- **WHEN** a match ends and the room's host was not logged in
- **THEN** the server still persists the match, its participants, and its answers, with no host user id recorded

### Requirement: My Matches List
The system SHALL provide an endpoint, available only to an authenticated user, that lists every match that user participated in, as a player and/or as host, along with their own final score and placement in each.

#### Scenario: Logged-in user requests their match history
- **WHEN** an authenticated client requests their match list
- **THEN** the server returns every match where that user was a participant or the host, each including the quiz title, when it was played, and that user's own final score and placement

#### Scenario: Unauthenticated client requests match history
- **WHEN** a client with no valid access token requests the match list endpoint
- **THEN** the server rejects the request as unauthenticated

### Requirement: Match Detail Visibility
The system SHALL allow any participant (a player or the host) of a match to view that match's full detail: every participant's score and placement (including guest nicknames), per-question statistics, and the quiz's global average. The system SHALL reject the request if the requester was not a participant in that match.

#### Scenario: Participant views match detail
- **WHEN** a client who played in or hosted a given match requests that match's detail
- **THEN** the server returns the full leaderboard for that match (all participants, scores, placements, including guest nicknames), per-question statistics, and the quiz's global average

#### Scenario: Non-participant attempts to view match detail
- **WHEN** an authenticated client who was neither a player nor the host of a given match requests that match's detail
- **THEN** the server rejects the request with a not-authorized response and returns no match data

#### Scenario: Per-question statistics reflect all participants
- **WHEN** a match's detail is requested
- **THEN** each question in the response includes the percentage of participants who answered it correctly and a count of how many participants answered it correctly out of the total number of participants

### Requirement: Per-Player Answer Drill-Down
The system SHALL provide an endpoint returning one participant's full per-question breakdown for a given match — for every question, its text, all of its answer choices, which choice was correct, and which choice (if any) that participant selected — accessible to that participant themself or to the match's host, and rejected for anyone else. A per-question percentage is not meaningful for a single participant's own breakdown (it can only ever be 100% or 0%); an overall score across the whole match SHALL be derivable from the returned per-question results instead.

#### Scenario: Player views their own answer breakdown
- **WHEN** an authenticated client requests the answer breakdown for a match participant record that belongs to them
- **THEN** the server returns, for every question in the match, its text, its choices, which choice was correct, which choice that participant selected (or none, if they didn't answer in time), and whether that was correct

#### Scenario: Host views another participant's answer breakdown
- **WHEN** the authenticated user who hosted a match requests the answer breakdown for any participant of that match
- **THEN** the server returns that participant's full per-question breakdown, identical in shape to what that participant would see for themself

#### Scenario: Non-host requests another participant's answer breakdown
- **WHEN** an authenticated client who is neither the target participant nor that match's host requests that participant's answer breakdown
- **THEN** the server rejects the request and returns no answer data

#### Scenario: Guest-hosted match has no host drill-down access
- **WHEN** a match's host was not logged in when the match was created
- **THEN** no authenticated client can use host access to view another participant's answer breakdown for that match, and each participant may still view only their own
