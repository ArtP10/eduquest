export type QuestionValidationResult =
  | { ok: true; questionText: string; choices: [string, string, string, string]; correctChoice: 0 | 1 | 2 | 3 }
  | { ok: false; error: string };

/** Shared by question create and edit — same rules for both, per spec. */
export function validateQuestionInput(body: unknown): QuestionValidationResult {
  const { questionText, choices, correctChoice } = (body ?? {}) as {
    questionText?: unknown;
    choices?: unknown;
    correctChoice?: unknown;
  };

  if (typeof questionText !== 'string' || !questionText.trim()) {
    return { ok: false, error: 'Question text is required.' };
  }

  if (!Array.isArray(choices) || choices.length !== 4 || !choices.every((c) => typeof c === 'string' && c.trim())) {
    return { ok: false, error: 'Exactly four non-empty choices are required.' };
  }

  if (typeof correctChoice !== 'number' || !Number.isInteger(correctChoice) || correctChoice < 0 || correctChoice > 3) {
    return { ok: false, error: 'Exactly one correct choice (0-3) is required.' };
  }

  return {
    ok: true,
    questionText: questionText.trim(),
    choices: choices.map((c) => (c as string).trim()) as [string, string, string, string],
    correctChoice: correctChoice as 0 | 1 | 2 | 3
  };
}
