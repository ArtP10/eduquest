import { getPool } from '../db.js';

export type QuizStatus = 'draft' | 'published';

export interface QuizRecord {
  id: string;
  title: string;
  authorId: string;
  status: QuizStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface QuizRow {
  id: string;
  title: string;
  author_id: string;
  status: QuizStatus;
  created_at: Date;
  updated_at: Date;
}

function rowToQuiz(row: QuizRow): QuizRecord {
  return {
    id: row.id,
    title: row.title,
    authorId: row.author_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createQuiz(params: { title: string; authorId: string }): Promise<QuizRecord> {
  const { rows } = await getPool().query<QuizRow>(
    `INSERT INTO quizzes (title, author_id, status) VALUES ($1, $2, 'draft') RETURNING *`,
    [params.title, params.authorId]
  );
  return rowToQuiz(rows[0]!);
}

export async function findQuizById(id: string): Promise<QuizRecord | null> {
  const { rows } = await getPool().query<QuizRow>('SELECT * FROM quizzes WHERE id = $1', [id]);
  return rows[0] ? rowToQuiz(rows[0]) : null;
}

export async function listQuizzesByAuthor(authorId: string): Promise<QuizRecord[]> {
  const { rows } = await getPool().query<QuizRow>(
    'SELECT * FROM quizzes WHERE author_id = $1 ORDER BY updated_at DESC',
    [authorId]
  );
  return rows.map(rowToQuiz);
}

export async function listPublishedQuizzes(): Promise<QuizRecord[]> {
  const { rows } = await getPool().query<QuizRow>(
    `SELECT * FROM quizzes WHERE status = 'published' ORDER BY updated_at DESC`
  );
  return rows.map(rowToQuiz);
}

export async function updateQuiz(
  id: string,
  patch: { title?: string; status?: QuizStatus }
): Promise<QuizRecord> {
  const { rows } = await getPool().query<QuizRow>(
    `UPDATE quizzes
     SET title = COALESCE($2, title),
         status = COALESCE($3, status),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, patch.title ?? null, patch.status ?? null]
  );
  return rowToQuiz(rows[0]!);
}
