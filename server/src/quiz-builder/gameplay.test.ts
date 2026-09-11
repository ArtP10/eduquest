import { describe, expect, it, vi, beforeEach } from 'vitest';

const query = vi.fn();
const findQuizById = vi.fn();
const listQuestionsByQuiz = vi.fn();

vi.mock('../db.js', () => ({ getPool: () => ({ query }) }));
vi.mock('./quizzes.js', () => ({ findQuizById: (...args: unknown[]) => findQuizById(...args) }));
vi.mock('./questions.js', () => ({ listQuestionsByQuiz: (...args: unknown[]) => listQuestionsByQuiz(...args) }));

const { resolveQuizForRoom } = await import('./gameplay.js');

const publishedQuiz = { id: 'quiz-1', title: 'Algebra', authorId: 'author-1', status: 'published', isSample: false };
const sampleQuiz = { id: 'sample-1', title: 'Cultura General', authorId: null, status: 'draft', isSample: true };

beforeEach(() => {
  query.mockReset();
  findQuizById.mockReset();
  listQuestionsByQuiz.mockReset();
});

describe('resolveQuizForRoom', () => {
  it('increments play_count by exactly 1 when a published quiz is selected', async () => {
    findQuizById.mockResolvedValue(publishedQuiz);
    listQuestionsByQuiz.mockResolvedValue([
      { questionText: 'Q1', choices: ['a', 'b', 'c', 'd'], correctChoice: 0 }
    ]);
    query.mockResolvedValue({ rows: [] });

    await resolveQuizForRoom('quiz-1');

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('UPDATE quizzes SET play_count = play_count + 1 WHERE id = $1', ['quiz-1']);
  });

  it('does not increment again for additional joins — increment happens once per room, at resolution time only', async () => {
    findQuizById.mockResolvedValue(publishedQuiz);
    listQuestionsByQuiz.mockResolvedValue([]);
    query.mockResolvedValue({ rows: [] });

    await resolveQuizForRoom('quiz-1');
    // Player joins never call resolveQuizForRoom again — simulated here by
    // just asserting the single call from the one resolution above.
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not increment play_count for a sample quiz resolved by id', async () => {
    findQuizById.mockResolvedValue(sampleQuiz);
    listQuestionsByQuiz.mockResolvedValue([
      { questionText: 'Q1', choices: ['a', 'b', 'c', 'd'], correctChoice: 0 }
    ]);

    const result = await resolveQuizForRoom('sample-1');

    expect(result).toEqual(expect.objectContaining({ id: 'sample-1', title: 'Cultura General' }));
    expect(query).not.toHaveBeenCalled();
  });

  it('still returns the resolved quiz if the play_count increment itself fails', async () => {
    findQuizById.mockResolvedValue(publishedQuiz);
    listQuestionsByQuiz.mockResolvedValue([]);
    query.mockRejectedValue(new Error('connection lost'));

    const result = await resolveQuizForRoom('quiz-1');

    expect(result).toEqual(expect.objectContaining({ id: 'quiz-1' }));
  });

  it('throws when the quiz id does not resolve to any quiz', async () => {
    findQuizById.mockResolvedValue(null);

    await expect(resolveQuizForRoom('unknown-id')).rejects.toThrow();
  });

  it('throws when the quiz id resolves to a draft quiz that is not a sample', async () => {
    findQuizById.mockResolvedValue({ id: 'draft-1', title: 'Unpublished', status: 'draft', isSample: false });

    await expect(resolveQuizForRoom('draft-1')).rejects.toThrow();
  });

  it('throws when Postgres is unreachable', async () => {
    findQuizById.mockRejectedValue(new Error('connection lost'));

    await expect(resolveQuizForRoom('quiz-1')).rejects.toThrow();
  });
});
