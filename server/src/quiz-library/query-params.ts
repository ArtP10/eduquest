import type { PublishedQuizSort } from './published-quizzes.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SORT_ALLOWLIST = new Set<PublishedQuizSort>(['popular', 'newest']);

export interface ParsedListParams {
  page: number;
  limit: number;
  search?: string;
  tags?: string[];
  sort?: PublishedQuizSort;
}

/** Parses and clamps GET /quizzes/published's query params; never throws on bad input, just falls back to safe defaults. */
export function parseListParams(query: Record<string, unknown>): ParsedListParams {
  const page = Math.max(1, Number.parseInt(String(query['page'] ?? '1'), 10) || 1);
  const rawLimit = Number.parseInt(String(query['limit'] ?? String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));

  const search = typeof query['search'] === 'string' && query['search'].trim() ? query['search'].trim() : undefined;

  const tagsRaw = query['tags'];
  const tags =
    typeof tagsRaw === 'string' && tagsRaw.trim()
      ? tagsRaw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : undefined;

  const sortRaw = typeof query['sort'] === 'string' ? (query['sort'] as PublishedQuizSort) : undefined;
  const sort = sortRaw && SORT_ALLOWLIST.has(sortRaw) ? sortRaw : undefined;

  return { page, limit, search, tags, sort };
}
