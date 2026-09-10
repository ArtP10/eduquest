import type { Quiz, QuizQuestion } from '@quizjumper/shared/quiz';
import { getQuizById, pickRandomQuiz } from '../quizzes.js';
import { findQuizById } from './quizzes.js';
import { listQuestionsByQuiz } from './questions.js';
import type { QuestionRecord } from './questions.js';
import type { QuizRecord } from './quizzes.js';
import { getPool } from '../db.js';

// Timer/choice-count are fixed system-wide constants this phase (see
// proposal's explicit non-goal: no per-question configuration) — the
// question schema has no column for this, so it's injected here, the one
// place a builder quiz is converted into the engine's shape. Matches the
// value every mock quiz question already hardcodes (server/src/quizzes.ts).
const QUESTION_SECONDS = 10;

function toEngineQuiz(quiz: QuizRecord, questions: QuestionRecord[]): Quiz {
  return {
    id: quiz.id,
    title: quiz.title,
    questions: questions.map(
      (q): QuizQuestion => ({
        text: q.questionText,
        choices: q.choices,
        correctIndex: q.correctChoice,
        seconds: QUESTION_SECONDS
      })
    )
  };
}

/**
 * Resolves a room's quiz from an optional client-selected id: a mock quiz
 * id, a published quiz id sourced from the Quiz Library, or — if omitted,
 * unresolvable, or the DB is unreachable — a random mock quiz (today's
 * behavior). Quiz selection can never block room creation. When a published
 * quiz is resolved, its play_count is incremented by 1 for this room; a
 * failed increment falls through to the same catch as any other DB error
 * without blocking the resolved quiz from being returned (see design.md
 * decision 5).
 */
export async function resolveQuizForRoom(quizId?: string): Promise<Quiz> {
  if (!quizId) return pickRandomQuiz();

  const mockQuiz = getQuizById(quizId);
  if (mockQuiz) return mockQuiz;

  try {
    const quiz = await findQuizById(quizId);
    if (quiz && quiz.status === 'published') {
      const questions = await listQuestionsByQuiz(quiz.id);
      const engineQuiz = toEngineQuiz(quiz, questions);
      try {
        await getPool().query('UPDATE quizzes SET play_count = play_count + 1 WHERE id = $1', [quiz.id]);
      } catch {
        // Play count is a popularity signal, not a correctness requirement —
        // a failed increment must never prevent the resolved quiz from being
        // returned (see design.md risk/trade-off).
      }
      return engineQuiz;
    }
  } catch {
    // DB unreachable or lookup failed — fall through to the random fallback.
  }

  return pickRandomQuiz();
}
