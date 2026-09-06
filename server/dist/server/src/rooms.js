import crypto from 'node:crypto';
import { pickRandomQuiz } from './quizzes.js';
// Unambiguous alphabet (no 0/O/1/I) for typeable room codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const rooms = new Map();
function generateRoomCode() {
    let code;
    do {
        code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
    } while (rooms.has(code));
    return code;
}
export function createRoom({ baseUrl = '' } = {}) {
    const code = generateRoomCode();
    const room = {
        code,
        inviteLink: `${baseUrl}/join/${code}`,
        hostPlayerId: null,
        status: 'lobby',
        quiz: pickRandomQuiz(),
        currentQuestionIndex: -1,
        players: new Map(),
        answers: new Map(),
        scores: new Map(),
        modifiers: new Map(),
        phaseTimer: null,
        phaseEndsAt: null
    };
    rooms.set(code, room);
    return room;
}
export function getRoom(code) {
    return rooms.get(code) ?? null;
}
export function deleteRoom(code) {
    const room = rooms.get(code);
    if (room?.phaseTimer)
        clearTimeout(room.phaseTimer);
    rooms.delete(code);
}
export function addPlayer(room, { displayName, socketId }) {
    const playerId = crypto.randomUUID();
    const isHost = room.players.size === 0;
    room.players.set(playerId, {
        displayName,
        socketId,
        connected: true,
        climbProgress: 0
    });
    room.scores.set(playerId, { correctness: 0, speed: 0, placement: 0, total: 0 });
    room.modifiers.set(playerId, 'none');
    if (isHost)
        room.hostPlayerId = playerId;
    return { playerId, isHost };
}
export function removePlayerBySocketId(room, socketId) {
    for (const [playerId, player] of room.players.entries()) {
        if (player.socketId === socketId) {
            if (room.status === 'lobby') {
                room.players.delete(playerId);
                room.scores.delete(playerId);
                room.modifiers.delete(playerId);
                if (room.hostPlayerId === playerId) {
                    const next = room.players.keys().next();
                    room.hostPlayerId = next.done ? null : next.value;
                }
            }
            else {
                player.connected = false;
            }
            return playerId;
        }
    }
    return null;
}
export function getLobbyPlayerList(room) {
    return [...room.players.entries()].map(([playerId, player]) => ({
        playerId,
        displayName: player.displayName,
        isHost: playerId === room.hostPlayerId
    }));
}
export function connectedPlayerIds(room) {
    return [...room.players.entries()]
        .filter(([, player]) => player.connected)
        .map(([playerId]) => playerId);
}
//# sourceMappingURL=rooms.js.map