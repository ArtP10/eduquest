import { getPool } from '../db.js';

/** Idempotent: attaching a tag already on the quiz is a no-op, not an error. */
export async function attachTag(quizId: string, tagId: string): Promise<void> {
  await getPool().query(
    'INSERT INTO quiz_tags (quiz_id, tag_id) VALUES ($1, $2) ON CONFLICT (quiz_id, tag_id) DO NOTHING',
    [quizId, tagId]
  );
}

/** Removes only the quiz<->tag association; the tag row itself is never deleted. */
export async function detachTag(quizId: string, tagId: string): Promise<void> {
  await getPool().query('DELETE FROM quiz_tags WHERE quiz_id = $1 AND tag_id = $2', [quizId, tagId]);
}
