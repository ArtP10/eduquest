## Why

Match end currently cuts straight from gameplay to the stats screen with no acknowledgment of who won — the moment with the highest emotional payoff (finding out you placed top 3) is skipped entirely. A short animated "podium" interstitial, timed to two new sound cues, gives that moment its due before players move on to reviewing stats.

## What Changes

- Add a full-screen "Match Over" interstitial that plays automatically when `matchPhase` becomes `ended`, before the existing stats screen is shown.
- Interstitial sequence, client-side only, hardcoded timings:
  1. A pixel-art "stop" banner appears immediately, in sync with a new air-horn sound effect.
  2. A staggered top-3 reveal follows: 3rd place, then 2nd, then 1st, each with a brief entrance animation.
  3. A new drumroll+congrats sound plays leading into the reveal, timed so its "congrats" hit lands on the 1st-place reveal.
  4. Once the reveal finishes, a "View Match Details" `PixelButton` appears.
- Clicking "View Match Details" reveals the existing stats/leaderboard screen (`home.html`'s current `matchPhase() === 'ended'` branch), unchanged.
- Add two new sound assets (`air-horn-sound.mp3`, `drum-roll-sound.mp3`) to `client/public/sound/`, wired into the existing `AudioService`/`SoundKey` convention.
- Matches with fewer than 3 players still get the sequence — reveal only as many of the top 3 as there are players.

## Capabilities

### New Capabilities
- `match-victory-sequence`: The end-of-match podium interstitial — its stop-banner/horn beat, staggered top-3 reveal synced to drumroll/congrats, and the "View Match Details" handoff into the existing stats screen.

### Modified Capabilities
(none — no existing spec's requirements change; the stats screen itself is unchanged, only gated behind a new step)

## Impact

- `client/src/app/home/home.html` / `home.ts` (or a new component it delegates to): insert the interstitial between the `matchPhase() === 'ended'` transition and the current stats panel.
- `client/src/app/core/audio.service.ts`: extend `SoundKey`/`SOUND_FILES` with the two new cues.
- `client/public/sound/`: two new audio files.
- No server, socket-event, or scoring/placement changes — consumes `finalPlacements`/`leaderboard` already delivered by the existing `match:ended` event.
