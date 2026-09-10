import { ApiError, GoogleGenAI, Type, type ThinkingLevel } from '@google/genai';
import { config } from '../config.js';

export interface GeneratedQuestion {
  questionText: string;
  choices: [string, string, string, string];
  correctChoice: 0 | 1 | 2 | 3;
}

// Bounded structured extraction (map source text to a fixed question shape),
// not multi-step agentic reasoning — see design.md decision 6/4.
const MODEL = 'gemini-3.8-flash';
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const REQUEST_TIMEOUT_MS = 45_000;

// 429 (rate limit) and 5xx are worth retrying against the same model; 4xx
// other than 429 (bad request, auth) never will be, so they fail immediately.
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question_text: { type: Type.STRING },
      choices: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        minItems: '4',
        maxItems: '4'
      },
      correct_choice: { type: Type.INTEGER }
    },
    required: ['question_text', 'choices', 'correct_choice']
  }
};

function buildPrompt(sourceText: string, questionCount: number): string {
  return [
    'You generate multiple-choice quiz questions from study material.',
    `Generate exactly ${questionCount} questions based only on the source material below.`,
    'Each question must have exactly four answer choices and exactly one correct choice (its 0-based index into the choices array).',
    'Questions must be answerable from the source material alone and cover distinct points from it.',
    '',
    'Source material:',
    '"""',
    sourceText,
    '"""'
  ].join('\n');
}

class GeminiGenerationError extends Error {}

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError) return RETRYABLE_STATUS_CODES.has(err.status);
  const code = (err as { code?: string } | null)?.code;
  return code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNABORTED';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAndValidate(raw: string, questionCount: number): GeneratedQuestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GeminiGenerationError('The AI response was not valid JSON.');
  }

  if (!Array.isArray(parsed) || parsed.length !== questionCount) {
    const gotCount = Array.isArray(parsed) ? parsed.length : 'a non-array response';
    throw new GeminiGenerationError(`Expected ${questionCount} generated questions, got ${gotCount}.`);
  }

  return parsed.map((item, index) => {
    const { question_text, choices, correct_choice } = (item ?? {}) as {
      question_text?: unknown;
      choices?: unknown;
      correct_choice?: unknown;
    };

    if (typeof question_text !== 'string' || !question_text.trim()) {
      throw new GeminiGenerationError(`Generated question ${index + 1} is missing its text.`);
    }
    if (!Array.isArray(choices) || choices.length !== 4 || !choices.every((c) => typeof c === 'string' && c.trim())) {
      throw new GeminiGenerationError(`Generated question ${index + 1} does not have exactly four non-empty choices.`);
    }
    if (
      typeof correct_choice !== 'number' ||
      !Number.isInteger(correct_choice) ||
      correct_choice < 0 ||
      correct_choice > 3
    ) {
      throw new GeminiGenerationError(`Generated question ${index + 1} has an invalid correct choice.`);
    }

    return {
      questionText: question_text.trim(),
      choices: choices.map((c) => (c as string).trim()) as [string, string, string, string],
      correctChoice: correct_choice as 0 | 1 | 2 | 3
    };
  });
}

/**
 * Sends only `sourceText` (never a raw file) to Gemini and returns exactly
 * `questionCount` validated questions, or throws. Retries transient errors
 * with exponential backoff against the same model — never falls back to a
 * different model, per spec.
 */
export async function generateQuestions(sourceText: string, questionCount: number): Promise<GeneratedQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildPrompt(sourceText, questionCount),
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel: config.geminiThinkingLevel as ThinkingLevel },
          httpOptions: { timeout: REQUEST_TIMEOUT_MS }
        }
      });

      const text = response.text;
      if (!text) {
        throw new GeminiGenerationError('The AI returned an empty response.');
      }
      return parseAndValidate(text, questionCount);
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === MAX_ATTEMPTS) break;
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Quiz generation failed.');
}
