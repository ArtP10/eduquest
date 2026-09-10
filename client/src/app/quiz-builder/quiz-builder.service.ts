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

export interface Tag {
  id: string;
  name: string;
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

  async getQuiz(id: string): Promise<{ quiz: QuizSummary; questions: QuestionSummary[]; tags: Tag[] } | null> {
    try {
      return await firstValueFrom(
        this.http.get<{ quiz: QuizSummary; questions: QuestionSummary[]; tags: Tag[] }>(`${environment.apiUrl}/quizzes/${id}`)
      );
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

  /** Uploads a PDF for AI generation; returns the resulting draft quiz on success, ready to open in the same quiz editor as a manually-created quiz. */
  async generateFromPdf(file: File, questionCount: number): Promise<QuizBuilderResult<QuizSummary>> {
    const form = new FormData();
    form.append('pdf', file);
    form.append('questionCount', String(questionCount));
    return this.mutate(() =>
      firstValueFrom(this.http.post<{ quiz: QuizSummary }>(`${environment.apiUrl}/quizzes/generate`, form)).then((r) => r.quiz)
    );
  }

  async addTag(quizId: string, name: string): Promise<QuizBuilderResult<Tag>> {
    return this.mutate(() =>
      firstValueFrom(this.http.post<{ tag: Tag }>(`${environment.apiUrl}/quizzes/${quizId}/tags`, { name })).then((r) => r.tag)
    );
  }

  async removeTag(quizId: string, tagId: string): Promise<QuizBuilderResult<void>> {
    return this.mutate(() =>
      firstValueFrom(this.http.delete(`${environment.apiUrl}/quizzes/${quizId}/tags/${tagId}`)).then(() => undefined)
    );
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
    if (err.status === 0) return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  }
  return 'Algo salió mal. Por favor, intenta de nuevo.';
}
