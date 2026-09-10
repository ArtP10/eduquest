import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type PublishedQuizSort = 'popular' | 'newest';

export interface PublishedQuizCard {
  id: string;
  title: string;
  authorUsername: string;
  questionCount: number;
  tags: string[];
  playCount: number;
  averageGrade: number | null;
}

export interface Tag {
  id: string;
  name: string;
}

export interface ListPublishedParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  sort?: PublishedQuizSort;
}

export interface PublishedQuizPage {
  quizzes: PublishedQuizCard[];
  page: number;
  limit: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class QuizLibraryService {
  private readonly http = inject(HttpClient);

  async listPublished(params: ListPublishedParams = {}): Promise<PublishedQuizPage> {
    let httpParams: Record<string, string> = {};
    if (params.page) httpParams['page'] = String(params.page);
    if (params.limit) httpParams['limit'] = String(params.limit);
    if (params.search) httpParams['search'] = params.search;
    if (params.tags && params.tags.length > 0) httpParams['tags'] = params.tags.join(',');
    if (params.sort) httpParams['sort'] = params.sort;

    return firstValueFrom(this.http.get<PublishedQuizPage>(`${environment.apiUrl}/quizzes/published`, { params: httpParams }));
  }

  async listTags(): Promise<Tag[]> {
    const res = await firstValueFrom(this.http.get<{ tags: Tag[] }>(`${environment.apiUrl}/tags`));
    return res.tags;
  }
}
