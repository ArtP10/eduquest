import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import {
  MatchHistoryService,
  type MatchDetail,
  type PlayerAnswerBreakdown
} from '../match-history.service';
import { PixelPanel } from '../../shared/pixel-ui/pixel-panel/pixel-panel';
import { PixelButton } from '../../shared/pixel-ui/pixel-button/pixel-button';
import { PixelQuestionStats } from '../../shared/pixel-ui/pixel-question-stats/pixel-question-stats';

@Component({
  selector: 'app-match-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, PixelPanel, PixelButton, PixelQuestionStats],
  templateUrl: './match-detail.html',
  styleUrl: './match-detail.scss'
})
export class MatchDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly matchHistoryService = inject(MatchHistoryService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly match = signal<MatchDetail | null>(null);

  readonly expandedMatchPlayerId = signal<string | null>(null);
  readonly answersByMatchPlayerId = signal<Record<string, PlayerAnswerBreakdown[]>>({});
  readonly drillDownLoading = signal<string | null>(null);
  readonly drillDownError = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  get isHost(): boolean {
    const match = this.match();
    const userId = this.authService.currentUser()?.id;
    return !!match && !!userId && match.roomCreatorId === userId;
  }

  canDrillDown(matchPlayerId: string, entryUserId: string | null): boolean {
    if (this.isHost) return true;
    const userId = this.authService.currentUser()?.id;
    return !!userId && entryUserId === userId;
  }

  get questionStatRows() {
    return (this.match()?.questionStats ?? []).map((s) => ({
      questionIndex: s.questionIndex,
      percentCorrect: s.percentCorrect,
      correctCount: s.correctCount,
      totalCount: s.totalCount
    }));
  }

  /** This player's own score across the whole match — a single overall percentage, not one per question (a per-question rate is meaningless for a single player: it's always 100% or 0%). */
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

    const match = this.match();
    if (!match) return;
    this.drillDownLoading.set(matchPlayerId);
    const result = await this.matchHistoryService.getPlayerAnswers(match.id, matchPlayerId);
    this.drillDownLoading.set(null);
    if (result.ok) {
      this.answersByMatchPlayerId.update((map) => ({ ...map, [matchPlayerId]: result.answers }));
    } else {
      this.drillDownError.set('No se pudieron cargar las respuestas de este jugador.');
    }
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loadError.set('Partida no encontrada.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    const result = await this.matchHistoryService.getMatch(id);
    this.loading.set(false);
    if (result.ok) {
      this.match.set(result.match);
      this.loadError.set(null);
    } else if (result.status === 403) {
      this.loadError.set('No participaste en esta partida.');
    } else if (result.status === 404) {
      this.loadError.set('Partida no encontrada.');
    } else {
      this.loadError.set('No se pudo cargar la partida. Por favor, intenta de nuevo.');
    }
  }
}
