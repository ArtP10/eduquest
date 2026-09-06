import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createRoom, getRoom, deleteRoom, addPlayer, removePlayerBySocketId } from './rooms.js';
import { startMatch, submitAnswer, setClimbProgress, broadcastLobby } from './match.js';
const PORT = Number(process.env.PORT) || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:4200';
const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });
io.on('connection', (socket) => {
    socket.on('room:create', ({ displayName }, ack) => {
        if (!displayName || typeof displayName !== 'string') {
            ack({ ok: false, error: 'Se requiere un nombre para mostrar.' });
            return;
        }
        const room = createRoom({ baseUrl: CLIENT_ORIGIN });
        const { playerId, isHost } = addPlayer(room, { displayName, socketId: socket.id });
        socket.join(room.code);
        socket.data.roomCode = room.code;
        socket.data.playerId = playerId;
        ack({
            ok: true,
            roomCode: room.code,
            inviteLink: room.inviteLink,
            playerId,
            isHost
        });
        broadcastLobby(io, room);
    });
    socket.on('room:join', ({ roomCode, displayName }, ack) => {
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
        const { playerId, isHost } = addPlayer(room, { displayName, socketId: socket.id });
        socket.join(room.code);
        socket.data.roomCode = room.code;
        socket.data.playerId = playerId;
        ack({ ok: true, roomCode: room.code, playerId, isHost });
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
        if (!room || !playerId || typeof progress !== 'number')
            return;
        setClimbProgress(room, playerId, progress);
    });
    socket.on('disconnect', () => {
        const { roomCode } = socket.data;
        if (!roomCode)
            return;
        const room = getRoom(roomCode);
        if (!room)
            return;
        removePlayerBySocketId(room, socket.id);
        if (room.status === 'lobby') {
            if (room.players.size === 0) {
                deleteRoom(room.code);
            }
            else {
                broadcastLobby(io, room);
            }
        }
    });
});
httpServer.listen(PORT, () => {
    console.log(`QuizJumper server listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map