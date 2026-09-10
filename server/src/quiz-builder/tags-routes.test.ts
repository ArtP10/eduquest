import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

process.env['JWT_SECRET'] = 'test-secret';

const findOrCreateTag = vi.fn();
const attachTag = vi.fn();
const detachTag = vi.fn();
const requireQuizOwnershipImpl = vi.fn();

vi.mock('../quiz-library/tags.js', () => ({
  findOrCreateTag: (...args: unknown[]) => findOrCreateTag(...args),
  listTagsForQuiz: vi.fn().mockResolvedValue([])
}));
vi.mock('./quiz-tags.js', () => ({
  attachTag: (...args: unknown[]) => attachTag(...args),
  detachTag: (...args: unknown[]) => detachTag(...args)
}));
vi.mock('./ownership.js', () => ({
  requireQuizOwnership: (req: any, res: any, next: any) => requireQuizOwnershipImpl(req, res, next),
  requireQuestionOwnership: vi.fn()
}));
vi.mock('./quizzes.js', () => ({
  createQuiz: vi.fn(),
  findQuizById: vi.fn(),
  listQuizzesByAuthor: vi.fn(),
  updateQuiz: vi.fn()
}));
vi.mock('./questions.js', () => ({
  createQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  listQuestionsByQuiz: vi.fn(),
  updateQuestion: vi.fn()
}));

const { quizBuilderRouter } = await import('./routes.js');
const { signAccessToken } = await import('../auth/jwt.js');

const app = express();
app.use(express.json());
app.use(quizBuilderRouter);
const server = createServer(app);

let baseUrl: string;
const token = signAccessToken('author-1');

beforeEach(() => {
  findOrCreateTag.mockReset();
  attachTag.mockReset();
  detachTag.mockReset();
  requireQuizOwnershipImpl.mockReset();
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

function allowOwnership(quiz: { id: string; status: string; authorId: string }): void {
  requireQuizOwnershipImpl.mockImplementation((req: any, _res: any, next: any) => {
    req.quiz = quiz;
    next();
  });
}

function denyOwnership(): void {
  requireQuizOwnershipImpl.mockImplementation((_req: any, res: any) => {
    res.status(403).json({ error: 'You do not own this quiz.' });
  });
}

describe('POST /quizzes/:id/tags', () => {
  it('adds a tag on a draft quiz owned by the author', async () => {
    allowOwnership({ id: 'quiz-1', status: 'draft', authorId: 'author-1' });
    findOrCreateTag.mockResolvedValue({ id: 'tag-1', name: 'math' });

    const res = await fetch(`${baseUrl}/quizzes/quiz-1/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Math' })
    });

    expect(res.status).toBe(201);
    expect(findOrCreateTag).toHaveBeenCalledWith('Math');
    expect(attachTag).toHaveBeenCalledWith('quiz-1', 'tag-1');
  });

  it('adds a tag on a published quiz owned by the author', async () => {
    allowOwnership({ id: 'quiz-1', status: 'published', authorId: 'author-1' });
    findOrCreateTag.mockResolvedValue({ id: 'tag-1', name: 'math' });

    const res = await fetch(`${baseUrl}/quizzes/quiz-1/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'math' })
    });

    expect(res.status).toBe(201);
    expect(attachTag).toHaveBeenCalledWith('quiz-1', 'tag-1');
  });

  it('reuses an existing tag that differs only by case', async () => {
    allowOwnership({ id: 'quiz-1', status: 'draft', authorId: 'author-1' });
    findOrCreateTag.mockResolvedValue({ id: 'tag-1', name: 'math' });

    await fetch(`${baseUrl}/quizzes/quiz-1/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MATH' })
    });

    expect(attachTag).toHaveBeenCalledWith('quiz-1', 'tag-1');
  });

  it('rejects a non-author with 403 and attaches nothing', async () => {
    denyOwnership();

    const res = await fetch(`${baseUrl}/quizzes/quiz-1/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'math' })
    });

    expect(res.status).toBe(403);
    expect(attachTag).not.toHaveBeenCalled();
  });

  it('rejects an empty tag name', async () => {
    allowOwnership({ id: 'quiz-1', status: 'draft', authorId: 'author-1' });

    const res = await fetch(`${baseUrl}/quizzes/quiz-1/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' })
    });

    expect(res.status).toBe(400);
    expect(findOrCreateTag).not.toHaveBeenCalled();
  });
});

describe('DELETE /quizzes/:id/tags/:tagId', () => {
  it('removes the tag association for the author', async () => {
    allowOwnership({ id: 'quiz-1', status: 'draft', authorId: 'author-1' });

    const res = await fetch(`${baseUrl}/quizzes/quiz-1/tags/tag-1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(res.status).toBe(200);
    expect(detachTag).toHaveBeenCalledWith('quiz-1', 'tag-1');
  });

  it('rejects a non-author with 403 and detaches nothing', async () => {
    denyOwnership();

    const res = await fetch(`${baseUrl}/quizzes/quiz-1/tags/tag-1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(res.status).toBe(403);
    expect(detachTag).not.toHaveBeenCalled();
  });
});
