import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  LeaderboardEntry,
  AnswerResult
} from '../../shared/events.js';
import { connectedPlayerIds, getLobbyPlayerList, type Room } from './rooms.js';
import { scoreAnswer, placementBonusForRank, rankPlayersByClimbProgress } from './scoring.js';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

const CLIMB_DURATION_MS = 8000;
const RESULTS_DISPLAY_MS = 4000;

function clearPhaseTimer(room: Room): void {
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
}

function buildLeaderboard(room: Room): LeaderboardEntry[] {
  return [...room.scores.entries()]
    .map(([playerId, score]) => ({
      playerId,
      displayName: room.players.get(playerId)?.displayName ?? 'Unknown',
      total: score.total,
      rank: 0
    }))
    .sort((a, b) => b.total - a.total)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function startMatch(io: IoServer, room: Room): void {
  room.status = 'climbing';
  room.currentQuestionIndex = -1;
  advanceToNextQuestion(io, room);
}

function advanceToNextQuestion(io: IoServer, room: Room): void {
  const nextIndex = room.currentQuestionIndex + 1;
  if (nextIndex >= room.quiz.questions.length) {
    endMatch(io, room);
    return;
  }
  room.currentQuestionIndex = nextIndex;
  startClimbPhase(io, room);
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
    phaseEndsAt: room.phaseEndsAt
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
  const totalMs = question.seconds * 1000;
  const answerResults: Record<string, AnswerResult> = {};

  for (const playerId of room.players.keys()) {
    const submitted = room.answers.get(playerId);
    const isCorrect = submitted ? submitted.choiceIndex === question.correctIndex : false;
    const { correctness, speed } = scoreAnswer({
      isCorrect,
      remainingMs: submitted ? submitted.remainingMs : 0,
      totalMs
    });

    const score = room.scores.get(playerId)!;
    score.correctness += correctness;
    score.speed += speed;
    score.total = score.correctness + score.speed + score.placement;

    const modifier = isCorrect ? 'boost' : 'slowdown';
    room.modifiers.set(playerId, modifier);

    answerResults[playerId] = {
      choiceIndex: submitted ? submitted.choiceIndex : null,
      isCorrect,
      pointsAwarded: correctness + speed,
      modifier
    };
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

function endMatch(io: IoServer, room: Room): void {
  clearPhaseTimer(room);
  room.status = 'ended';

  const ranked = rankPlayersByClimbProgress(
    [...room.players.entries()].map(([playerId, player]) => ({
      playerId,
      climbProgress: player.climbProgress
    }))
  );

  ranked.forEach((entry, index) => {
    const score = room.scores.get(entry.playerId)!;
    const bonus = placementBonusForRank(index);
    score.placement += bonus;
    score.total = score.correctness + score.speed + score.placement;
  });

  io.to(room.code).emit('match:ended', {
    leaderboard: buildLeaderboard(room),
    placements: ranked.map((entry, index) => ({
      playerId: entry.playerId,
      rank: index + 1,
      climbProgress: entry.climbProgress
    }))
  });
}

export function setClimbProgress(room: Room, playerId: string, progress: number): void {
  const player = room.players.get(playerId);
  if (!player) return;
  if (progress > player.climbProgress) player.climbProgress = progress;
}

export function broadcastLobby(io: IoServer, room: Room): void {
  io.to(room.code).emit('lobby:update', { players: getLobbyPlayerList(room) });
}
