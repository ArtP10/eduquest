import { Component, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SocketService } from '../core/socket.service';
import { AuthService } from '../auth/auth.service';
import { MatchHistoryService, type PlayerAnswerBreakdown } from '../match-history/match-history.service';
import { Lobby } from '../lobby/lobby';
import { Match } from '../match/match';
import { Leaderboard } from '../leaderboard/leaderboard';
import { PixelPanel } from '../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelButton } from '../shared/pixel-ui/pixel-button/pixel-button';
import { PixelQuestionStats, type QuestionStatRow } from '../shared/pixel-ui/pixel-question-stats/pixel-question-stats';
import { VictorySequence } from './victory-sequence/victory-sequence';

interface EndedLeaderboardRow {
  playerId: string;
  matchPlayerId: string | null;
  userId: string | null;
  rank: number;
  nickname: string;
  score: number;
  height: number;
}

/**
 * Everything the app did at `/` before routing existed — unchanged
 * behaviorally, just moved out of `App` so the root route has a component
 * to render alongside the new guarded quiz-builder routes (see design.md
 * decision 10). `App` keeps the persistent header.
 */
@Component({
  selector: 'app-home',
  imports: [Lobby, Match, Leaderboard, DecimalPipe, PixelPanel, PixelButton, PixelQuestionStats, VictorySequence],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  protected readonly socketService = inject(SocketService);
  private readonly authService = inject(AuthService);
  private readonly matchHistoryService = inject(MatchHistoryService);

  protected readonly expandedMatchPlayerId = signal<string | null>(null);
  protected readonly answersByMatchPlayerId = signal<Record<string, PlayerAnswerBreakdown[]>>({});
  protected readonly drillDownLoading = signal<string | null>(null);
  protected readonly drillDownError = signal<string | null>(null);
  // Gates the stats panel behind the victory interstitial — see
  // openspec/changes/add-match-victory-sequence.
  protected readonly victoryRevealed = signal(false);

  constructor() {
    // A fresh match (or leaving the room) gets a fresh matchId — drop any
    // drill-down state from a previous match rather than carrying it over.
    effect(() => {
      this.socketService.matchId();
      this.expandedMatchPlayerId.set(null);
      this.answersByMatchPlayerId.set({});
      this.drillDownLoading.set(null);
      this.drillDownError.set(null);
      this.victoryRevealed.set(false);
    });
  }

  /**
   * Combines match:ended's `leaderboard` (name/score), `placements`
   * (final rank/height), and `players` (matchPlayerId/userId, once
   * persisted) by playerId into the same shape the historical match-detail
   * page shows, so the live end screen and the persisted one look
   * identical, drill-down included — see match-history/match-detail.
   */
  protected get endedLeaderboardRows(): EndedLeaderboardRow[] {
    const byPlayerId = new Map(this.socketService.leaderboard().map((entry) => [entry.playerId, entry]));
    const playersByPlayerId = new Map(this.socketService.matchPlayers().map((p) => [p.playerId, p]));
    return this.socketService.finalPlacements().map((placement) => {
      const entry = byPlayerId.get(placement.playerId);
      const persisted = playersByPlayerId.get(placement.playerId);
      return {
        playerId: placement.playerId,
        matchPlayerId: persisted?.matchPlayerId ?? null,
        userId: persisted?.userId ?? null,
        rank: placement.rank,
        nickname: entry?.displayName ?? '',
        score: entry?.score ?? 0,
        height: placement.climbProgress
      };
    });
  }

  protected get endedQuestionStatRows(): QuestionStatRow[] {
    return this.socketService.questionStats();
  }

  /** Same rule as match-detail's isHost: only an authenticated host — a guest host has no persisted identity to drill down as. */
  canDrillDown(entryUserId: string | null): boolean {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return false;
    if (this.socketService.isHost()) return true;
    return entryUserId === userId;
  }

  scoreSummary(answers: PlayerAnswerBreakdown[]): { correct: number; total: number; percent: number } {
    const correct = answers.filter((a) => a.isCorrect).length;
    const total = answers.length;
    return { correct, total, percent: total > 0 ? Math.round((correct / total) * 100) : 0 };
  }

  async toggleDrillDown(matchPlayerId: string): Promise<void> {
    if (this.expandedMatchPlayerId() === matchPlayerId) {
      this.expandedMatchPlayerId.set(null);
      return;
    }
    this.expandedMatchPlayerId.set(matchPlayerId);
    this.drillDownError.set(null);
    if (this.answersByMatchPlayerId()[matchPlayerId]) return;

    const matchId = this.socketService.matchId();
    if (!matchId) return;
    this.drillDownLoading.set(matchPlayerId);
    const result = await this.matchHistoryService.getPlayerAnswers(matchId, matchPlayerId);
    this.drillDownLoading.set(null);
    if (result.ok) {
      this.answersByMatchPlayerId.update((map) => ({ ...map, [matchPlayerId]: result.answers }));
    } else {
      this.drillDownError.set('No se pudieron cargar las respuestas de este jugador.');
    }
  }
}
