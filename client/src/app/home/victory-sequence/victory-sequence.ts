import { Component, OnDestroy, OnInit, computed, inject, output, signal } from '@angular/core';
import { SocketService } from '../../core/socket.service';
import { AudioService } from '../../core/audio.service';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';
import { PixelIcon } from '../../shared/pixel-icon';

interface PodiumRow {
  rank: number;
  displayName: string;
}

type Phase = 'stop' | 'reveal' | 'done';

// Stage timings, tuned by ear against the specific supplied audio files
// (client/public/sound/air-horn-sound.mp3, drum-roll-sound.mp3) — see
// design.md decision 3. Re-tune if either file is ever swapped.
const STOP_BANNER_MS = 1400;
// Offsets are all measured from the start of the reveal stage (when the
// drumroll starts), not from each other — so the 1st-place reveal always
// lands on the drumroll's congrats hit regardless of how many podium slots
// are actually revealed before it (see design.md decision 4).
const REVEAL_3RD_AT_MS = 0;
const REVEAL_2ND_AT_MS = 700;
const REVEAL_1ST_AT_MS = 1800;
// Delay after the 1st-place row appears before the congrats message/confetti
// kick in — keeps them visibly reacting to the 1st-place reveal rather than
// popping in at the exact same instant.
const CONGRATS_DELAY_MS = 350;
const DONE_DELAY_MS = 1800;

const CONFETTI_PIECE_COUNT = 36;
const CONFETTI_COLORS = ['var(--ucab-gold)', 'var(--ucab-blue)', 'var(--ucab-green)', 'var(--ucab-paper)'];

interface ConfettiPiece {
  left: number;
  delayMs: number;
  durationMs: number;
  color: string;
  rotationDeg: number;
}

/**
 * End-of-match "podium" interstitial shown before the existing stats screen
 * — see openspec/changes/add-match-victory-sequence. Reads placement data
 * directly off SocketService (same pattern as Match/Leaderboard) rather than
 * via inputs, since it's only ever mounted from Home while a match is ended.
 */
@Component({
  selector: 'app-victory-sequence',
  imports: [PixelButton, PixelIcon],
  templateUrl: './victory-sequence.html',
  styleUrl: './victory-sequence.scss'
})
export class VictorySequence implements OnInit, OnDestroy {
  private readonly socketService = inject(SocketService);
  private readonly audioService = inject(AudioService);

  /** Fires once the sequence finishes and the user clicks through. */
  readonly revealed = output<void>();

  protected readonly phase = signal<Phase>('stop');
  protected readonly visibleRanks = signal<ReadonlySet<number>>(new Set());
  protected readonly congratsVisible = signal(false);
  protected readonly confettiActive = signal(false);

  // Generated once per mount, not a signal — purely decorative and never
  // needs to react to state changes, just to exist by the time confetti is
  // shown.
  protected readonly confettiPieces: ConfettiPiece[] = Array.from({ length: CONFETTI_PIECE_COUNT }, () => ({
    left: Math.random() * 100,
    delayMs: Math.random() * 300,
    durationMs: 1800 + Math.random() * 1200,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotationDeg: Math.random() * 360
  }));

  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  protected readonly podium = computed<PodiumRow[]>(() => {
    const byPlayerId = new Map(this.socketService.leaderboard().map((entry) => [entry.playerId, entry]));
    return this.socketService
      .finalPlacements()
      .filter((placement) => placement.rank <= 3)
      // Descending rank (3rd, 2nd, 1st) — matches reveal order, so the
      // template can render top-to-bottom with 1st landing last/bottom.
      .sort((a, b) => b.rank - a.rank)
      .map((placement) => ({
        rank: placement.rank,
        displayName: byPlayerId.get(placement.playerId)?.displayName ?? ''
      }));
  });

  protected readonly winnerName = computed(() => this.podium().find((row) => row.rank === 1)?.displayName ?? '');

  ngOnInit(): void {
    this.audioService.play('air-horn-sound');
    this.schedule(STOP_BANNER_MS, () => this.startReveal());
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  protected onViewDetails(): void {
    this.revealed.emit();
  }

  private startReveal(): void {
    this.phase.set('reveal');
    this.audioService.play('drum-roll-sound');

    const ranksPresent = new Set(this.podium().map((row) => row.rank));
    if (ranksPresent.has(3)) this.schedule(REVEAL_3RD_AT_MS, () => this.revealRank(3));
    if (ranksPresent.has(2)) this.schedule(REVEAL_2ND_AT_MS, () => this.revealRank(2));
    if (ranksPresent.has(1)) {
      this.schedule(REVEAL_1ST_AT_MS, () => this.revealRank(1));
      this.schedule(REVEAL_1ST_AT_MS + CONGRATS_DELAY_MS, () => {
        this.congratsVisible.set(true);
        this.confettiActive.set(true);
      });
    }
    this.schedule(REVEAL_1ST_AT_MS + DONE_DELAY_MS, () => this.phase.set('done'));
  }

  private revealRank(rank: number): void {
    this.visibleRanks.update((ranks) => new Set(ranks).add(rank));
  }

  private schedule(delayMs: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, delayMs));
  }
}
