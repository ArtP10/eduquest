## MODIFIED Requirements

### Requirement: Upward Climbing Movement
The system SHALL render a Phaser 3 jumper character per player that climbs upward on platforms during the `climbing` phase, using client-side physics local to that player's own view. The platform layout itself SHALL be generated deterministically from a seed shared by every client in the room, so every player's platforms are laid out identically, while each client continues to simulate only its own player's movement and physics locally.

#### Scenario: Player climbs during the climbing phase
- **WHEN** a room is in `climbing` phase
- **THEN** each client renders and simulates its own player's jumper moving upward across platforms, independently of other players' movement simulation

#### Scenario: All clients in a room render the same platform layout
- **WHEN** a room is created
- **THEN** the server issues a seed for that room, and every client that joins generates its platform layout deterministically from that seed, producing an identical layout across all clients in the room
