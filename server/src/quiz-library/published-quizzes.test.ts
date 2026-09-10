import { describe, expect, it, vi, beforeEach } from 'vitest';

const query = vi.fn();

vi.mock('../db.js', () => ({ getPool: () => ({ query }) }));

const { listPublishedQuizzes } = await import('./published-quizzes.js');

beforeEach(() => {
  query.mockReset();
});

function mockCountThenRows(count: number, rows: unknown[]): void {
  query.mockResolvedValueOnce({ rows: [{ count: String(count) }] });
  query.mockResolvedValueOnce({ rows });
}

describe('listPublishedQuizzes', () => {
  it('always filters to status = published, excluding drafts', async () => {
    mockCountThenRows(0, []);
    await listPublishedQuizzes({ page: 1, limit: 20 });
    const [countSql] = query.mock.calls[0]!;
    const [rowsSql] = query.mock.calls[1]!;
    expect(countSql).toContain(`q.status = 'published'`);
    expect(rowsSql).toContain(`q.status = 'published'`);
  });

  it('adds an ILIKE title condition when search is provided', async () => {
    mockCountThenRows(0, []);
    await listPublishedQuizzes({ page: 1, limit: 20, search: 'algebra' });
    const [countSql, countParams] = query.mock.calls[0]!;
    expect(countSql).toContain('q.title ILIKE');
    expect(countParams).toContain('%algebra%');
  });

  it('adds a tag-match-any EXISTS condition when tags are provided', async () => {
    mockCountThenRows(0, []);
    await listPublishedQuizzes({ page: 1, limit: 20, tags: ['math', 'science'] });
    const [countSql, countParams] = query.mock.calls[0]!;
    expect(countSql).toContain('EXISTS');
    expect(countSql).toContain('t2.name = ANY(');
    expect(countParams).toContainEqual(['math', 'science']);
  });

  it('orders by play_count desc for sort=popular', async () => {
    mockCountThenRows(0, []);
    await listPublishedQuizzes({ page: 1, limit: 20, sort: 'popular' });
    const [rowsSql] = query.mock.calls[1]!;
    expect(rowsSql).toContain('ORDER BY q.play_count DESC');
  });

  it('orders by created_at desc by default (newest)', async () => {
    mockCountThenRows(0, []);
    await listPublishedQuizzes({ page: 1, limit: 20 });
    const [rowsSql] = query.mock.calls[1]!;
    expect(rowsSql).toContain('ORDER BY q.created_at DESC');
  });

  it('combines search, tags, and sort into a single query', async () => {
    mockCountThenRows(0, []);
    await listPublishedQuizzes({ page: 1, limit: 20, search: 'algebra', tags: ['math'], sort: 'popular' });
    const [rowsSql] = query.mock.calls[1]!;
    expect(rowsSql).toContain('q.title ILIKE');
    expect(rowsSql).toContain('EXISTS');
    expect(rowsSql).toContain('ORDER BY q.play_count DESC');
  });

  it('applies limit/offset for pagination', async () => {
    mockCountThenRows(0, []);
    await listPublishedQuizzes({ page: 2, limit: 10 });
    const [, rowsParams] = query.mock.calls[1]!;
    expect(rowsParams).toEqual(expect.arrayContaining([10, 10]));
  });

  it('maps rows into card shape', async () => {
    mockCountThenRows(1, [
      {
        id: 'quiz-1',
        title: 'Algebra',
        author_username: 'ana',
        play_count: 5,
        question_count: '3',
        tags: ['math'],
        average_grade: '78'
      }
    ]);
    const { quizzes, total } = await listPublishedQuizzes({ page: 1, limit: 20 });
    expect(total).toBe(1);
    expect(quizzes).toEqual([
      { id: 'quiz-1', title: 'Algebra', authorUsername: 'ana', questionCount: 3, tags: ['math'], playCount: 5, averageGrade: 78 }
    ]);
  });

  it('maps a never-played quiz (null average_grade) to averageGrade: null', async () => {
    mockCountThenRows(1, [
      {
        id: 'quiz-2',
        title: 'Geometry',
        author_username: 'ana',
        play_count: 0,
        question_count: '2',
        tags: [],
        average_grade: null
      }
    ]);
    const { quizzes } = await listPublishedQuizzes({ page: 1, limit: 20 });
    expect(quizzes[0]!.averageGrade).toBeNull();
  });
});
