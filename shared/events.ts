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
  total: number;
  rank: number;
}

export interface AnswerResult {
  choiceIndex: number | null;
  isCorrect: boolean;
  pointsAwarded: number;
  modifier: Modifier;
}

export interface PlacementEntry {
  playerId: string;
  rank: number;
  climbProgress: number;
}

// --- Client -> Server ---

export interface RoomCreateRequest {
  displayName: string;
  /** Optional: a mock or published quiz id from GET /quizzes/available. Omitted or unresolvable falls back to a random mock quiz. */
  quizId?: string;
}

export interface RoomCreateResponse {
  ok: boolean;
  error?: string;
  roomCode?: string;
  inviteLink?: string;
  playerId?: string;
  isHost?: boolean;
}

export interface RoomJoinRequest {
  roomCode: string;
  displayName: string;
}

export interface RoomJoinResponse {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  isHost?: boolean;
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

export interface MatchEndedEvent {
  leaderboard: LeaderboardEntry[];
  placements: PlacementEntry[];
}

export interface LeaderboardUpdateEvent {
  leaderboard: LeaderboardEntry[];
}

export interface ClientToServerEvents {
  'room:create': (req: RoomCreateRequest, ack: (res: RoomCreateResponse) => void) => void;
  'room:join': (req: RoomJoinRequest, ack: (res: RoomJoinResponse) => void) => void;
  'room:start': (ack: (res: RoomStartResponse) => void) => void;
  'answer:submit': (req: AnswerSubmitRequest, ack: (res: AnswerSubmitResponse) => void) => void;
  'climb:progress': (req: ClimbProgressUpdate) => void;
}

export interface ServerToClientEvents {
  'lobby:update': (event: LobbyUpdateEvent) => void;
  'match:climb-start': (event: MatchClimbStartEvent) => void;
  'match:freeze-start': (event: MatchFreezeStartEvent) => void;
  'match:results': (event: MatchResultsEvent) => void;
  'match:ended': (event: MatchEndedEvent) => void;
}
