import type { Quiz, QuizQuestion } from '../../../shared/quiz.js';
import { getQuizById, loadQuizzes, pickRandomQuiz } from '../quizzes.js';
import { listPublishedQuizzes, findQuizById } from './quizzes.js';
import { listQuestionsByQuiz } from './questions.js';
import type { QuestionRecord } from './questions.js';
import type { QuizRecord } from './quizzes.js';

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
 * Merges the hardcoded mock quizzes with published builder quizzes. Falls
 * back to mock-only if Postgres is unreachable rather than throwing — room
 * creation must never depend on the database (see design.md decision 7).
 */
export async function listAvailableQuizzes(): Promise<Quiz[]> {
  const mock = loadQuizzes();
  try {
    const published = await listPublishedQuizzes();
    const converted = await Promise.all(
      published.map(async (quiz) => toEngineQuiz(quiz, await listQuestionsByQuiz(quiz.id)))
    );
    return [...mock, ...converted];
  } catch {
    return mock;
  }
}

/**
 * Resolves a room's quiz from an optional client-selected id: a mock quiz
 * id, a published builder quiz id, or — if omitted, unresolvable, or the DB
 * is unreachable — a random mock quiz (today's behavior). Quiz selection
 * can never block room creation.
 */
export async function resolveQuizForRoom(quizId?: string): Promise<Quiz> {
  if (!quizId) return pickRandomQuiz();

  const mockQuiz = getQuizById(quizId);
  if (mockQuiz) return mockQuiz;

  try {
    const quiz = await findQuizById(quizId);
    if (quiz && quiz.status === 'published') {
      const questions = await listQuestionsByQuiz(quiz.id);
      return toEngineQuiz(quiz, questions);
    }
  } catch {
    // DB unreachable or lookup failed — fall through to the random fallback.
  }

  return pickRandomQuiz();
}
