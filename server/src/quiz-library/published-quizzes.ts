import { getPool } from '../db.js';

export type PublishedQuizSort = 'popular' | 'newest';

export interface PublishedQuizCard {
  id: string;
  title: string;
  authorUsername: string;
  questionCount: number;
  tags: string[];
  playCount: number;
  /** Aggregate percent-correct across every match this quiz has been played in (see match-history). Null if never played. */
  averageGrade: number | null;
}

interface PublishedQuizRow {
  id: string;
  title: string;
  author_username: string;
  question_count: string;
  tags: string[] | null;
  play_count: number;
  average_grade: string | null;
}

function rowToCard(row: PublishedQuizRow): PublishedQuizCard {
  return {
    id: row.id,
    title: row.title,
    authorUsername: row.author_username,
    questionCount: Number(row.question_count),
    tags: row.tags ?? [],
    playCount: row.play_count,
    averageGrade: row.average_grade !== null ? Math.round(Number(row.average_grade)) : null
  };
}

export interface ListPublishedQuizzesParams {
  page: number;
  limit: number;
  search?: string;
  tags?: string[];
  sort?: PublishedQuizSort;
}

const ORDER_BY_SQL: Record<PublishedQuizSort, string> = {
  popular: 'q.play_count DESC',
  newest: 'q.created_at DESC'
};

/**
 * Paginated published-quiz listing shaped for the card grid. Tag filtering
 * uses an EXISTS subquery (match-any) rather than joining quiz_tags/tags
 * into the WHERE clause directly, so it composes cleanly with the separate
 * LEFT JOIN used purely to aggregate each quiz's full tag list for display.
 * `sort` is resolved through an allowlisted map (ORDER_BY_SQL), never
 * string-interpolated from the request.
 */
export async function listPublishedQuizzes(
  params: ListPublishedQuizzesParams
): Promise<{ quizzes: PublishedQuizCard[]; total: number }> {
  const pool = getPool();
  const sort: PublishedQuizSort = params.sort ?? 'newest';
  const orderBy = ORDER_BY_SQL[sort];

  // Built-in sample quizzes are seeded as 'draft' (see
  // 1788600000003_add-sample-quiz-support) since they're never author-owned
  // or editable — but they ARE meant to show up here, alongside published
  // user quizzes, as permanently-available library entries. Regular
  // author-created quizzes still require `published` status; only the
  // `is_sample` flag (never user-settable) gets to bypass that.
  const conditions: string[] = [`(q.status = 'published' OR q.is_sample = true)`];
  const values: unknown[] = [];

  if (params.search && params.search.trim()) {
    values.push(`%${params.search.trim()}%`);
    conditions.push(`q.title ILIKE $${values.length}`);
  }

  if (params.tags && params.tags.length > 0) {
    values.push(params.tags);
    conditions.push(
      `EXISTS (SELECT 1 FROM quiz_tags qt2 JOIN tags t2 ON t2.id = qt2.tag_id WHERE qt2.quiz_id = q.id AND t2.name = ANY($${values.length}::text[]))`
    );
  }

  const whereSql = conditions.join(' AND ');

  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM quizzes q WHERE ${whereSql}`,
    values
  );
  const total = Number(countRows[0]!.count);

  const limitParamIndex = values.length + 1;
  const offsetParamIndex = values.length + 2;
  const { rows } = await pool.query<PublishedQuizRow>(
    `SELECT
       q.id,
       q.title,
       -- Built-in sample quizzes have no author row at all (author_id is
       -- null — see 1788600000003_add-sample-quiz-support), so the join
       -- below is a LEFT JOIN and this falls back to a placeholder label
       -- instead of leaving them out of the listing entirely.
       COALESCE(u.username, 'QuizJumper') AS author_username,
       q.play_count,
       (SELECT COUNT(*) FROM questions WHERE questions.quiz_id = q.id) AS question_count,
       COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags,
       (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ma.is_correct) / NULLIF(COUNT(*), 0))
        FROM match_answers ma
        JOIN matches m ON m.id = ma.match_id
        WHERE m.quiz_id = q.id) AS average_grade
     FROM quizzes q
     LEFT JOIN users u ON u.id = q.author_id
     LEFT JOIN quiz_tags qt ON qt.quiz_id = q.id
     LEFT JOIN tags t ON t.id = qt.tag_id
     WHERE ${whereSql}
     GROUP BY q.id, u.username
     ORDER BY ${orderBy}
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
    [...values, params.limit, (params.page - 1) * params.limit]
  );

  return { quizzes: rows.map(rowToCard), total };
}
