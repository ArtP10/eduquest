import { getPool } from '../db.js';

export interface QuestionRecord {
  id: string;
  quizId: string;
  questionText: string;
  choices: [string, string, string, string];
  correctChoice: 0 | 1 | 2 | 3;
  orderIndex: number;
}

interface QuestionRow {
  id: string;
  quiz_id: string;
  question_text: string;
  choices: [string, string, string, string];
  correct_choice: 0 | 1 | 2 | 3;
  order_index: number;
}

function rowToQuestion(row: QuestionRow): QuestionRecord {
  return {
    id: row.id,
    quizId: row.quiz_id,
    questionText: row.question_text,
    choices: row.choices,
    correctChoice: row.correct_choice,
    orderIndex: row.order_index
  };
}

export async function createQuestion(params: {
  quizId: string;
  questionText: string;
  choices: [string, string, string, string];
  correctChoice: 0 | 1 | 2 | 3;
}): Promise<QuestionRecord> {
  const pool = getPool();
  // Single-author editing only this phase (see design.md decision 3) — a
  // plain COUNT is enough, no need for a DB sequence/trigger.
  const { rows: countRows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*) FROM questions WHERE quiz_id = $1',
    [params.quizId]
  );
  const orderIndex = Number(countRows[0]!.count);

  const { rows } = await pool.query<QuestionRow>(
    `INSERT INTO questions (quiz_id, question_text, choices, correct_choice, order_index)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.quizId, params.questionText, JSON.stringify(params.choices), params.correctChoice, orderIndex]
  );
  return rowToQuestion(rows[0]!);
}

export async function findQuestionById(id: string): Promise<QuestionRecord | null> {
  const { rows } = await getPool().query<QuestionRow>('SELECT * FROM questions WHERE id = $1', [id]);
  return rows[0] ? rowToQuestion(rows[0]) : null;
}

export async function listQuestionsByQuiz(quizId: string): Promise<QuestionRecord[]> {
  const { rows } = await getPool().query<QuestionRow>(
    'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_index ASC',
    [quizId]
  );
  return rows.map(rowToQuestion);
}

export async function updateQuestion(
  id: string,
  patch: { questionText: string; choices: [string, string, string, string]; correctChoice: 0 | 1 | 2 | 3 }
): Promise<QuestionRecord> {
  const { rows } = await getPool().query<QuestionRow>(
    `UPDATE questions
     SET question_text = $2, choices = $3, correct_choice = $4
     WHERE id = $1
     RETURNING *`,
    [id, patch.questionText, JSON.stringify(patch.choices), patch.correctChoice]
  );
  return rowToQuestion(rows[0]!);
}

export async function deleteQuestion(id: string): Promise<void> {
  await getPool().query('DELETE FROM questions WHERE id = $1', [id]);
}
