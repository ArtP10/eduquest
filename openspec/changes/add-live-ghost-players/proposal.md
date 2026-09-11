## Why

During a match, every player currently climbs alone — the platformer view shows only your own jumper, with other players reduced to leaderboard numbers. Seeing everyone climbing together, live, makes the match feel like an actual shared race instead of parallel solo runs scored against each other.

## What Changes

- Platform generation becomes deterministic and shared per room (a server-issued seed, synced at `room:create`/`room:join`), so every client renders the identical tower — a prerequisite for any other player's position to mean anything.
- Add live position broadcasting: a throttled client→server `player:move` event and a periodic server→room `players:positions` snapshot broadcast.
- Render every other connected player as a non-colliding "ghost" sprite (same character art, semi-transparent, full idle/walk/jump animation) with a name tag, positioned and animated from the broadcast snapshot.
- A ghost disappears when its player disconnects, and never reappears (no reconnect support exists in the game today, and this change doesn't add it).

## Capabilities

### New Capabilities
- `live-ghost-players`: broadcasting connected players' live positions during a match and rendering them as non-colliding ghost sprites with name tags on every other client.

### Modified Capabilities
- `jumper-gameplay`: "Upward Climbing Movement" changes from an independently-random platform layout per client to a deterministic, server-seeded layout shared by every client in the room — physics/movement simulation itself remains per-client and local, only the platform layout becomes shared.

## Impact

- **Backend**: `createRoom()` (`server/src/rooms.ts`) generates and stores a room seed; `RoomCreateResponse`/`RoomJoinResponse` (`shared/events.ts`) carry it. New `player:move` (client→server) and `players:positions` (server→client) events. A room-scoped interval broadcasts position snapshots while a match is running, cleared on match end/room deletion.
- **Frontend**: `jumper-scene.ts` swaps its unseeded RNG calls for a small seeded PRNG utility; new ghost-sprite lifecycle (create on first appearance in a snapshot, update position/animation/name tag each snapshot, destroy on disconnect) with no physics body and no collider.
- **No changes** to scoring, quiz phases, the existing `leaderboard:update`/`climb:progress` contract, or match history — this is additive and visual-only.
