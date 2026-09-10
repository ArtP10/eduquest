import { getPool } from '../db.js';
import type { Room } from '../rooms.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID string. Route params (match id, match_player id) must be checked before use in a `uuid`-typed WHERE clause — Postgres raises a hard error (not just "no rows") for a malformed one. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export interface MatchPlacement {
  playerId: string;
  rank: number;
}

/**
 * Writes one `matches` row, one `match_players` row per player in the room
 * (guests included, `user_id` null), and one `match_answers` row per entry in
 * `answerLog`, in a single transaction. Called fire-and-forget from
 * `endMatch()` — see design.md decision 4: a failure here must never affect
 * the already-emitted `match:ended` event.
 */
export async function persistMatch(room: Room, placements: MatchPlacement[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const hostUserId = room.hostPlayerId ? room.players.get(room.hostPlayerId)?.userId ?? null : null;

    // room.quiz.id is always a real `quizzes` row now — sample quizzes
    // (server/src/quizzes.ts) are seeded with fixed ids matching real rows
    // (see 1788600000003_add-sample-quiz-support), so this FK never fails.
    const { rows: matchRows } = await client.query<{ id: string }>(
      `INSERT INTO matches (quiz_id, quiz_title, room_creator_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [room.quiz.id, room.quiz.title, hostUserId]
    );
    const matchId = matchRows[0]!.id;

    const placementByPlayerId = new Map(placements.map((p) => [p.playerId, p.rank]));
    const matchPlayerIdByPlayerId = new Map<string, string>();

    for (const [playerId, player] of room.players.entries()) {
      const score = room.scores.get(playerId);
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO match_players (match_id, user_id, nickname, final_score, final_placement)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [matchId, player.userId ?? null, player.displayName, score?.correctAnswers ?? 0, placementByPlayerId.get(playerId) ?? 0]
      );
      matchPlayerIdByPlayerId.set(playerId, rows[0]!.id);
    }

    for (const entry of room.answerLog) {
      const matchPlayerId = matchPlayerIdByPlayerId.get(entry.playerId);
      if (!matchPlayerId) continue; // Player left before ever being added — nothing to attribute the answer to.
      await client.query(
        `INSERT INTO match_answers
           (match_id, question_index, match_player_id, question_text, choices, correct_choice_index, selected_choice_index, is_correct, answer_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          matchId,
          entry.questionIndex,
          matchPlayerId,
          entry.questionText,
          JSON.stringify(entry.choices),
          entry.correctChoiceIndex,
          entry.selectedChoiceIndex,
          entry.isCorrect,
          entry.answerTimeMs
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface MatchSummary {
  id: string;
  quizId: string;
  quizTitle: string;
  playedAt: Date;
  isHost: boolean;
  finalScore: number;
  finalPlacement: number;
}

/** Every match a user participated in (as player and/or host), with their own score/placement. */
export async function listMatchesForUser(userId: string): Promise<MatchSummary[]> {
  const { rows } = await getPool().query<{
    id: string;
    quiz_id: string;
    quiz_title: string;
    played_at: Date;
    room_creator_id: string | null;
    final_score: number;
    final_placement: number;
  }>(
    `SELECT m.id, m.quiz_id, m.quiz_title, m.played_at, m.room_creator_id,
            mp.final_score, mp.final_placement
     FROM match_players mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.user_id = $1
     ORDER BY m.played_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    playedAt: row.played_at,
    isHost: row.room_creator_id === userId,
    finalScore: row.final_score,
    finalPlacement: row.final_placement
  }));
}

export interface MatchLeaderboardEntry {
  matchPlayerId: string;
  userId: string | null;
  nickname: string;
  finalScore: number;
  finalPlacement: number;
}

export interface MatchQuestionStats {
  questionIndex: number;
  correctCount: number;
  totalCount: number;
  percentCorrect: number;
}

export interface QuizGlobalStats {
  percentCorrect: number;
  averageGrade: number;
}

export interface MatchDetail {
  id: string;
  quizId: string;
  quizTitle: string;
  playedAt: Date;
  roomCreatorId: string | null;
  leaderboard: MatchLeaderboardEntry[];
  questionStats: MatchQuestionStats[];
  quizGlobalStats: QuizGlobalStats | null;
}

export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  const { rows: matchRows } = await getPool().query<{
    id: string;
    quiz_id: string;
    quiz_title: string;
    played_at: Date;
    room_creator_id: string | null;
  }>('SELECT id, quiz_id, quiz_title, played_at, room_creator_id FROM matches WHERE id = $1', [matchId]);
  const match = matchRows[0];
  if (!match) return null;

  const { rows: playerRows } = await getPool().query<{
    id: string;
    user_id: string | null;
    nickname: string;
    final_score: number;
    final_placement: number;
  }>(
    'SELECT id, user_id, nickname, final_score, final_placement FROM match_players WHERE match_id = $1 ORDER BY final_placement ASC',
    [matchId]
  );

  const { rows: statsRows } = await getPool().query<{
    question_index: number;
    correct_count: string;
    total_count: string;
  }>(
    `SELECT question_index,
            COUNT(*) FILTER (WHERE is_correct) AS correct_count,
            COUNT(*) AS total_count
     FROM match_answers
     WHERE match_id = $1
     GROUP BY question_index
     ORDER BY question_index ASC`,
    [matchId]
  );

  const quizGlobalStats = await getQuizGlobalStats(match.quiz_id);

  return {
    id: match.id,
    quizId: match.quiz_id,
    quizTitle: match.quiz_title,
    playedAt: match.played_at,
    roomCreatorId: match.room_creator_id,
    leaderboard: playerRows.map((row) => ({
      matchPlayerId: row.id,
      userId: row.user_id,
      nickname: row.nickname,
      finalScore: row.final_score,
      finalPlacement: row.final_placement
    })),
    questionStats: statsRows.map((row) => {
      const correctCount = Number(row.correct_count);
      const totalCount = Number(row.total_count);
      return {
        questionIndex: row.question_index,
        correctCount,
        totalCount,
        percentCorrect: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
      };
    }),
    quizGlobalStats
  };
}

export interface PlayerAnswerBreakdown {
  questionIndex: number;
  questionText: string;
  choices: [string, string, string, string];
  correctChoiceIndex: number;
  selectedChoiceIndex: number | null;
  isCorrect: boolean;
  answerTimeMs: number | null;
}

/** One participant's full per-question breakdown for a match — question text, choices, which was correct, and which they picked (or null if they didn't answer in time). */
export async function getPlayerAnswers(matchId: string, matchPlayerId: string): Promise<PlayerAnswerBreakdown[] | null> {
  const { rows: playerRows } = await getPool().query(
    'SELECT id FROM match_players WHERE id = $1 AND match_id = $2',
    [matchPlayerId, matchId]
  );
  if (playerRows.length === 0) return null;

  const { rows } = await getPool().query<{
    question_index: number;
    question_text: string;
    choices: [string, string, string, string];
    correct_choice_index: number;
    selected_choice_index: number | null;
    is_correct: boolean;
    answer_time_ms: number | null;
  }>(
    `SELECT question_index, question_text, choices, correct_choice_index, selected_choice_index, is_correct, answer_time_ms
     FROM match_answers WHERE match_id = $1 AND match_player_id = $2 ORDER BY question_index ASC`,
    [matchId, matchPlayerId]
  );
  return rows.map((row) => ({
    questionIndex: row.question_index,
    questionText: row.question_text,
    choices: row.choices,
    correctChoiceIndex: row.correct_choice_index,
    selectedChoiceIndex: row.selected_choice_index,
    isCorrect: row.is_correct,
    answerTimeMs: row.answer_time_ms
  }));
}

/** A quiz's aggregate percent-correct/grade across every match it has ever been played in (sample quizzes included). Null if never played, or if `quizId` isn't even a well-formed UUID (this is also reachable directly from the public `GET /quizzes/:id/stats` route with an arbitrary `:id`). */
export async function getQuizGlobalStats(quizId: string): Promise<QuizGlobalStats | null> {
  if (!UUID_RE.test(quizId)) return null;
  const { rows } = await getPool().query<{ correct_count: string; total_count: string }>(
    `SELECT COUNT(*) FILTER (WHERE ma.is_correct) AS correct_count, COUNT(*) AS total_count
     FROM match_answers ma
     JOIN matches m ON m.id = ma.match_id
     WHERE m.quiz_id = $1`,
    [quizId]
  );
  const totalCount = Number(rows[0]?.total_count ?? 0);
  if (totalCount === 0) return null;
  const correctCount = Number(rows[0]!.correct_count);
  const percentCorrect = Math.round((correctCount / totalCount) * 100);
  return { percentCorrect, averageGrade: percentCorrect };
}
