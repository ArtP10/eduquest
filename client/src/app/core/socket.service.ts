import { Injectable, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyPlayer,
  LeaderboardEntry,
  MatchPhase,
  QuestionPayload,
  AnswerResult,
  PlacementEntry,
  RoomCreateResponse,
  RoomJoinResponse,
  RoomStartResponse,
  AnswerSubmitResponse,
  PlayerPosition
} from '@quizjumper/shared/events';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly authService = inject(AuthService);

  private readonly socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(environment.apiUrl, {
    autoConnect: true
  });

  readonly roomCode = signal<string | null>(null);
  readonly inviteLink = signal<string | null>(null);
  readonly playerId = signal<string | null>(null);
  readonly isHost = signal(false);

  readonly lobbyPlayers = signal<LobbyPlayer[]>([]);

  readonly matchPhase = signal<MatchPhase>('lobby');
  readonly questionIndex = signal(0);
  readonly totalQuestions = signal(0);
  readonly currentQuestion = signal<QuestionPayload | null>(null);
  readonly phaseEndsAt = signal<number | null>(null);

  readonly lastCorrectIndex = signal<number | null>(null);
  readonly lastAnswers = signal<Record<string, AnswerResult>>({});
  readonly myModifier = signal<'boost' | 'slowdown' | 'none'>('none');

  readonly leaderboard = signal<LeaderboardEntry[]>([]);
  readonly finalPlacements = signal<PlacementEntry[]>([]);

  readonly errorMessage = signal<string | null>(null);

  /** Seed for the room's shared platform layout; null until room:create/room:join resolves. */
  readonly platformSeed = signal<number | null>(null);
  /** Latest `players:positions` snapshot — every *other* connected player, keyed by playerId. */
  readonly playerPositions = signal<Record<string, PlayerPosition>>({});

  constructor() {
    this.socket.on('lobby:update', ({ players }) => {
      this.lobbyPlayers.set(players);
      const me = players.find((p) => p.playerId === this.playerId());
      if (me) this.isHost.set(me.isHost);
    });

    this.socket.on('match:climb-start', (event) => {
      this.matchPhase.set('climbing');
      this.questionIndex.set(event.questionIndex);
      this.totalQuestions.set(event.totalQuestions);
      this.phaseEndsAt.set(event.phaseEndsAt);
      this.currentQuestion.set(null);
      this.leaderboard.set(event.leaderboard);
    });

    this.socket.on('leaderboard:update', ({ leaderboard }) => {
      this.leaderboard.set(leaderboard);
    });

    this.socket.on('players:positions', ({ positions }) => {
      this.playerPositions.set(positions);
    });

    this.socket.on('match:freeze-start', (event) => {
      this.matchPhase.set('frozen');
      this.questionIndex.set(event.questionIndex);
      this.totalQuestions.set(event.totalQuestions);
      this.phaseEndsAt.set(event.phaseEndsAt);
      this.currentQuestion.set(event.question);
    });

    this.socket.on('match:results', (event) => {
      this.matchPhase.set('results');
      this.lastCorrectIndex.set(event.correctIndex);
      this.lastAnswers.set(event.answers);
      this.leaderboard.set(event.leaderboard);
      this.phaseEndsAt.set(event.phaseEndsAt);
      const mine = this.playerId();
      const myResult = mine ? event.answers[mine] : undefined;
      this.myModifier.set(myResult?.modifier ?? 'slowdown');
    });

    this.socket.on('match:ended', (event) => {
      this.matchPhase.set('ended');
      this.leaderboard.set(event.leaderboard);
      this.finalPlacements.set(event.placements);
    });
  }

  createRoom(displayName: string, quizId?: string): Promise<RoomCreateResponse> {
    return new Promise((resolve) => {
      this.socket.emit('room:create', { displayName, quizId, authToken: this.authService.getToken() ?? undefined }, (res) => {
        this.applyJoinResult(res);
        resolve(res);
      });
    });
  }

  joinRoom(roomCode: string, displayName: string): Promise<RoomJoinResponse> {
    return new Promise((resolve) => {
      this.socket.emit('room:join', { roomCode, displayName, authToken: this.authService.getToken() ?? undefined }, (res) => {
        this.applyJoinResult(res);
        resolve(res);
      });
    });
  }

  startMatch(): Promise<RoomStartResponse> {
    return new Promise((resolve) => {
      this.socket.emit('room:start', (res) => {
        if (!res.ok) this.errorMessage.set(res.error ?? 'Could not start the match.');
        resolve(res);
      });
    });
  }

  submitAnswer(choiceIndex: number): Promise<AnswerSubmitResponse> {
    return new Promise((resolve) => {
      this.socket.emit('answer:submit', { choiceIndex }, (res) => resolve(res));
    });
  }

  reportClimbProgress(progress: number): void {
    this.socket.emit('climb:progress', { progress });
  }

  reportPlayerPosition(position: PlayerPosition): void {
    this.socket.emit('player:move', position);
  }

  /**
   * Leaves the finished room and resets local state back to the lobby
   * entry screen. Reconnecting (rather than just resetting local state)
   * gives a fresh socket id, so the server sees this as a clean departure
   * instead of a stale connection lingering in the now-`ended` room.
   */
  leaveRoom(): void {
    this.socket.disconnect();
    this.socket.connect();

    this.roomCode.set(null);
    this.inviteLink.set(null);
    this.playerId.set(null);
    this.isHost.set(false);
    this.lobbyPlayers.set([]);
    this.matchPhase.set('lobby');
    this.questionIndex.set(0);
    this.totalQuestions.set(0);
    this.currentQuestion.set(null);
    this.phaseEndsAt.set(null);
    this.lastCorrectIndex.set(null);
    this.lastAnswers.set({});
    this.myModifier.set('none');
    this.leaderboard.set([]);
    this.finalPlacements.set([]);
    this.errorMessage.set(null);
    this.platformSeed.set(null);
    this.playerPositions.set({});
  }

  private applyJoinResult(res: RoomCreateResponse | RoomJoinResponse): void {
    if (!res.ok) {
      this.errorMessage.set(res.error ?? 'Something went wrong.');
      return;
    }
    this.errorMessage.set(null);
    if (res.roomCode) this.roomCode.set(res.roomCode);
    if (res.playerId) this.playerId.set(res.playerId);
    if (res.isHost !== undefined) this.isHost.set(res.isHost);
    if ('inviteLink' in res && res.inviteLink) this.inviteLink.set(res.inviteLink);
    if (res.platformSeed !== undefined) this.platformSeed.set(res.platformSeed);
  }
}
