import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  LeaderboardEntry,
  AnswerResult,
  PlayerPosition,
  MatchQuestionStat,
  QuizGlobalStats,
  MatchEndedPlayer
} from '@quizjumper/shared/events';
import { connectedPlayerIds, getLobbyPlayerList, type MatchAnswerRecord, type Room } from './rooms.js';
import { rankPlayersByClimbProgress } from './scoring.js';
import { persistMatch, getQuizGlobalStats, type PersistedMatch } from './match-history/matches.js';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

const CLIMB_DURATION_MS = 8000;
const RESULTS_DISPLAY_MS = 4000;
// After the LAST question's results, every other question would get one
// more climb phase where the boost/slowdown just earned actually plays out —
// without this, the match cut straight from "here's whether you got the
// final question right" to the end screen, so that last answer's reward/
// penalty was computed but never visually experienced. Shorter than a normal
// CLIMB_DURATION_MS since there's no next question to read/prepare for.
const FINAL_CLIMB_DURATION_MS = 4000;
// Ghost sprites interpolate across this window client-side, so it's both the
// fan-out rate and the perceived smoothness knob (see design.md decision 3).
const POSITION_BROADCAST_MS = 100;

function clearPhaseTimer(room: Room): void {
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
}

/**
 * One snapshot per recipient rather than a single room-wide emit: each client's
 * snapshot omits its own entry, since it's the authority on its own position
 * and echoing it back would fight its local simulation.
 */
function broadcastPositions(io: IoServer, room: Room): void {
  const connected = connectedPlayerIds(room);
  for (const recipientId of connected) {
    const recipient = room.players.get(recipientId);
    if (!recipient) continue;
    const positions: Record<string, PlayerPosition> = {};
    for (const playerId of connected) {
      if (playerId === recipientId) continue;
      const position = room.positions.get(playerId);
      if (position) positions[playerId] = position;
    }
    io.to(recipient.socketId).emit('players:positions', { positions });
  }
}

function startPositionBroadcast(io: IoServer, room: Room): void {
  if (room.positionTimer) return;
  room.positionTimer = setInterval(() => broadcastPositions(io, room), POSITION_BROADCAST_MS);
}

function stopPositionBroadcast(room: Room): void {
  if (room.positionTimer) {
    clearInterval(room.positionTimer);
    room.positionTimer = null;
  }
}

function buildLeaderboard(room: Room): LeaderboardEntry[] {
  return [...room.scores.entries()]
    .map(([playerId, score]) => ({
      playerId,
      displayName: room.players.get(playerId)?.displayName ?? 'Unknown',
      points: room.players.get(playerId)?.climbProgress ?? 0,
      score: score.correctAnswers,
      answered: score.questionsAnswered,
      rank: 0,
      connected: room.players.get(playerId)?.connected ?? false
    }))
    .sort((a, b) => b.points - a.points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function startMatch(io: IoServer, room: Room): void {
  room.status = 'climbing';
  room.currentQuestionIndex = -1;
  // Runs for the whole match, not just climb phases: during `frozen`/`results`
  // players stand still but their ghosts must stay on screen, and a snapshot
  // gap would make every client tear down and re-create them.
  startPositionBroadcast(io, room);
  advanceToNextQuestion(io, room);
}

function advanceToNextQuestion(io: IoServer, room: Room): void {
  const nextIndex = room.currentQuestionIndex + 1;
  if (nextIndex >= room.quiz.questions.length) {
    startFinalClimbPhase(io, room);
    return;
  }
  room.currentQuestionIndex = nextIndex;
  startClimbPhase(io, room);
}

/**
 * One last climb after the final question's results, so the boost/slowdown
 * that question just earned actually plays out before the match ends —
 * otherwise it was computed and shown in the results overlay but the player
 * never got to act on it. `currentQuestionIndex` deliberately stays put
 * (still the last real question) so the HUD keeps reading "Pregunta N/N"
 * rather than implying a question N+1 exists.
 */
function startFinalClimbPhase(io: IoServer, room: Room): void {
  clearPhaseTimer(room);
  room.status = 'climbing';
  const serverTime = Date.now();
  room.phaseEndsAt = serverTime + FINAL_CLIMB_DURATION_MS;

  io.to(room.code).emit('match:climb-start', {
    questionIndex: room.currentQuestionIndex,
    totalQuestions: room.quiz.questions.length,
    durationMs: FINAL_CLIMB_DURATION_MS,
    serverTime,
    phaseEndsAt: room.phaseEndsAt,
    leaderboard: buildLeaderboard(room)
  });

  room.phaseTimer = setTimeout(() => void endMatch(io, room), FINAL_CLIMB_DURATION_MS);
}

function startClimbPhase(io: IoServer, room: Room): void {
  clearPhaseTimer(room);
  room.status = 'climbing';
  room.answers = new Map();
  const serverTime = Date.now();
  room.phaseEndsAt = serverTime + CLIMB_DURATION_MS;

  io.to(room.code).emit('match:climb-start', {
    questionIndex: room.currentQuestionIndex,
    totalQuestions: room.quiz.questions.length,
    durationMs: CLIMB_DURATION_MS,
    serverTime,
    phaseEndsAt: room.phaseEndsAt,
    leaderboard: buildLeaderboard(room)
  });

  room.phaseTimer = setTimeout(() => startFreezePhase(io, room), CLIMB_DURATION_MS);
}

function startFreezePhase(io: IoServer, room: Room): void {
  clearPhaseTimer(room);
  room.status = 'frozen';
  const question = room.quiz.questions[room.currentQuestionIndex];
  const durationMs = question.seconds * 1000;
  const serverTime = Date.now();
  room.phaseEndsAt = serverTime + durationMs;

  io.to(room.code).emit('match:freeze-start', {
    questionIndex: room.currentQuestionIndex,
    totalQuestions: room.quiz.questions.length,
    question: { text: question.text, choices: question.choices },
    durationMs,
    serverTime,
    phaseEndsAt: room.phaseEndsAt
  });

  room.phaseTimer = setTimeout(() => startResultsPhase(io, room), durationMs);
}

export function submitAnswer(
  io: IoServer,
  room: Room,
  playerId: string,
  choiceIndex: number
): { accepted: boolean; reason?: string } {
  if (room.status !== 'frozen') return { accepted: false, reason: 'not_frozen' };
  if (room.answers.has(playerId)) return { accepted: false, reason: 'already_answered' };

  const now = Date.now();
  const remainingMs = Math.max(0, (room.phaseEndsAt ?? now) - now);
  room.answers.set(playerId, { choiceIndex, remainingMs });

  const connected = connectedPlayerIds(room);
  const allAnswered = connected.every((id) => room.answers.has(id));
  if (allAnswered) {
    clearPhaseTimer(room);
    startResultsPhase(io, room);
  }
  return { accepted: true };
}

function startResultsPhase(io: IoServer, room: Room): void {
  clearPhaseTimer(room);
  room.status = 'results';
  const serverTime = Date.now();
  room.phaseEndsAt = serverTime + RESULTS_DISPLAY_MS;
  const question = room.quiz.questions[room.currentQuestionIndex];
  const answerResults: Record<string, AnswerResult> = {};

  // Disconnected players are excluded here (unlike buildLeaderboard, which
  // still shows them frozen at their last standing) — without this, a
  // player who dropped mid-match kept silently accumulating a wrong answer
  // on every remaining question, dragging down both the live leaderboard's
  // score/answered counts and the persisted match-history aggregate stats
  // for a quiz, for questions that player never actually saw.
  for (const playerId of connectedPlayerIds(room)) {
    const submitted = room.answers.get(playerId);
    const isCorrect = submitted ? submitted.choiceIndex === question.correctIndex : false;

    const score = room.scores.get(playerId)!;
    score.questionsAnswered += 1;
    if (isCorrect) score.correctAnswers += 1;

    const modifier = isCorrect ? 'boost' : 'slowdown';
    room.modifiers.set(playerId, modifier);

    answerResults[playerId] = {
      choiceIndex: submitted ? submitted.choiceIndex : null,
      isCorrect,
      modifier
    };

    // Captured here (not in endMatch) since `room.answers` is wiped at the
    // start of every climb phase — see design.md decision 3.
    room.answerLog.push({
      playerId,
      questionIndex: room.currentQuestionIndex,
      questionText: question.text,
      choices: question.choices,
      correctChoiceIndex: question.correctIndex,
      selectedChoiceIndex: submitted ? (submitted.choiceIndex as 0 | 1 | 2 | 3) : null,
      isCorrect,
      answerTimeMs: submitted ? question.seconds * 1000 - submitted.remainingMs : null
    });
  }

  io.to(room.code).emit('match:results', {
    questionIndex: room.currentQuestionIndex,
    correctIndex: question.correctIndex,
    answers: answerResults,
    leaderboard: buildLeaderboard(room),
    durationMs: RESULTS_DISPLAY_MS,
    serverTime,
    phaseEndsAt: room.phaseEndsAt
  });

  room.phaseTimer = setTimeout(() => advanceToNextQuestion(io, room), RESULTS_DISPLAY_MS);
}

/**
 * This match's own per-question and overall percent-correct, computed
 * in-memory from `room.answerLog` — deliberately NOT a DB read (unlike
 * `getQuizGlobalStats` below), so it's always available the instant the
 * match ends, with no dependency on `persistMatch` having run yet.
 */
function computeMatchStats(answerLog: MatchAnswerRecord[]): {
  matchAverageGrade: number;
  questionStats: MatchQuestionStat[];
} {
  const byQuestion = new Map<number, { correct: number; total: number }>();
  let correctTotal = 0;
  for (const entry of answerLog) {
    const bucket = byQuestion.get(entry.questionIndex) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (entry.isCorrect) correctTotal += 1;
    if (entry.isCorrect) bucket.correct += 1;
    byQuestion.set(entry.questionIndex, bucket);
  }
  const questionStats = [...byQuestion.entries()]
    .sort(([a], [b]) => a - b)
    .map(([questionIndex, { correct, total }]) => ({
      questionIndex,
      correctCount: correct,
      totalCount: total,
      percentCorrect: total > 0 ? Math.round((correct / total) * 100) : 0
    }));
  const matchAverageGrade = answerLog.length > 0 ? Math.round((correctTotal / answerLog.length) * 100) : 0;
  return { matchAverageGrade, questionStats };
}

async function endMatch(io: IoServer, room: Room): Promise<void> {
  clearPhaseTimer(room);
  stopPositionBroadcast(room);
  room.status = 'ended';

  const ranked = rankPlayersByClimbProgress(
    [...room.players.entries()].map(([playerId, player]) => ({
      playerId,
      climbProgress: player.climbProgress
    }))
  );

  const placements = ranked.map((entry, index) => ({
    playerId: entry.playerId,
    rank: index + 1,
    climbProgress: entry.climbProgress
  }));

  const { matchAverageGrade, questionStats } = computeMatchStats(room.answerLog);

  // Persisted BEFORE reading the historical figure below (unlike the
  // fire-and-forget pattern design.md decision 4 describes elsewhere) so
  // this match's own answers are already counted in quizGlobalStats the
  // instant players see the end screen — otherwise the "all-time" average
  // would visibly lag one match behind until the next time it's viewed. A
  // failure here still must never block match:ended from firing, so it's
  // caught and logged rather than awaited-and-thrown.
  let persisted: PersistedMatch | null = null;
  try {
    persisted = await persistMatch(room, placements);
  } catch (err) {
    console.error(`Failed to persist match history for room ${room.code}:`, err);
  }

  // Historical (all-time) figure — read after the above so it includes this
  // match when persistence succeeded. A failure here must also never
  // prevent match:ended from firing, so it degrades to null instead of
  // throwing.
  let quizGlobalStats: QuizGlobalStats | null = null;
  try {
    quizGlobalStats = await getQuizGlobalStats(room.quiz.id);
  } catch (err) {
    console.error(`Failed to load historical quiz stats for room ${room.code}:`, err);
  }

  // persistMatch inserts a match_players row for every entry in room.players
  // at the time it ran; nothing can join/leave room.players between that
  // call and here (no await in between), so every player is expected to
  // have a matchPlayerId — the filter is just defense against that
  // invariant ever breaking, rather than silently emitting a bogus id.
  const players: MatchEndedPlayer[] = persisted
    ? [...room.players.entries()].flatMap(([playerId, player]) => {
        const matchPlayerId = persisted!.matchPlayerIdByPlayerId.get(playerId);
        return matchPlayerId ? [{ playerId, matchPlayerId, userId: player.userId ?? null }] : [];
      })
    : [];

  io.to(room.code).emit('match:ended', {
    leaderboard: buildLeaderboard(room),
    placements,
    quizTitle: room.quiz.title,
    matchAverageGrade,
    questionStats,
    quizGlobalStats,
    matchId: persisted?.matchId ?? null,
    players
  });
}

export function setClimbProgress(room: Room, playerId: string, progress: number): void {
  const player = room.players.get(playerId);
  if (!player) return;
  player.climbProgress = progress;
}

export function reportClimbProgress(io: IoServer, room: Room, playerId: string, progress: number): void {
  setClimbProgress(room, playerId, progress);
  io.to(room.code).emit('leaderboard:update', { leaderboard: buildLeaderboard(room) });
}

export function broadcastLobby(io: IoServer, room: Room): void {
  io.to(room.code).emit('lobby:update', { players: getLobbyPlayerList(room) });
}
