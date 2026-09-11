## ADDED Requirements

### Requirement: Victory sequence plays before the stats screen
When a match ends, the system SHALL show a full-screen victory interstitial instead of immediately showing the final stats/leaderboard screen.

#### Scenario: Match ends
- **WHEN** the client's match phase transitions to `ended`
- **THEN** the victory interstitial is shown
- **AND** the existing final stats/leaderboard screen is not shown until the interstitial completes

### Requirement: Stop banner with air-horn cue
The interstitial SHALL open with an animated stop/banner message and play an air-horn sound effect in sync with the banner's appearance.

#### Scenario: Interstitial starts
- **WHEN** the victory interstitial begins
- **THEN** the stop banner animation starts
- **AND** the air-horn sound effect plays at the same time

### Requirement: Staggered top-3 reveal synced to drumroll
After the stop banner, the interstitial SHALL reveal the top 3 placements one at a time — 3rd place, then 2nd, then 1st — each with its own brief entrance animation, stacked so that each newly revealed place appears on top of the previously revealed one(s), while a drumroll-and-congrats sound plays leading into the 1st-place reveal so the sound's congrats hit coincides with 1st place appearing.

#### Scenario: Three or more players
- **WHEN** the stop banner stage finishes and at least 3 placements exist
- **THEN** 3rd place is revealed first at the bottom of the stack, then 2nd place appears stacked on top of 3rd, then 1st place appears stacked on top of 2nd, each as a separate staggered animation
- **AND** the drumroll-and-congrats sound plays during this stage, timed so its congrats hit lands when 1st place is revealed

#### Scenario: Fewer than three players
- **WHEN** the stop banner stage finishes and fewer than 3 placements exist
- **THEN** only the placements that exist are revealed, in ascending rank order (worst to best), each stacked on top of the previous, ending with 1st place at the top of the stack
- **AND** no placeholder is shown for a missing 2nd- or 3rd-place slot
- **AND** the drumroll-and-congrats sound still plays during this stage, timed so its congrats hit lands when 1st place is revealed, the same as with 3 or more players

### Requirement: Congrats message and confetti on 1st place
After the 1st-place row is revealed, the interstitial SHALL show an animated "¡Felicidades, [winner's name]!" message stacked on top of the 1st-place row, along with a confetti animation.

#### Scenario: 1st place is revealed
- **WHEN** the 1st-place podium row is revealed
- **THEN** shortly after, an animated congrats message reading "¡Felicidades, [winner's name]!" appears stacked on top of the 1st-place row, using the winner's display name
- **AND** a confetti animation starts at the same time

### Requirement: View Match Details handoff
Once the top-3 reveal finishes, the interstitial SHALL show a "View Match Details" button that, when clicked, shows the existing final stats/leaderboard screen unchanged.

#### Scenario: Reveal completes
- **WHEN** the top-3 reveal stage finishes
- **THEN** a "View Match Details" button appears
- **AND** the interstitial itself does not auto-dismiss without this button being clicked

#### Scenario: User views match details
- **WHEN** the user clicks "View Match Details"
- **THEN** the existing final stats/leaderboard screen is shown
- **AND** its content and behavior are unchanged from before this feature existed

### Requirement: Sequence cleanup on early exit
If the client leaves the match (e.g. returns to the lobby) while the victory interstitial is still running, the system SHALL stop the sequence and its timers without error.

#### Scenario: Player leaves mid-sequence
- **WHEN** the user leaves the room while the stop banner or top-3 reveal stage is still in progress
- **THEN** any pending interstitial timers are cancelled
- **AND** no further interstitial stage transitions or sounds occur after leaving
