import crypto from 'node:crypto';
import type { Quiz, QuizQuestion } from '@quizjumper/shared/quiz';
import type { LobbyPlayer, Modifier, PlayerPosition } from '@quizjumper/shared/events';

export type MatchPhase = 'lobby' | 'climbing' | 'frozen' | 'results' | 'ended';

export interface Player {
  displayName: string;
  socketId: string;
  connected: boolean;
  climbProgress: number;
  /** Set when the player was logged in (valid authToken) at room:create/room:join time. Undefined for guests. */
  userId?: string;
}

export interface SubmittedAnswer {
  choiceIndex: number;
  remainingMs: number;
}

export interface PlayerScore {
  correctAnswers: number;
  questionsAnswered: number;
}

export interface MatchAnswerRecord {
  playerId: string;
  questionIndex: number;
  // Snapshot of the question as presented to this room — `questions` rows
  // aren't a reliable source for this later: a room's question/choice order
  // is shuffled per-room (see shuffleQuizForRoom), and a sample quiz's
  // questions have no `questions` row at all (see design.md decision 6).
  questionText: string;
  choices: [string, string, string, string];
  correctChoiceIndex: 0 | 1 | 2 | 3;
  selectedChoiceIndex: 0 | 1 | 2 | 3 | null;
  isCorrect: boolean;
  answerTimeMs: number | null;
}

export interface Room {
  code: string;
  inviteLink: string;
  hostPlayerId: string | null;
  status: MatchPhase;
  quiz: Quiz;
  // Platform layout is generated client-side, but every client in the room has
  // to generate the *same* one for another player's broadcast position to mean
  // anything — so the room hands out one seed and each client derives its
  // tower from it (see design.md decision 1).
  platformSeed: number;
  currentQuestionIndex: number;
  players: Map<string, Player>;
  answers: Map<string, SubmittedAnswer>;
  scores: Map<string, PlayerScore>;
  modifiers: Map<string, Modifier>;
  // Latest position each client reported via `player:move`, coalesced here and
  // fanned out on a fixed tick rather than relayed per-message (decision 2).
  positions: Map<string, PlayerPosition>;
  phaseTimer: NodeJS.Timeout | null;
  positionTimer: NodeJS.Timeout | null;
  phaseEndsAt: number | null;
  // Accumulated across the whole match (unlike `answers`, which is reset
  // every question) so match history has every player's per-question result
  // once the match ends — see design.md decision 3.
  answerLog: MatchAnswerRecord[];
}

// Unambiguous alphabet (no 0/O/1/I) for typeable room codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: CODE_LENGTH }, () =>
      CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

/** crypto.randomInt (the room-code RNG) rather than Math.random; capped at 2^32-1 since the client PRNG's state is 32-bit. */
function generatePlatformSeed(): number {
  return crypto.randomInt(1, 2 ** 32);
}

/** Fisher-Yates, using crypto.randomInt (already the room-code RNG) rather than Math.random. */
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Re-shuffles both the question order and each question's choice order —
 * without this, quizzes (mock and builder-authored alike) always played in
 * authored order with the correct choice always at its authored position
 * (e.g. builder questions left at the "Opción A" default). Re-shuffled once
 * per room so replaying the same quiz in a new room varies both. Never
 * mutates the source quiz — mock quizzes are a shared in-memory array, and
 * a builder quiz object may be reused across rooms.
 */
function shuffleQuizForRoom(quiz: Quiz): Quiz {
  const questions = shuffled(quiz.questions).map((question): QuizQuestion => {
    const order = shuffled([0, 1, 2, 3] as const);
    const choices = order.map((i) => question.choices[i]) as [string, string, string, string];
    const correctIndex = order.indexOf(question.correctIndex) as 0 | 1 | 2 | 3;
    return { ...question, choices, correctIndex };
  });
  return { ...quiz, questions };
}

export function createRoom({ baseUrl = '', quiz }: { baseUrl?: string; quiz: Quiz }): Room {
  const code = generateRoomCode();
  const room: Room = {
    code,
    inviteLink: `${baseUrl}/join/${code}`,
    hostPlayerId: null,
    status: 'lobby',
    quiz: shuffleQuizForRoom(quiz),
    platformSeed: generatePlatformSeed(),
    currentQuestionIndex: -1,
    players: new Map(),
    answers: new Map(),
    scores: new Map(),
    modifiers: new Map(),
    positions: new Map(),
    phaseTimer: null,
    positionTimer: null,
    phaseEndsAt: null,
    answerLog: []
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | null {
  return rooms.get(code) ?? null;
}

export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  if (room?.phaseTimer) clearTimeout(room.phaseTimer);
  if (room?.positionTimer) clearInterval(room.positionTimer);
  rooms.delete(code);
}

export function addPlayer(
  room: Room,
  { displayName, socketId, userId }: { displayName: string; socketId: string; userId?: string }
): { playerId: string; isHost: boolean } {
  const playerId = crypto.randomUUID();
  const isHost = room.players.size === 0;
  room.players.set(playerId, {
    displayName,
    socketId,
    connected: true,
    climbProgress: 0,
    userId
  });
  room.scores.set(playerId, { correctAnswers: 0, questionsAnswered: 0 });
  room.modifiers.set(playerId, 'none');
  if (isHost) room.hostPlayerId = playerId;
  return { playerId, isHost };
}

export function removePlayerBySocketId(room: Room, socketId: string): string | null {
  for (const [playerId, player] of room.players.entries()) {
    if (player.socketId === socketId) {
      if (room.status === 'lobby') {
        room.players.delete(playerId);
        room.scores.delete(playerId);
        room.modifiers.delete(playerId);
        room.positions.delete(playerId);
        if (room.hostPlayerId === playerId) {
          const next = room.players.keys().next();
          room.hostPlayerId = next.done ? null : next.value;
        }
      } else {
        player.connected = false;
      }
      return playerId;
    }
  }
  return null;
}

export function getLobbyPlayerList(room: Room): LobbyPlayer[] {
  return [...room.players.entries()].map(([playerId, player]) => ({
    playerId,
    displayName: player.displayName,
    isHost: playerId === room.hostPlayerId
  }));
}

export function setPlayerPosition(room: Room, playerId: string, position: PlayerPosition): void {
  if (!room.players.has(playerId)) return;
  room.positions.set(playerId, position);
}

export function connectedPlayerIds(room: Room): string[] {
  return [...room.players.entries()]
    .filter(([, player]) => player.connected)
    .map(([playerId]) => playerId);
}
