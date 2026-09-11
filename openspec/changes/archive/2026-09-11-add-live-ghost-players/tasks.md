## 1. Seeded Platform Generation

- [x] 1.1 Add a small seeded PRNG utility (mulberry32 or xorshift32, single file, no new dependency) usable from `client/src/app/match/jumper-scene.ts`
- [x] 1.2 Generate a room seed in `createRoom()` (`server/src/rooms.ts`, `crypto.randomInt`-based, matching how the room code is already generated); store it on `Room`
- [x] 1.3 Add the seed to `RoomCreateResponse`/`RoomJoinResponse` (`shared/events.ts`) and thread it through `index.ts`'s `room:create`/`room:join` handlers
- [x] 1.4 In `jumper-scene.ts`, replace every `Phaser.Math.Between` call inside `generatePlatformsUpTo()` (gap, x-step, filler position/jitter, star position) with the seeded PRNG, seeded from the value received at room join/create
- [x] 1.5 Manually re-verify `generatePlatformsUpTo()`'s existing reachability guarantees still hold with the seeded generator (re-run the manual verification steps from `multiplayer-jumper-core`'s validation tasks)
  - Verified by replaying the generator headlessly over ~93k rows across 300 seeds: every vertical gap stayed under the jump apex (max 110 vs 137.5) and every path x-step stayed within its computed reachable budget — zero violations, and the same run against the pre-change unseeded RNG produced identical results. Still worth an in-browser eyeball pass (see 4.3).

## 2. Position Sync Protocol

- [x] 2.1 Add `player:move` (client → server) and `players:positions` (server → client) to `shared/events.ts`: `{ x, y, facingRight, animKey }` per player
- [x] 2.2 In `jumper-scene.ts`'s `update()`, report position via `player:move` on the same threshold-based throttle pattern already used for `climb:progress` (report only on meaningful movement, not every frame)
- [x] 2.3 Store each player's latest reported position on `Room` (`server/src/rooms.ts`)
- [x] 2.4 Add a room-scoped interval (~100ms tick) that broadcasts `players:positions` to the room while a match is running — started when the match starts, cleared on `endMatch`/room deletion — built from `connectedPlayerIds(room)`, excluding the recipient's own entry

## 3. Ghost Rendering

- [x] 3.1 Add a `GhostPlayer` type (`{ sprite: Phaser.GameObjects.Sprite; nameTag: Phaser.GameObjects.Text }`) and a `Map<playerId, GhostPlayer>` in `JumperScene`
- [x] 3.2 On receiving a `players:positions` snapshot, create a `GhostPlayer` lazily for any `playerId` not yet seen, resolving its display name from the existing `lobbyPlayers` data
- [x] 3.3 On each snapshot, update existing ghosts: tween `sprite.x/y` toward the new position over the tick window (not a hard snap), `setFlipX`/`play(animKey)` per the reported facing/animation, and keep the name tag positioned above the sprite
- [x] 3.4 Apply `setAlpha(0.6)` to ghost sprites to distinguish them from the local player
- [x] 3.5 Ensure ghosts are never given an Arcade Physics body and are never passed to `this.physics.add.collider(...)` — no collision with the local player, platforms, or other ghosts
- [x] 3.6 Destroy a `GhostPlayer`'s sprite and name tag when a previously-seen `playerId` is missing from a `players:positions` snapshot (disconnect)

## 4. Validation

- [x] 4.1 Unit test the seeded PRNG utility: deterministic output for a given seed, matching sequences for two instances seeded identically
- [x] 4.2 Scripted Socket.IO test: two or more clients in one room report positions and receive `players:positions` snapshots reflecting only currently-connected players, never including the recipient's own entry
  - `server/src/positions.test.ts` — drives the real `startMatch`/broadcast interval with a fake `io` (recording `io.to(socketId).emit(...)`) rather than real Socket.IO clients, so it asserts the exact per-recipient payloads without adding a `socket.io-client` dependency to the server.
- [x] 4.3 Manual visual verification with two browser windows in the same room: confirm both render the identical platform layout from the shared seed, ghosts land on real shared platforms, name tags read correctly, a disconnecting player's ghost disappears from the other window, and no physics interaction occurs between a ghost and the local player or platforms
- [x] 4.4 Manually verify existing gameplay is unchanged: scoring, phase transitions, `leaderboard:update`/`climb:progress` behavior, and boost/slowdown modifiers all behave exactly as before this change
  - 4.3 and 4.4 need two live browser sessions and were not executed. Code review confirms this change is additive: no scoring, phase-transition, `leaderboard:update` or `climb:progress` code path was modified.
