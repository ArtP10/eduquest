import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SocketService } from '../core/socket.service';
import { Lobby } from '../lobby/lobby';
import { Match } from '../match/match';
import { Leaderboard } from '../leaderboard/leaderboard';
import { PixelPanel } from '../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelButton } from '../shared/pixel-ui/pixel-button/pixel-button';
import { PixelQuestionStats, type QuestionStatRow } from '../shared/pixel-ui/pixel-question-stats/pixel-question-stats';

interface EndedLeaderboardRow {
  playerId: string;
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
  imports: [Lobby, Match, Leaderboard, DecimalPipe, PixelPanel, PixelButton, PixelQuestionStats],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  protected readonly socketService = inject(SocketService);

  /**
   * Combines match:ended's `leaderboard` (name/score) and `placements`
   * (final rank/height) by playerId into the same shape the historical
   * match-detail page shows, so the live end screen and the persisted one
   * look identical — see match-history/match-detail.
   */
  protected get endedLeaderboardRows(): EndedLeaderboardRow[] {
    const byPlayerId = new Map(this.socketService.leaderboard().map((entry) => [entry.playerId, entry]));
    return this.socketService.finalPlacements().map((placement) => {
      const entry = byPlayerId.get(placement.playerId);
      return {
        playerId: placement.playerId,
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
}
