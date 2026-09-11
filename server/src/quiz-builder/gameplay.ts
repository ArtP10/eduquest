import type { Quiz, QuizQuestion } from '@quizjumper/shared/quiz';
import { findQuizById } from './quizzes.js';
import { listQuestionsByQuiz } from './questions.js';
import type { QuestionRecord } from './questions.js';
import type { QuizRecord } from './quizzes.js';
import { getPool } from '../db.js';

// Timer/choice-count are fixed system-wide constants this phase (see
// proposal's explicit non-goal: no per-question configuration) — the
// question schema has no column for this, so it's injected here, the one
// place a builder quiz is converted into the engine's shape.
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
 * Resolves a room's quiz from a client-selected id: either a sample quiz
 * (is_sample = true) or a published quiz, both sourced from Postgres — a
 * client always supplies one, picked from the Quiz Library. Throws if the id
 * doesn't resolve to a playable quiz or the DB is unreachable. When a
 * published (non-sample) quiz is resolved, its play_count is incremented by
 * 1 for this room; a failed increment must not block the resolved quiz from
 * being returned (see design.md risk/trade-off).
 */
export async function resolveQuizForRoom(quizId: string): Promise<Quiz> {
  const quiz = await findQuizById(quizId);
  if (!quiz || !(quiz.isSample || quiz.status === 'published')) {
    throw new Error(`No playable quiz found for id "${quizId}"`);
  }

  const questions = await listQuestionsByQuiz(quiz.id);
  const engineQuiz = toEngineQuiz(quiz, questions);

  if (!quiz.isSample) {
    try {
      await getPool().query('UPDATE quizzes SET play_count = play_count + 1 WHERE id = $1', [quiz.id]);
    } catch {
      // Play count is a popularity signal, not a correctness requirement —
      // a failed increment must never prevent the resolved quiz from being
      // returned (see design.md risk/trade-off).
    }
  }

  return engineQuiz;
}
