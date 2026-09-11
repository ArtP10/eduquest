## 1. Audio assets

- [x] 1.1 Copy `air-horn-sound.mp3` and `drum-roll-sound.mp3` into `client/public/sound/`
- [x] 1.2 Add `'air-horn-sound'` and `'drum-roll-sound'` to `AudioService`'s `SoundKey` union and `SOUND_FILES` map (`client/src/app/core/audio.service.ts`)

## 2. VictorySequence component

- [x] 2.1 Scaffold standalone `VictorySequence` component (e.g. `client/src/app/home/victory-sequence/victory-sequence.ts` + `.html` + `.scss`), using `PixelPanel`/`PixelButton` for styling consistency
- [x] 2.2 Add a `revealed` output (or callback input) the component fires once its sequence completes
- [x] 2.3 Add inputs (or read directly from `SocketService`) for `finalPlacements` and `leaderboard` (for display names) needed to render the top-3 rows
- [x] 2.4 Implement the `phase` signal and `setTimeout` chain: `stop` → `reveal-3rd` (skip if absent) → `reveal-2nd` (skip if absent) → `reveal-1st` → `done`, with hardcoded duration constants per design.md decision 3
- [x] 2.5 Trigger `AudioService.play('air-horn-sound')` on entering the `stop` phase
- [x] 2.6 Trigger `AudioService.play('drum-roll-sound')` on entering the reveal stage (start of 3rd/2nd/1st sequence), with the 1st-place reveal timer tuned so the congrats hit lands on it
- [x] 2.7 Render stop banner, staggered top-3 entrance animations, and "View Match Details" `PixelButton` (shown only once `phase` is `done`) per spec scenarios
- [x] 2.8 Clear all pending timers in `ngOnDestroy`

## 3. Wire into Home

- [x] 3.1 Add a `victoryRevealed` signal to `Home` (`client/src/app/home/home.ts`), reset to `false` alongside the existing matchId-driven reset effect
- [x] 3.2 In `home.html`, change the `matchPhase() === 'ended'` branch to render `<app-victory-sequence>` while `!victoryRevealed()`, and the existing (unchanged) stats `app-pixel-panel` once `victoryRevealed()` is `true`
- [x] 3.3 Wire `VictorySequence`'s completion output to set `victoryRevealed` to `true`

## 4. Verification

- [ ] 4.1 Play a full match end-to-end in the browser with sound on; confirm horn plays with the stop banner and the drumroll's congrats hit lands on the 1st-place reveal — adjust `REVEAL_1ST_MS`/stage constants by ear until it lines up
- [ ] 4.2 Verify a 2-player and a 1-player match skip the missing podium slot(s) without a placeholder, ending on 1st place, and that the drumroll still plays with its congrats hit landing on 1st place in both cases
- [ ] 4.3 Verify leaving the room mid-sequence (e.g. via "Volver al inicio" from a prior match, or navigating away) doesn't throw and doesn't continue firing timers/sounds after leaving
- [ ] 4.4 Verify "View Match Details" reveals the stats screen with unchanged content/behavior (drill-down, averages, question stats all still work)
- [x] 4.5 Run `npx tsc --noEmit` (or the project's existing typecheck script) for the client app

## 5. Congrats message and confetti

- [x] 5.1 Add a `congratsVisible` signal and `winnerName` computed (1st-place `displayName`) to `VictorySequence`, shown as an animated "¡Felicidades, [name]!" message shortly after the 1st-place row is revealed
- [x] 5.2 Add a confetti animation (`confettiPieces` generated once, CSS `@keyframes` fall animation) that starts at the same time as the congrats message
- [x] 5.3 Verify build/typecheck still pass with the new elements

## 6. Stacked reveal layout

- [x] 6.1 Change `.podium` to `.podium-stack` with `flex-direction: column-reverse`, keeping DOM order 3rd → 2nd → 1st → congrats-message so each is visually stacked on top of the previous (3rd at the bottom, 1st on top of 2nd, congrats message on top of 1st)
- [x] 6.2 Verify build/typecheck still pass with the restructured layout
