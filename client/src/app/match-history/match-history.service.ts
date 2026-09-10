import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MatchSummary {
  id: string;
  quizId: string;
  quizTitle: string;
  playedAt: string;
  isHost: boolean;
  finalScore: number;
  finalPlacement: number;
}

export interface MatchLeaderboardEntry {
  matchPlayerId: string;
  userId: string | null;
  nickname: string;
  finalScore: number;
  finalPlacement: number;
}

export interface MatchQuestionStats {
  questionIndex: number;
  correctCount: number;
  totalCount: number;
  percentCorrect: number;
}

export interface QuizGlobalStats {
  percentCorrect: number;
  averageGrade: number;
}

export interface MatchDetail {
  id: string;
  quizId: string;
  quizTitle: string;
  playedAt: string;
  roomCreatorId: string | null;
  leaderboard: MatchLeaderboardEntry[];
  questionStats: MatchQuestionStats[];
  quizGlobalStats: QuizGlobalStats | null;
}

export interface PlayerAnswerBreakdown {
  questionIndex: number;
  questionText: string;
  choices: [string, string, string, string];
  correctChoiceIndex: number;
  selectedChoiceIndex: number | null;
  isCorrect: boolean;
  answerTimeMs: number | null;
}

export type MatchDetailResult =
  | { ok: true; match: MatchDetail }
  | { ok: false; status: 403 | 404 | 'error' };

export type PlayerAnswersResult =
  | { ok: true; answers: PlayerAnswerBreakdown[] }
  | { ok: false; status: 403 | 404 | 'error' };

@Injectable({ providedIn: 'root' })
export class MatchHistoryService {
  private readonly http = inject(HttpClient);

  async listMine(): Promise<MatchSummary[]> {
    const res = await firstValueFrom(this.http.get<{ matches: MatchSummary[] }>(`${environment.apiUrl}/matches/mine`));
    return res.matches;
  }

  async getMatch(id: string): Promise<MatchDetailResult> {
    try {
      const res = await firstValueFrom(this.http.get<{ match: MatchDetail }>(`${environment.apiUrl}/matches/${id}`));
      return { ok: true, match: res.match };
    } catch (err) {
      if (err instanceof HttpErrorResponse && (err.status === 403 || err.status === 404)) {
        return { ok: false, status: err.status };
      }
      return { ok: false, status: 'error' };
    }
  }

  async getPlayerAnswers(matchId: string, matchPlayerId: string): Promise<PlayerAnswersResult> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ answers: PlayerAnswerBreakdown[] }>(`${environment.apiUrl}/matches/${matchId}/players/${matchPlayerId}/answers`)
      );
      return { ok: true, answers: res.answers };
    } catch (err) {
      if (err instanceof HttpErrorResponse && (err.status === 403 || err.status === 404)) {
        return { ok: false, status: err.status };
      }
      return { ok: false, status: 'error' };
    }
  }

  async getQuizStats(quizId: string): Promise<QuizGlobalStats | null> {
    const res = await firstValueFrom(this.http.get<{ stats: QuizGlobalStats | null }>(`${environment.apiUrl}/quizzes/${quizId}/stats`));
    return res.stats;
  }
}
