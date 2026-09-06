import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type QuizStatus = 'draft' | 'published';

export interface QuizSummary {
  id: string;
  title: string;
  authorId: string;
  status: QuizStatus;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionSummary {
  id: string;
  quizId: string;
  questionText: string;
  choices: [string, string, string, string];
  correctChoice: 0 | 1 | 2 | 3;
  orderIndex: number;
}

export interface AvailableQuiz {
  id: string;
  title: string;
}

export type QuizBuilderResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface QuestionInput {
  questionText: string;
  choices: [string, string, string, string];
  correctChoice: 0 | 1 | 2 | 3;
}

@Injectable({ providedIn: 'root' })
export class QuizBuilderService {
  private readonly http = inject(HttpClient);

  async createQuiz(title: string): Promise<QuizBuilderResult<QuizSummary>> {
    return this.mutate(() => firstValueFrom(this.http.post<{ quiz: QuizSummary }>(`${environment.apiUrl}/quizzes`, { title })).then((r) => r.quiz));
  }

  async listMine(): Promise<QuizSummary[]> {
    const res = await firstValueFrom(this.http.get<{ quizzes: QuizSummary[] }>(`${environment.apiUrl}/quizzes/mine`));
    return res.quizzes;
  }

  async getQuiz(id: string): Promise<{ quiz: QuizSummary; questions: QuestionSummary[] } | null> {
    try {
      return await firstValueFrom(this.http.get<{ quiz: QuizSummary; questions: QuestionSummary[] }>(`${environment.apiUrl}/quizzes/${id}`));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) return null;
      throw err;
    }
  }

  async updateQuiz(id: string, patch: { title?: string; status?: QuizStatus }): Promise<QuizBuilderResult<QuizSummary>> {
    return this.mutate(() =>
      firstValueFrom(this.http.patch<{ quiz: QuizSummary }>(`${environment.apiUrl}/quizzes/${id}`, patch)).then((r) => r.quiz)
    );
  }

  async addQuestion(quizId: string, input: QuestionInput): Promise<QuizBuilderResult<QuestionSummary>> {
    return this.mutate(() =>
      firstValueFrom(this.http.post<{ question: QuestionSummary }>(`${environment.apiUrl}/quizzes/${quizId}/questions`, input)).then(
        (r) => r.question
      )
    );
  }

  async updateQuestion(id: string, input: QuestionInput): Promise<QuizBuilderResult<QuestionSummary>> {
    return this.mutate(() =>
      firstValueFrom(this.http.patch<{ question: QuestionSummary }>(`${environment.apiUrl}/questions/${id}`, input)).then((r) => r.question)
    );
  }

  async deleteQuestion(id: string): Promise<QuizBuilderResult<void>> {
    return this.mutate(() => firstValueFrom(this.http.delete(`${environment.apiUrl}/questions/${id}`)).then(() => undefined));
  }

  /** Feeds the room-creation quiz picker (mock + published) — degrades gracefully server-side if Postgres is down, see server design.md decision 7. */
  async listAvailable(): Promise<AvailableQuiz[]> {
    const res = await firstValueFrom(this.http.get<{ quizzes: AvailableQuiz[] }>(`${environment.apiUrl}/quizzes/available`));
    return res.quizzes;
  }

  private async mutate<T>(fn: () => Promise<T>): Promise<QuizBuilderResult<T>> {
    try {
      return { ok: true, data: await fn() };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err) };
    }
  }
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: string } | undefined;
    if (body?.error) return body.error;
    if (err.status === 0) return 'Could not reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
