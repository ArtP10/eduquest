import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const listPublishedQuizzes = vi.fn();
const listTags = vi.fn();

vi.mock('./published-quizzes.js', () => ({ listPublishedQuizzes: (...args: unknown[]) => listPublishedQuizzes(...args) }));
vi.mock('./tags.js', () => ({ listTags: (...args: unknown[]) => listTags(...args) }));

const { quizLibraryRouter } = await import('./routes.js');

const app = express();
app.use(quizLibraryRouter);
const server = createServer(app);

let baseUrl: string;

beforeEach(() => {
  listPublishedQuizzes.mockReset();
  listTags.mockReset();
});

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

beforeAll(async () => {
  await startServer();
});

afterAll(() => {
  server.close();
});

const sampleQuiz = {
  id: 'quiz-1',
  title: 'Algebra basics',
  authorUsername: 'ana',
  questionCount: 5,
  tags: ['math'],
  playCount: 3
};

describe('GET /quizzes/published', () => {
  it('succeeds without authentication', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [sampleQuiz], total: 1 });
    const res = await fetch(`${baseUrl}/quizzes/published`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { quizzes: unknown[] };
    expect(body.quizzes).toHaveLength(1);
  });

  it('defaults to newest sort with no filters', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [], total: 0 });
    await fetch(`${baseUrl}/quizzes/published`);
    expect(listPublishedQuizzes).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, search: undefined, tags: undefined, sort: undefined })
    );
  });

  it('passes through search', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [sampleQuiz], total: 1 });
    await fetch(`${baseUrl}/quizzes/published?search=algebra`);
    expect(listPublishedQuizzes).toHaveBeenCalledWith(expect.objectContaining({ search: 'algebra' }));
  });

  it('parses a single tag filter', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [sampleQuiz], total: 1 });
    await fetch(`${baseUrl}/quizzes/published?tags=math`);
    expect(listPublishedQuizzes).toHaveBeenCalledWith(expect.objectContaining({ tags: ['math'] }));
  });

  it('parses multiple comma-separated tags (match-any)', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [], total: 0 });
    await fetch(`${baseUrl}/quizzes/published?tags=math,science`);
    expect(listPublishedQuizzes).toHaveBeenCalledWith(expect.objectContaining({ tags: ['math', 'science'] }));
  });

  it('accepts sort=popular', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [], total: 0 });
    await fetch(`${baseUrl}/quizzes/published?sort=popular`);
    expect(listPublishedQuizzes).toHaveBeenCalledWith(expect.objectContaining({ sort: 'popular' }));
  });

  it('rejects an unrecognized sort value rather than passing it through', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [], total: 0 });
    await fetch(`${baseUrl}/quizzes/published?sort=drop table quizzes`);
    expect(listPublishedQuizzes).toHaveBeenCalledWith(expect.objectContaining({ sort: undefined }));
  });

  it('combines search, tags, and sort in one request', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [], total: 0 });
    await fetch(`${baseUrl}/quizzes/published?search=algebra&tags=math,science&sort=popular`);
    expect(listPublishedQuizzes).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'algebra', tags: ['math', 'science'], sort: 'popular' })
    );
  });

  it('clamps page/limit to sane bounds', async () => {
    listPublishedQuizzes.mockResolvedValue({ quizzes: [], total: 0 });
    await fetch(`${baseUrl}/quizzes/published?page=0&limit=9999`);
    expect(listPublishedQuizzes).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
  });
});

describe('GET /tags', () => {
  it('succeeds without authentication and returns the full catalog', async () => {
    listTags.mockResolvedValue([{ id: 'tag-1', name: 'math' }]);
    const res = await fetch(`${baseUrl}/tags`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tags: unknown[] };
    expect(body.tags).toEqual([{ id: 'tag-1', name: 'math' }]);
  });
});
