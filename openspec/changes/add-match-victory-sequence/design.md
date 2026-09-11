## Context

`home.html` renders `matchPhase() === 'ended'` by immediately showing the full stats/leaderboard `app-pixel-panel` (see `home.html:3-81`). `SocketService.matchPhase` flips to `'ended'` the instant the `match:ended` socket event arrives (`socket.service.ts:123-135`), which also populates `finalPlacements` (rank/climbProgress per player), `leaderboard` (displayName/score per player), and the rest of the stats data this screen already reads. `AudioService` (`audio.service.ts`) is a thin `HTMLAudioElement` wrapper keyed by a closed `SoundKey` union, with `play()` for one-shot SFX and `loop()` for music; adding a sound is a two-line change (union member + `SOUND_FILES` entry).

## Goals / Non-Goals

**Goals:**
- Insert a self-contained interstitial between `matchPhase() === 'ended'` firing and the stats panel becoming visible.
- Drive the interstitial's stages (stop banner → 3rd → 2nd → 1st → done) off a local timer chain with hardcoded durations, synced to two new SFX cues.
- Keep the existing stats panel and its data/behavior completely unchanged — only gate when it becomes visible.

**Non-Goals:**
- No changes to scoring, placement computation, or any server/socket event.
- No skip/replay controls, no configurable timing.
- No fanfare beyond the top 3.
- No mute-state work beyond calling the existing `AudioService`.

## Decisions

**1. New standalone `VictorySequence` component, mounted by `home.html` in place of the stats panel until it's "done".**
`home.html`'s `matchPhase() === 'ended'` branch changes to: render `<app-victory-sequence>` while a new local signal (e.g. `victoryRevealed`, owned by `Home`) is `false`, and the existing `app-pixel-panel` stats block once it's `true`. `VictorySequence` emits a `revealed` output (or the parent passes it a callback) when its sequence completes; `Home` flips the flag and the stats panel renders in its current, untouched form. This keeps the stats panel's template/logic diff to zero and isolates all new animation/timing/audio logic in one component.
*Alternative considered:* fold the sequence into `Home`/`home.html` directly — rejected, it would tangle unrelated timer/animation state into an already-busy component and template.

**2. Sequence driven by a local phase signal + `setTimeout` chain, not `setInterval`/tick-based like `Match`'s countdown.**
`Match` ticks every 250ms because it renders a live "seconds remaining" number tied to a server-authoritative `phaseEndsAt`. This sequence has no server timing to reconcile against and no numeric countdown to render — it's a fixed local storyboard (stop → 3rd → 2nd → 1st → done), so a plain chain of `setTimeout`s advancing a `phase` signal is simpler and sufficient. All timers are captured and cleared in `ngOnDestroy` (mirroring `Match.ngOnDestroy`'s `tickHandle` cleanup) so leaving the room mid-sequence (`leaveRoom()`) can't leave a dangling timer trying to update a destroyed component.

**3. Hardcoded stage durations; drumroll-to-1st-place sync is a tuned constant, not measured from the audio file.**
Per the proposal's explicit non-goal ("configurable timing/duration (hardcode reasonable defaults for now)"), stage lengths are constants in the component, e.g.:
- `STOP_BANNER_MS` (air-horn plays, banner shown) → then
- `REVEAL_3RD_MS`, `REVEAL_2ND_MS` (staggered entrance) → then
- `REVEAL_1ST_MS` (drumroll's "congrats" hit should land here) → then done.
The drumroll sound starts playing at the beginning of the reveal stage (alongside 3rd place appearing); `REVEAL_1ST_MS` is tuned by ear to the actual supplied `drum-roll-sound.mp3` so the audio's congrats hit lines up with 1st place's entrance animation. This is a "hardcode reasonable defaults" approach, not a synced-to-audio-duration mechanism — acceptable per scope, but noted as an Open Question below since it can drift if the audio file changes.
*Alternative considered:* read `HTMLAudioElement.duration` (or a fixed offset from it) to schedule the 1st-place reveal precisely — deferred as unnecessary complexity for a one-shot, asset-specific tuning value; would also require `AudioService` to expose duration/`ended` events it doesn't today.

**4. Fewer-than-3-players matches reveal only the placements that exist, but always keep the drumroll landing on 1st place.**
`VictorySequence` reads `finalPlacements` (already rank-sorted) and reveals whichever of rank 3/2/1 are present — e.g. a 2-player match skips the 3rd-place stage entirely and goes stop → 2nd → 1st. No placeholder/empty podium slot is rendered. The drumroll-and-congrats sound and its `REVEAL_1ST_MS` timing are unaffected by player count: the sound still starts at the beginning of the reveal stage and its congrats hit still lands on 1st place's reveal, whether that's the 3rd stage transition (3+ players) or the very first one (1-2 players). This means the reveal stage as a whole is shorter for fewer players (fewer skipped stages before 1st place), not that the drumroll is cut short or skipped.

**5. New `SoundKey` entries `'air-horn-sound'` and `'drum-roll-sound'`, played via the existing `AudioService.play()`.**
Matches every other one-shot SFX in the app (`jump-sound`, `success-sound`, `error-sound`) — same volume tier (`SFX_VOLUME`), same autoplay-retry-on-gesture behavior. No new service or playback path needed.

## Risks / Trade-offs

- [Hardcoded drumroll timing drifts if `drum-roll-sound.mp3` is swapped for a different-length file later] → Mitigation: constant is named/commented pointing at the specific asset it was tuned against, so a future asset swap is a visible one-line thing to re-check, and this is explicitly deferred to an Open Question rather than solved now.
- [Autoplay policy could block the air-horn/drumroll on some browsers if the match-end moment isn't itself downstream of a user gesture] → Mitigation: `AudioService.attemptPlay` already retries once on the next `pointerdown`; in practice match end always follows recent gameplay input, so this is a pre-existing, already-mitigated risk, not a new one.
- [Sequence never completes (e.g. a timer bug) and the stats panel becomes unreachable] → Mitigation: keep the timer chain simple/linear (no branching state machine), and the "View Match Details" button is the sequence's own terminal stage, not a separate gate — if the last stage's timer fires, the button always appears.

## Open Questions

- Exact millisecond value for `REVEAL_1ST_MS` (and the other stage durations) needs by-ear tuning against the actual supplied audio files during implementation — placeholder defaults will be used and should be adjusted while testing in-browser with sound on.
