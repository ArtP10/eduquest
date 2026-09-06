## ADDED Requirements

### Requirement: Room Creation
The system SHALL allow a client to create a new room, becoming that room's host, and receive a unique room code and a shareable invite link that both resolve to the same room.

#### Scenario: Client creates a room
- **WHEN** a client requests to create a room
- **THEN** the server creates a new room in `lobby` status, assigns it a unique room code, designates the creating client as host, and returns the room code and invite link to the client

#### Scenario: Room code and invite link resolve to the same room
- **WHEN** one client joins using the room code and another client joins using the invite link generated for the same room
- **THEN** both clients end up in the same room

### Requirement: Join by Display Name
The system SHALL allow a client to join an existing room in `lobby` status by supplying a room code or invite link and a display name, without requiring an account.

#### Scenario: Client joins with a valid room code and display name
- **WHEN** a client submits a valid room code and a non-empty display name
- **THEN** the server assigns the client a server-generated player id, adds the player to the room's player list, and confirms the join to the client

#### Scenario: Client attempts to join a nonexistent room
- **WHEN** a client submits a room code that does not match any active room
- **THEN** the server rejects the join and returns an error indicating the room was not found

#### Scenario: Client attempts to join a room that has already started
- **WHEN** a client submits a valid room code for a room whose status is not `lobby`
- **THEN** the server rejects the join and returns an error indicating the room is no longer joinable

### Requirement: Lobby State Visibility
The system SHALL broadcast the current list of joined players in a room to all clients in that room whenever the player list changes, while the room is in `lobby` status.

#### Scenario: A new player joins the lobby
- **WHEN** a player successfully joins a room in `lobby` status
- **THEN** all clients currently in that room receive an updated player list including the new player's display name

#### Scenario: A player disconnects from the lobby
- **WHEN** a player disconnects while the room is in `lobby` status
- **THEN** all remaining clients in that room receive an updated player list with the disconnected player removed

### Requirement: Host-Starts-Game
The system SHALL allow only the room's host to start the match, transitioning the room out of `lobby` status, and SHALL prevent starting a match with no quiz content available.

#### Scenario: Host starts the match
- **WHEN** the host client sends a start-game request for a room in `lobby` status with at least one other requirement satisfied (a quiz assigned and at least one player present)
- **THEN** the server transitions the room out of `lobby` status and begins the match

#### Scenario: Non-host attempts to start the match
- **WHEN** a client that is not the room's host sends a start-game request
- **THEN** the server rejects the request and the room remains in `lobby` status