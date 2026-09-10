import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

process.env['JWT_SECRET'] = 'test-secret';

const extractPdfText = vi.fn();
const generateQuestions = vi.fn();
const createGeneratedQuiz = vi.fn();

vi.mock('./pdf.js', () => ({ extractPdfText: (...args: unknown[]) => extractPdfText(...args) }));
vi.mock('./gemini-client.js', () => ({ generateQuestions: (...args: unknown[]) => generateQuestions(...args) }));
vi.mock('./persistence.js', () => ({ createGeneratedQuiz: (...args: unknown[]) => createGeneratedQuiz(...args) }));

const { quizGenerationRouter } = await import('./routes.js');
const { signAccessToken } = await import('../auth/jwt.js');

const app = express();
app.use(express.json());
app.use(quizGenerationRouter);
const server = createServer(app);

let baseUrl: string;

beforeEach(() => {
  extractPdfText.mockReset();
  generateQuestions.mockReset();
  createGeneratedQuiz.mockReset();
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

function makePdfFormData(questionCount: string | number): FormData {
  const form = new FormData();
  form.append('pdf', new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }), 'notes.pdf');
  form.append('questionCount', String(questionCount));
  return form;
}

const token = signAccessToken('user-123');

describe('POST /quizzes/generate', () => {
  it('rejects an unauthenticated request and performs no work', async () => {
    const res = await fetch(`${baseUrl}/quizzes/generate`, { method: 'POST', body: makePdfFormData(10) });
    expect(res.status).toBe(401);
    expect(extractPdfText).not.toHaveBeenCalled();
    expect(createGeneratedQuiz).not.toHaveBeenCalled();
  });

  it('rejects an invalid question count before extracting or calling Gemini', async () => {
    const res = await fetch(`${baseUrl}/quizzes/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: makePdfFormData(12)
    });
    expect(res.status).toBe(400);
    expect(extractPdfText).not.toHaveBeenCalled();
    expect(generateQuestions).not.toHaveBeenCalled();
    expect(createGeneratedQuiz).not.toHaveBeenCalled();
  });

  it('rejects when extracted text is empty/too short and creates nothing', async () => {
    extractPdfText.mockResolvedValue({ ok: false, error: 'too short' });
    const res = await fetch(`${baseUrl}/quizzes/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: makePdfFormData(10)
    });
    expect(res.status).toBe(400);
    expect(generateQuestions).not.toHaveBeenCalled();
    expect(createGeneratedQuiz).not.toHaveBeenCalled();
  });

  it('returns a clean error and creates nothing when Gemini fails', async () => {
    extractPdfText.mockResolvedValue({ ok: true, text: 'plenty of source text' });
    generateQuestions.mockRejectedValue(new Error('gemini exploded'));
    const res = await fetch(`${baseUrl}/quizzes/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: makePdfFormData(10)
    });
    expect(res.status).toBe(502);
    expect(createGeneratedQuiz).not.toHaveBeenCalled();
  });

  it('creates one quiz with N questions on the happy path', async () => {
    extractPdfText.mockResolvedValue({ ok: true, text: 'plenty of source text' });
    const questions = Array.from({ length: 10 }, (_, i) => ({
      questionText: `Q${i}`,
      choices: ['a', 'b', 'c', 'd'],
      correctChoice: 0
    }));
    generateQuestions.mockResolvedValue(questions);
    createGeneratedQuiz.mockResolvedValue({
      quiz: { id: 'quiz-1', title: 'notes', authorId: 'user-123', status: 'draft' },
      questions
    });

    const res = await fetch(`${baseUrl}/quizzes/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: makePdfFormData(10)
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { quiz: { id: string }; questions: unknown[] };
    expect(body.quiz.id).toBe('quiz-1');
    expect(body.questions).toHaveLength(10);
    expect(createGeneratedQuiz).toHaveBeenCalledTimes(1);
    expect(createGeneratedQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'user-123', questions })
    );
  });
});
