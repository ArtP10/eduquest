import { getPool } from '../db.js';

export interface TagRecord {
  id: string;
  name: string;
}

interface TagRow {
  id: string;
  name: string;
}

function rowToTag(row: TagRow): TagRecord {
  return { id: row.id, name: row.name };
}

/**
 * Normalizes (trim + lowercase) before lookup/insert so "Math" and "math"
 * always collapse to the same tag row. `ON CONFLICT ... DO NOTHING` handles
 * the race where two requests first-use the same new tag concurrently; the
 * unique constraint on tags.name is the backstop, not the primary dedup
 * mechanism (that's the normalization itself).
 */
export async function findOrCreateTag(rawName: string): Promise<TagRecord> {
  const name = rawName.trim().toLowerCase();
  const pool = getPool();

  const { rows: inserted } = await pool.query<TagRow>(
    'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
    [name]
  );
  if (inserted[0]) return rowToTag(inserted[0]);

  const { rows: existing } = await pool.query<TagRow>('SELECT * FROM tags WHERE name = $1', [name]);
  return rowToTag(existing[0]!);
}

export async function listTags(): Promise<TagRecord[]> {
  const { rows } = await getPool().query<TagRow>('SELECT * FROM tags ORDER BY name ASC');
  return rows.map(rowToTag);
}

export async function listTagsForQuiz(quizId: string): Promise<TagRecord[]> {
  const { rows } = await getPool().query<TagRow>(
    `SELECT tags.* FROM tags
     JOIN quiz_tags ON quiz_tags.tag_id = tags.id
     WHERE quiz_tags.quiz_id = $1
     ORDER BY tags.name ASC`,
    [quizId]
  );
  return rows.map(rowToTag);
}
