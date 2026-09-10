export type QuestionCountValidationResult = { ok: true; questionCount: number } | { ok: false; error: string };

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 50;
const STEP = 5;

/** Question count must be a multiple of 5 between 5 and 50 inclusive, per spec. */
export function validateQuestionCount(raw: unknown): QuestionCountValidationResult {
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: 'Question count must be a whole number.' };
  }
  if (value < MIN_QUESTIONS || value > MAX_QUESTIONS) {
    return { ok: false, error: `Question count must be between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}.` };
  }
  if (value % STEP !== 0) {
    return { ok: false, error: `Question count must be a multiple of ${STEP}.` };
  }
  return { ok: true, questionCount: value };
}
