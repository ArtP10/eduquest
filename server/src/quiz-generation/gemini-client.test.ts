import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  config: { geminiApiKey: 'test-key', geminiThinkingLevel: 'low' }
}));

const generateContent = vi.fn();

class FakeApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

class FakeGoogleGenAI {
  models = { generateContent };
}

vi.mock('@google/genai', () => ({
  GoogleGenAI: FakeGoogleGenAI,
  ApiError: FakeApiError,
  Type: { ARRAY: 'ARRAY', OBJECT: 'OBJECT', STRING: 'STRING', INTEGER: 'INTEGER' }
}));

const { generateQuestions } = await import('./gemini-client.js');

function validQuestionsJson(count: number): string {
  return JSON.stringify(
    Array.from({ length: count }, (_, i) => ({
      question_text: `Question ${i + 1}?`,
      choices: ['A', 'B', 'C', 'D'],
      correct_choice: 0
    }))
  );
}

beforeEach(() => {
  generateContent.mockReset();
});

describe('generateQuestions', () => {
  it('returns parsed questions on success', async () => {
    generateContent.mockResolvedValueOnce({ text: validQuestionsJson(5) });
    const result = await generateQuestions('some source text', 5);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ questionText: 'Question 1?', choices: ['A', 'B', 'C', 'D'], correctChoice: 0 });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('retries on a transient error and succeeds', async () => {
    generateContent
      .mockRejectedValueOnce(new FakeApiError(429, 'rate limited'))
      .mockResolvedValueOnce({ text: validQuestionsJson(5) });
    const result = await generateQuestions('some source text', 5);
    expect(result).toHaveLength(5);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('fails after exhausting retries on persistent transient errors', async () => {
    generateContent.mockRejectedValue(new FakeApiError(503, 'unavailable'));
    await expect(generateQuestions('some source text', 5)).rejects.toThrow();
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('fails immediately on a malformed response without retrying', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify([{ question_text: 'Only one' }]) });
    await expect(generateQuestions('some source text', 5)).rejects.toThrow();
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-retryable client error', async () => {
    generateContent.mockRejectedValueOnce(new FakeApiError(400, 'bad request'));
    await expect(generateQuestions('some source text', 5)).rejects.toThrow();
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
