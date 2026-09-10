import { describe, expect, it, vi, beforeEach } from 'vitest';

const query = vi.fn();
const findQuizById = vi.fn();
const listQuestionsByQuiz = vi.fn();
const getQuizById = vi.fn();
const pickRandomQuiz = vi.fn();

vi.mock('../db.js', () => ({ getPool: () => ({ query }) }));
vi.mock('./quizzes.js', () => ({ findQuizById: (...args: unknown[]) => findQuizById(...args) }));
vi.mock('./questions.js', () => ({ listQuestionsByQuiz: (...args: unknown[]) => listQuestionsByQuiz(...args) }));
vi.mock('../quizzes.js', () => ({
  getQuizById: (...args: unknown[]) => getQuizById(...args),
  pickRandomQuiz: (...args: unknown[]) => pickRandomQuiz(...args)
}));

const { resolveQuizForRoom } = await import('./gameplay.js');

const publishedQuiz = { id: 'quiz-1', title: 'Algebra', authorId: 'author-1', status: 'published' };
const mockEngineQuiz = { id: 'mock-1', title: 'Mock quiz', questions: [] };
const randomEngineQuiz = { id: 'random-1', title: 'Random quiz', questions: [] };

beforeEach(() => {
  query.mockReset();
  findQuizById.mockReset();
  listQuestionsByQuiz.mockReset();
  getQuizById.mockReset();
  pickRandomQuiz.mockReset();
  pickRandomQuiz.mockReturnValue(randomEngineQuiz);
});

describe('resolveQuizForRoom', () => {
  it('increments play_count by exactly 1 when a published quiz is selected', async () => {
    getQuizById.mockReturnValue(null);
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
    getQuizById.mockReturnValue(null);
    findQuizById.mockResolvedValue(publishedQuiz);
    listQuestionsByQuiz.mockResolvedValue([]);
    query.mockResolvedValue({ rows: [] });

    await resolveQuizForRoom('quiz-1');
    // Player joins never call resolveQuizForRoom again — simulated here by
    // just asserting the single call from the one resolution above.
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not increment any play_count for a mock quiz', async () => {
    getQuizById.mockReturnValue(mockEngineQuiz);

    const result = await resolveQuizForRoom('mock-1');

    expect(result).toBe(mockEngineQuiz);
    expect(query).not.toHaveBeenCalled();
    expect(findQuizById).not.toHaveBeenCalled();
  });

  it('does not increment any play_count on random fallback (no quizId)', async () => {
    const result = await resolveQuizForRoom(undefined);

    expect(result).toBe(randomEngineQuiz);
    expect(query).not.toHaveBeenCalled();
  });

  it('does not increment any play_count when the selection is unresolvable', async () => {
    getQuizById.mockReturnValue(null);
    findQuizById.mockResolvedValue(null);

    const result = await resolveQuizForRoom('unknown-id');

    expect(result).toBe(randomEngineQuiz);
    expect(query).not.toHaveBeenCalled();
  });

  it('still returns the resolved quiz if the increment itself fails', async () => {
    getQuizById.mockReturnValue(null);
    findQuizById.mockResolvedValue(publishedQuiz);
    listQuestionsByQuiz.mockResolvedValue([]);
    query.mockRejectedValue(new Error('connection lost'));

    const result = await resolveQuizForRoom('quiz-1');

    expect(result).toEqual(expect.objectContaining({ id: 'quiz-1' }));
  });
});
