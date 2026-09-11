## Context

QuizJumper's platformer match view (`client/src/app/match/jumper-scene.ts`) renders only the local player. Every other participant is invisible during `climbing`/`frozen`/`results` — the only shared signal is the leaderboard (height, score, rank), synced via `climb:progress` (client → server, throttled) and `leaderboard:update` (server → all clients).

Critically, each client's platform layout is **independently randomly generated**: `generatePlatformsUpTo()` calls `Phaser.Math.Between`, Phaser's unseeded global RNG, with no seed synced from the server. So today, players aren't climbing the same tower — everyone free-climbs their own private, randomly-laid-out world while being scored on height + quiz-answer correctness in parallel. This is the reason this change touches platform generation at all: broadcasting raw positions is meaningless unless every client's platforms are actually in the same place.

There is no reconnect mechanism anywhere in the codebase today: once a socket disconnects mid-match, `removePlayerBySocketId` (`server/src/rooms.ts`) marks that player `connected: false` permanently, and `room:join` only accepts joins while `room.status === 'lobby'`. A dropped player cannot rejoin an in-progress match. This change does not add reconnect support — it's a pre-existing gap, out of scope here.

## Goals / Non-Goals

**Goals:**
- Every player in a room sees every other connected player's avatar moving live, in real time, landing on the *same* physical platforms they're standing on.
- A name tag above each ghost identifies who it is.
- Ghosts never physically interact with anything — not each other, not the local player, not platforms (visually they sit on/pass through platforms exactly where the real occupant does, but that's positional accuracy from shared seeding, not collision).

**Non-Goals:**
- Reconnect support (see Context — a separate, pre-existing gap).
- Any visual reaction tied to question results beyond the existing boost/slowdown speed change already affecting a player's own movement (and therefore their broadcast position).
- Spectator mode, or ghosts for players who haven't started/were eliminated (no such states exist in the current game).
- Replays or persisting ghost movement to match history — this is live-only.
- Changing anything about scoring, the quiz phases, or the existing `leaderboard:update`/`climb:progress` events — this is additive.

## Decisions

**1. Seed platform generation per room, synced at `room:create`/`room:join`, so every client generates the identical tower.**
`createRoom()` (`server/src/rooms.ts`) generates a random seed (`crypto.randomInt`-based, consistent with how the room code is already generated) and stores it on `Room`. `RoomCreateResponse`/`RoomJoinResponse` (`shared/events.ts`) carry it to the client. `jumper-scene.ts` swaps `Phaser.Math.Between` for a small seeded PRNG (a single-file mulberry32 or xorshift32 utility — no new dependency) seeded from that value at scene creation. Every call site currently using `Phaser.Math.Between` inside `generatePlatformsUpTo()` (gap, x-step, filler position/jitter, star position) switches to the seeded generator so the *sequence* of calls — and therefore the resulting layout — is identical across clients. Nothing server-side simulates platforms; this stays fully client-generated, just deterministically so given the same seed and call order.

Alternative considered: have the server generate and broadcast the actual platform list — rejected as a much larger change (the whole procedural-generation algorithm would move server-side or need duplicating), when determinism from a shared seed gets the same result far more cheaply.

**2. Position sync: throttled client→server event, periodic server→room snapshot broadcast — not 1:1 relay.**
New `player:move` (client → server): `{ x: number, y: number, facingRight: boolean, animKey: 'idle' | 'walk' | 'jump' }`, sent from `jumper-scene.ts`'s `update()` on the same kind of threshold-based throttle already used for `climb:progress` (report only when position has moved meaningfully since the last report — reuse the existing `>= 10px` delta pattern, checked on the combined x/y movement, not just y). Server (`server/src/rooms.ts`/`match.ts`) stores each player's latest reported `{x, y, facingRight, animKey}` on the `Room`. A room-scoped interval (started when the match starts, cleared on `endMatch`/room deletion, ~100ms tick) broadcasts `players:positions` (server → clients): `Record<playerId, {x, y, facingRight, animKey}>` for every *currently connected* player except the recipient (server never needs to tell a client its own position back). This avoids O(n²) relay chatter from broadcasting each individual update to everyone immediately.

Alternative considered: relay each `player:move` immediately to the room (no server-side coalescing) — rejected because with several players each moving every ~100-150ms, that's redundant per-player fan-out; a single periodic snapshot scales better and is simpler for the client to consume (one event, one full picture, rather than reconciling a stream of partial updates).

**3. Ghosts are plain sprites with no physics body — never added to any collider.**
Client-side, `JumperScene` keeps a `Map<playerId, GhostPlayer>` (`{ sprite: Phaser.GameObjects.Sprite; nameTag: Phaser.GameObjects.Text }`), created lazily the first time a `players:positions` snapshot mentions a `playerId` not yet seen (name resolved from the existing `lobbyPlayers`/`LobbyPlayer.displayName` data already held from `lobby:update` — no new data needed for names). On each snapshot, existing ghosts' `sprite.x/y` are updated (tweened toward the new position over the ~100ms tick window via a short `Phaser.Tweens` interpolation, not snapped, so motion reads smoothly rather than stepping every tick), `setFlipX`/`play(animKey)` mirror the reported facing/animation, and the name tag (`Text`, origin `(0.5, 1)`, offset a fixed pixel amount above the sprite, matching `CHARACTER_DISPLAY_HEIGHT`) follows along. Ghosts are `setAlpha(0.6)` to stay visually distinct from the local player (full character fidelity, just clearly "not you"). Ghosts are **never** passed to `this.physics.add.collider(...)` and never given an Arcade Physics body at all — they're puppeted purely from network data, so "no collision" is true by construction, not by a physics exclusion flag.

**4. A ghost disappears (and stays gone) when its player disconnects — no other lifecycle to handle.**
Server's `players:positions` snapshot is built from `connectedPlayerIds(room)` (the same helper `startResultsPhase()` already uses for the disconnected-player scoring fix), so a disconnected player simply stops appearing in future snapshots. Client destroys that `GhostPlayer`'s sprite + text the moment a previously-seen `playerId` is missing from a snapshot. Since `room:join` already rejects once the match has started, there's no "ghost appears for a brand-new late joiner" case, and since there's no reconnect, there's no "ghost reappears" case either — this lifecycle is deliberately that simple.

**5. Horizontal wrap and the fall-reset stay entirely client-side, per-player, un-synced as a separate concept.**
The local player's own wrap (`x < -20` → `WORLD_WIDTH + 20`) and reset-on-fall (`y > startY + 60` → back near start) already happen in each client's own `update()` *before* that player's position is reported via `player:move`. A ghost therefore just displays whatever already-wrapped/already-reset `x, y` its owner's client sent — no additional wrap/reset logic needed on the receiving side; it's implicit in what gets broadcast.

## Risks / Trade-offs

- **[Risk]** Interpolating ghost movement over a fixed ~100ms window will visibly lag or overshoot during a sudden direction change (e.g., the real player reverses mid-tween). → **Mitigation**: acceptable for a visual-only feature with no gameplay stakes; if it reads poorly in practice, the tween duration is a single tunable constant, not a structural fix.
- **[Risk]** The seeded-PRNG swap touches `generatePlatformsUpTo()`, a function with carefully-tuned reachability guarantees (documented at length in its existing comments). → **Mitigation**: swapping the RNG source changes *which* platforms get generated, not the algorithm that guarantees reachability — the guarantees hold for any deterministic PRNG the same way they hold for `Phaser.Math.Between` today. Existing manual verification steps (from `multiplayer-jumper-core`'s own validation tasks) should be re-run once seeded.
- **[Risk]** A room with many players sending frequent `player:move` events increases server memory (latest position per player) and broadcast size (snapshot scales with player count) — bounded by the same room-size assumptions the game already makes elsewhere (no explicit cap exists today); not a new class of risk, just more of the same kind already accepted for `leaderboard:update`.
- **[Trade-off]** No reconnect support means a disconnected player's ghost is simply gone, and they can't come back to see themselves rejoin — consistent with (not worse than) today's total inability to reconnect at all.

## Migration Plan

1. Ship the seeded-platform-generation change first (server seed generation + `RoomCreateResponse`/`RoomJoinResponse` field + client PRNG swap) — additive field, old clients ignoring it would simply keep today's per-client-random behavior, so this can land independently of the rest.
2. Ship the position-sync protocol (`player:move`/`players:positions`) and ghost rendering together — the protocol has no purpose without the rendering, and vice versa.
3. No backfill or data migration — this is entirely live/in-memory, nothing persisted.
4. Rollback: revert the client/server changes independently is safe in either order, since both the seed field and the new events are additive to existing payloads/contracts.

## Open Questions

- None outstanding — resolved during brainstorming (shared-seed approach, snapshot-broadcast protocol, full-fidelity animated ghosts, and the no-reconnect/no-late-join lifecycle simplification).
