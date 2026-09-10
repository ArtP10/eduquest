import type { PoolClient } from 'pg';
import { getPool } from '../db.js';
import type { QuizRecord } from '../quiz-builder/quizzes.js';
import type { QuestionRecord } from '../quiz-builder/questions.js';
import type { GeneratedQuestion } from './gemini-client.js';

/**
 * Inserts a draft quiz plus all its generated questions in a single
 * transaction, in the identical shape `createQuiz`/`createQuestion`
 * (quiz-builder) produce — same tables, same columns, no AI-specific flag.
 * `createQuiz`/`createQuestion` themselves run each query against the pool
 * directly, so they can't participate in a shared transaction; these mirror
 * their exact INSERTs against a single checked-out `PoolClient` instead, and
 * roll back entirely if any insert fails, per spec's "No Partial State on
 * Failure" requirement.
 */
export async function createGeneratedQuiz(params: {
  title: string;
  authorId: string;
  questions: GeneratedQuestion[];
}): Promise<{ quiz: QuizRecord; questions: QuestionRecord[] }> {
  const pool = getPool();
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: quizRows } = await client.query(
      `INSERT INTO quizzes (title, author_id, status) VALUES ($1, $2, 'draft') RETURNING *`,
      [params.title, params.authorId]
    );
    const quizRow = quizRows[0];

    const questionRows: QuestionRecord[] = [];
    for (let index = 0; index < params.questions.length; index++) {
      const q = params.questions[index]!;
      const { rows } = await client.query(
        `INSERT INTO questions (quiz_id, question_text, choices, correct_choice, order_index)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [quizRow.id, q.questionText, JSON.stringify(q.choices), q.correctChoice, index]
      );
      questionRows.push(rowToQuestion(rows[0]));
    }

    await client.query('COMMIT');
    return { quiz: rowToQuiz(quizRow), questions: questionRows };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function rowToQuiz(row: any): QuizRecord {
  return {
    id: row.id,
    title: row.title,
    authorId: row.author_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSample: row.is_sample
  };
}

function rowToQuestion(row: any): QuestionRecord {
  return {
    id: row.id,
    quizId: row.quiz_id,
    questionText: row.question_text,
    choices: row.choices,
    correctChoice: row.correct_choice,
    orderIndex: row.order_index
  };
}
