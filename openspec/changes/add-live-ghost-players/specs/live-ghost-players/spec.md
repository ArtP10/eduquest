## ADDED Requirements

### Requirement: Live Position Broadcast
The system SHALL periodically broadcast every connected player's current position, facing direction, and animation state to every other client in that room while a match is in progress.

#### Scenario: Position snapshot excludes disconnected players
- **WHEN** the server broadcasts a position snapshot for a room
- **THEN** the snapshot includes an entry only for each currently connected player, and includes no entry for a player who has disconnected

#### Scenario: A client never receives its own position back
- **WHEN** the server broadcasts a position snapshot to a given client
- **THEN** that snapshot does not include an entry for that client's own player

### Requirement: Ghost Rendering
The system SHALL render every other connected player in the room as a visually distinct sprite ("ghost"), positioned, facing, and animated according to the most recent position broadcast for that player, with a name tag identifying that player above their sprite.

#### Scenario: A ghost appears for each other connected player
- **WHEN** a client is in a match with other connected players
- **THEN** it renders one ghost sprite per other connected player, each labeled with that player's display name

#### Scenario: Ghost animation reflects reported movement
- **WHEN** a position broadcast reports a player as facing a direction and in a given movement state (idle, walking, or jumping)
- **THEN** that player's ghost is flipped to face the reported direction and plays the corresponding animation

### Requirement: No Ghost Collision
The system SHALL NOT allow a ghost to physically interact with the local player, with platforms, or with any other ghost — ghost rendering is purely visual.

#### Scenario: Ghost does not block or push the local player
- **WHEN** a ghost's rendered position overlaps the local player's position or a platform
- **THEN** no collision, blocking, or physics response occurs for either the local player or the ghost

### Requirement: Ghost Disappears on Disconnect
The system SHALL remove a player's ghost from every other client's view when that player disconnects, and SHALL NOT cause that ghost to reappear.

#### Scenario: A disconnecting player's ghost is removed
- **WHEN** a player disconnects mid-match
- **THEN** every other client removes that player's ghost sprite and name tag, and no subsequent position broadcast includes that player again for the remainder of the match
