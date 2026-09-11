// Shared Socket.IO event contract between the QuizJumper server and client.
// Both sides import these types so the payload shapes can't silently drift apart.

export type MatchPhase = 'lobby' | 'climbing' | 'frozen' | 'results' | 'ended';

export type Modifier = 'boost' | 'slowdown' | 'none';

export interface QuestionPayload {
  text: string;
  choices: string[];
}

export interface LobbyPlayer {
  playerId: string;
  displayName: string;
  isHost: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  /** Climb height — the value that decides ranking. */
  points: number;
  /** Number of correctly-answered questions. */
  score: number;
  /** Number of questions answered (scored) so far — stops incrementing once a player disconnects, rather than counting every remaining question as a silent wrong answer. */
  answered: number;
  rank: number;
  /** False once this player has disconnected mid-match (see rooms.ts removePlayerBySocketId) — still shown on the leaderboard with their last-known standing, but frozen from further scoring. */
  connected: boolean;
}

export interface AnswerResult {
  choiceIndex: number | null;
  isCorrect: boolean;
  modifier: Modifier;
}

export interface PlacementEntry {
  playerId: string;
  rank: number;
  climbProgress: number;
}

export type PlayerAnimKey = 'idle' | 'walk' | 'jump';

/** A player's live world-space position and visual state, as reported by their own client. */
export interface PlayerPosition {
  x: number;
  y: number;
  facingRight: boolean;
  animKey: PlayerAnimKey;
}

// --- Client -> Server ---

export interface RoomCreateRequest {
  displayName: string;
  /** Optional: a mock quiz id, or a published quiz id chosen from the Quiz Library (GET /quizzes/published). Omitted or unresolvable falls back to a random mock quiz. */
  quizId?: string;
  /** Optional: the caller's JWT access token, so the resulting match/player can be attributed to their account. Missing or invalid is never rejected — treated as a guest. */
  authToken?: string;
}

export interface RoomCreateResponse {
  ok: boolean;
  error?: string;
  roomCode?: string;
  inviteLink?: string;
  playerId?: string;
  isHost?: boolean;
  /** Seeds each client's deterministic platform generation, so every player in the room climbs an identical tower. */
  platformSeed?: number;
}

export interface RoomJoinRequest {
  roomCode: string;
  displayName: string;
  /** Optional: the caller's JWT access token, so the resulting match/player can be attributed to their account. Missing or invalid is never rejected — treated as a guest. */
  authToken?: string;
}

export interface RoomJoinResponse {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  isHost?: boolean;
  /** Seeds each client's deterministic platform generation, so every player in the room climbs an identical tower. */
  platformSeed?: number;
}

export interface RoomStartResponse {
  ok: boolean;
  error?: string;
}

export interface AnswerSubmitRequest {
  choiceIndex: number;
}

export interface AnswerSubmitResponse {
  ok: boolean;
  error?: string;
}

export interface ClimbProgressUpdate {
  progress: number;
}

// --- Server -> Clients (room broadcast) ---

export interface LobbyUpdateEvent {
  players: LobbyPlayer[];
}

export interface MatchClimbStartEvent {
  questionIndex: number;
  totalQuestions: number;
  durationMs: number;
  serverTime: number;
  phaseEndsAt: number;
  leaderboard: LeaderboardEntry[];
  // True for the extra climb after the last question's results, where no
  // next question is coming and the match ends when this phase's timer
  // expires — lets clients label this countdown differently from a normal
  // climb leading into another question.
  isFinal: boolean;
}

export interface MatchFreezeStartEvent {
  questionIndex: number;
  totalQuestions: number;
  question: QuestionPayload;
  durationMs: number;
  serverTime: number;
  phaseEndsAt: number;
}

export interface MatchResultsEvent {
  questionIndex: number;
  correctIndex: number;
  answers: Record<string, AnswerResult>;
  leaderboard: LeaderboardEntry[];
  durationMs: number;
  serverTime: number;
  phaseEndsAt: number;
}

/** Per-question correct/total breakdown, scoped to one match (see MatchEndedEvent). */
export interface MatchQuestionStat {
  questionIndex: number;
  correctCount: number;
  totalCount: number;
  percentCorrect: number;
}

/** A quiz's aggregate percent-correct across every match ever recorded for it. */
export interface QuizGlobalStats {
  percentCorrect: number;
  averageGrade: number;
}

/** One room player's identity in the persisted match, once persistMatch has run — lets the live end screen drill into that player's answers exactly like the historical match-detail page does. */
export interface MatchEndedPlayer {
  playerId: string;
  matchPlayerId: string;
  userId: string | null;
}

export interface MatchEndedEvent {
  leaderboard: LeaderboardEntry[];
  placements: PlacementEntry[];
  quizTitle: string;
  /** This match's own aggregate percent-correct across every answer submitted in it — computed in-memory, always present, independent of match-history persistence. */
  matchAverageGrade: number;
  questionStats: MatchQuestionStat[];
  /** All-time percent-correct across every OTHER recorded match of this quiz. This match's own answers are already persisted by the time this event fires (persistMatch is awaited before match:ended is emitted — see match.ts's endMatch), so once this match itself has been recorded once, its own answers ARE counted here too. Null if this quiz has no prior recorded plays, or the historical lookup failed. */
  quizGlobalStats: QuizGlobalStats | null;
  /** The persisted match's id, or null if persistence failed — used to drill into individual player answers via the same endpoint the historical match-detail page uses. Null means `players` is empty and drill-down isn't available for this match. */
  matchId: string | null;
  players: MatchEndedPlayer[];
}

export interface LeaderboardUpdateEvent {
  leaderboard: LeaderboardEntry[];
}

/**
 * A full picture of where everyone else is, keyed by playerId. Only currently
 * connected players appear, and the recipient's own entry is always omitted —
 * a client is the authority on its own position and never needs it echoed back.
 */
export interface PlayersPositionsEvent {
  positions: Record<string, PlayerPosition>;
}

export interface ClientToServerEvents {
  'room:create': (req: RoomCreateRequest, ack: (res: RoomCreateResponse) => void) => void;
  'room:join': (req: RoomJoinRequest, ack: (res: RoomJoinResponse) => void) => void;
  'room:start': (ack: (res: RoomStartResponse) => void) => void;
  'answer:submit': (req: AnswerSubmitRequest, ack: (res: AnswerSubmitResponse) => void) => void;
  'climb:progress': (req: ClimbProgressUpdate) => void;
  'player:move': (req: PlayerPosition) => void;
}

export interface ServerToClientEvents {
  'lobby:update': (event: LobbyUpdateEvent) => void;
  'match:climb-start': (event: MatchClimbStartEvent) => void;
  'match:freeze-start': (event: MatchFreezeStartEvent) => void;
  'match:results': (event: MatchResultsEvent) => void;
  'match:ended': (event: MatchEndedEvent) => void;
  'leaderboard:update': (event: LeaderboardUpdateEvent) => void;
  'players:positions': (event: PlayersPositionsEvent) => void;
}
