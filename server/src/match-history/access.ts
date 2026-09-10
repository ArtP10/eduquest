import { getPool } from '../db.js';

/** Whether `userId` was a participant (player or host) of `matchId`. */
export async function isMatchParticipant(matchId: string, userId: string): Promise<boolean> {
  const { rows } = await getPool().query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM matches m
       WHERE m.id = $1 AND (
         m.room_creator_id = $2
         OR EXISTS (SELECT 1 FROM match_players mp WHERE mp.match_id = m.id AND mp.user_id = $2)
       )
     ) AS exists`,
    [matchId, userId]
  );
  return rows[0]?.exists ?? false;
}

/** Whether `userId` hosted `matchId` (used for the answer-drill-down host override). */
export async function isMatchHost(matchId: string, userId: string): Promise<boolean> {
  const { rows } = await getPool().query<{ room_creator_id: string | null }>(
    'SELECT room_creator_id FROM matches WHERE id = $1',
    [matchId]
  );
  return rows[0]?.room_creator_id === userId;
}
