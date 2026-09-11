import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@quizjumper/shared/events';

import {
  createRoom,
  getRoom,
  deleteRoom,
  addPlayer,
  removePlayerBySocketId,
  setPlayerPosition
} from './rooms.js';
import { startMatch, submitAnswer, reportClimbProgress, broadcastLobby } from './match.js';
import { authRouter } from './auth/routes.js';
import { quizBuilderRouter } from './quiz-builder/routes.js';
import { quizGenerationRouter } from './quiz-generation/routes.js';
import { quizLibraryRouter } from './quiz-library/routes.js';
import { resolveQuizForRoom } from './quiz-builder/gameplay.js';
import { matchHistoryRouter } from './match-history/routes.js';
import { verifyAccessToken } from './auth/jwt.js';

/** Resolves an optional socket-payload authToken to a userId, or undefined for a missing/invalid token — never throws, never rejects the caller (see design.md decision 1). */
function resolveSocketUserId(authToken?: string): string | undefined {
  if (!authToken) return undefined;
  return verifyAccessToken(authToken)?.userId;
}

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:4200';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
// New, additive-only auth surface — does not touch any room/match/socket
// route or state below.
app.use('/auth', authRouter);
// Public, unauthenticated browsing/search/filter of published quizzes plus
// the tag catalog — kept out of quizBuilderRouter since it carries no
// ownership/auth middleware at all. Mounted before quizBuilderRouter so
// GET /quizzes/published matches this router's specific route rather than
// quizBuilderRouter's GET /quizzes/:id (which would otherwise treat
// "published" as an id, since Express matches routers in mount order).
app.use(quizLibraryRouter);
// Quiz-builder CRUD (routes already carry their own /quizzes, /questions
// prefixes) — likewise additive, does not touch any room/match/socket route.
app.use(quizBuilderRouter);
// AI quiz generation (POST /quizzes/generate) — writes into the same
// quizzes/questions tables as quizBuilderRouter but via its own module.
app.use(quizGenerationRouter);
// Match history (persisted at game-end, read via requireAuth routes) —
// additive, does not touch any room/match/socket route.
app.use(matchHistoryRouter);

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: CLIENT_ORIGIN } }
);

io.on('connection', (socket) => {
  socket.on('room:create', async ({ displayName, quizId, authToken }, ack) => {
    if (!displayName || typeof displayName !== 'string') {
      ack({ ok: false, error: 'Se requiere un nombre para mostrar.' });
      return;
    }
    if (!quizId || typeof quizId !== 'string') {
      ack({ ok: false, error: 'Se requiere seleccionar un quiz.' });
      return;
    }
    let quiz;
    try {
      quiz = await resolveQuizForRoom(quizId);
    } catch {
      ack({ ok: false, error: 'No se pudo cargar el quiz seleccionado.' });
      return;
    }
    const room = createRoom({ baseUrl: CLIENT_ORIGIN, quiz });
    const userId = resolveSocketUserId(authToken);
    const { playerId, isHost } = addPlayer(room, { displayName, socketId: socket.id, userId });

    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = playerId;

    ack({
      ok: true,
      roomCode: room.code,
      inviteLink: room.inviteLink,
      playerId,
      isHost,
      platformSeed: room.platformSeed
    });
    broadcastLobby(io, room);
  });

  socket.on('room:join', ({ roomCode, displayName, authToken }, ack) => {
    if (!roomCode || !displayName) {
      ack({ ok: false, error: 'Se requieren el código de sala y un nombre para mostrar.' });
      return;
    }
    const room = getRoom(String(roomCode).toUpperCase());
    if (!room) {
      ack({ ok: false, error: 'Sala no encontrada.' });
      return;
    }
    if (room.status !== 'lobby') {
      ack({ ok: false, error: 'Esta sala ya comenzó y ya no se puede unir.' });
      return;
    }

    const userId = resolveSocketUserId(authToken);
    const { playerId, isHost } = addPlayer(room, { displayName, socketId: socket.id, userId });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = playerId;

    ack({ ok: true, roomCode: room.code, playerId, isHost, platformSeed: room.platformSeed });
    broadcastLobby(io, room);
  });

  socket.on('room:start', (ack) => {
    const { roomCode, playerId } = socket.data;
    const room = roomCode ? getRoom(roomCode) : null;
    if (!room) {
      ack({ ok: false, error: 'Sala no encontrada.' });
      return;
    }
    if (room.hostPlayerId !== playerId) {
      ack({ ok: false, error: 'Solo el anfitrión puede iniciar la partida.' });
      return;
    }
    if (room.status !== 'lobby') {
      ack({ ok: false, error: 'La partida ya comenzó.' });
      return;
    }
    if (room.players.size < 1 || !room.quiz) {
      ack({ ok: false, error: 'La sala necesita al menos un jugador y un cuestionario para iniciar.' });
      return;
    }

    startMatch(io, room);
    ack({ ok: true });
  });

  socket.on('answer:submit', ({ choiceIndex }, ack) => {
    const { roomCode, playerId } = socket.data;
    const room = roomCode ? getRoom(roomCode) : null;
    if (!room || !playerId) {
      ack({ ok: false, error: 'Sala no encontrada.' });
      return;
    }
    const result = submitAnswer(io, room, playerId, choiceIndex);
    ack(result.accepted ? { ok: true } : { ok: false, error: result.reason });
  });

  socket.on('climb:progress', ({ progress }) => {
    const { roomCode, playerId } = socket.data;
    const room = roomCode ? getRoom(roomCode) : null;
    if (!room || !playerId || typeof progress !== 'number') return;
    reportClimbProgress(io, room, playerId, progress);
  });

  socket.on('player:move', ({ x, y, facingRight, animKey }) => {
    const { roomCode, playerId } = socket.data;
    const room = roomCode ? getRoom(roomCode) : null;
    if (!room || !playerId) return;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (animKey !== 'idle' && animKey !== 'walk' && animKey !== 'jump') return;
    setPlayerPosition(room, playerId, { x, y, facingRight: Boolean(facingRight), animKey });
  });

  socket.on('disconnect', () => {
    const { roomCode } = socket.data;
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;

    removePlayerBySocketId(room, socket.id);

    if (room.status === 'lobby') {
      if (room.players.size === 0) {
        deleteRoom(room.code);
      } else {
        broadcastLobby(io, room);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`QuizJumper server listening on http://localhost:${PORT}`);
});
