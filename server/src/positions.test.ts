import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { PlayersPositionsEvent } from '@quizjumper/shared/events';
import type { Quiz } from '@quizjumper/shared/quiz';

vi.mock('./match-history/matches.js', () => ({
  persistMatch: vi.fn().mockResolvedValue(undefined),
  getQuizGlobalStats: vi.fn().mockResolvedValue(null)
}));

const { createRoom, addPlayer, removePlayerBySocketId, setPlayerPosition, deleteRoom } = await import(
  './rooms.js'
);
const { startMatch } = await import('./match.js');

interface EmitCall {
  target: string;
  event: string;
  payload: unknown;
}

/**
 * Stands in for the Socket.IO server: these assertions are about which payload
 * each recipient is addressed with, which is exactly what `io.to(...).emit(...)`
 * records here — no real transport needed.
 */
function createFakeIo(): { io: any; calls: EmitCall[] } {
  const calls: EmitCall[] = [];
  const io = {
    to: (target: string) => ({
      emit: (event: string, payload: unknown) => {
        calls.push({ target, event, payload });
      }
    })
  };
  return { io, calls };
}

const quiz: Quiz = {
  id: 'quiz-1',
  title: 'Test quiz',
  questions: [{ text: 'Q1', choices: ['a', 'b', 'c', 'd'], correctIndex: 0, seconds: 10 }]
};

function positionsFor(calls: EmitCall[], socketId: string): Record<string, unknown> | undefined {
  const snapshot = [...calls]
    .reverse()
    .find((c) => c.event === 'players:positions' && c.target === socketId);
  return snapshot ? (snapshot.payload as PlayersPositionsEvent).positions : undefined;
}

let roomCode: string | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  if (roomCode) deleteRoom(roomCode);
  roomCode = null;
  vi.useRealTimers();
});

describe('players:positions broadcast', () => {
  it('sends each client every other connected player, never its own entry', () => {
    const { io, calls } = createFakeIo();
    const room = createRoom({ quiz });
    roomCode = room.code;
    const a = addPlayer(room, { displayName: 'Ana', socketId: 'socket-a' });
    const b = addPlayer(room, { displayName: 'Beto', socketId: 'socket-b' });
    const c = addPlayer(room, { displayName: 'Caro', socketId: 'socket-c' });

    setPlayerPosition(room, a.playerId, { x: 10, y: -20, facingRight: true, animKey: 'walk' });
    setPlayerPosition(room, b.playerId, { x: 30, y: -40, facingRight: false, animKey: 'jump' });
    setPlayerPosition(room, c.playerId, { x: 50, y: -60, facingRight: true, animKey: 'idle' });

    startMatch(io, room);
    vi.advanceTimersByTime(100);

    expect(Object.keys(positionsFor(calls, 'socket-a') ?? {}).sort()).toEqual(
      [b.playerId, c.playerId].sort()
    );
    expect(positionsFor(calls, 'socket-a')?.[a.playerId]).toBeUndefined();
    expect(positionsFor(calls, 'socket-b')?.[a.playerId]).toEqual({
      x: 10,
      y: -20,
      facingRight: true,
      animKey: 'walk'
    });
  });

  it('drops a disconnected player from every subsequent snapshot', () => {
    const { io, calls } = createFakeIo();
    const room = createRoom({ quiz });
    roomCode = room.code;
    const a = addPlayer(room, { displayName: 'Ana', socketId: 'socket-a' });
    const b = addPlayer(room, { displayName: 'Beto', socketId: 'socket-b' });

    setPlayerPosition(room, a.playerId, { x: 1, y: -1, facingRight: true, animKey: 'idle' });
    setPlayerPosition(room, b.playerId, { x: 2, y: -2, facingRight: true, animKey: 'idle' });

    startMatch(io, room);
    vi.advanceTimersByTime(100);
    expect(positionsFor(calls, 'socket-a')?.[b.playerId]).toBeDefined();

    removePlayerBySocketId(room, 'socket-b');
    calls.length = 0;
    vi.advanceTimersByTime(300);

    const snapshots = calls.filter((c) => c.event === 'players:positions');
    expect(snapshots.length).toBeGreaterThan(0);
    for (const snapshot of snapshots) {
      expect(snapshot.target).toBe('socket-a');
      expect((snapshot.payload as PlayersPositionsEvent).positions[b.playerId]).toBeUndefined();
    }
  });

  it('stops broadcasting once the match ends', () => {
    const { io, calls } = createFakeIo();
    const room = createRoom({ quiz });
    roomCode = room.code;
    addPlayer(room, { displayName: 'Ana', socketId: 'socket-a' });
    addPlayer(room, { displayName: 'Beto', socketId: 'socket-b' });

    startMatch(io, room);
    // Climb (8s) -> freeze (10s) -> results (4s) -> final climb (4s) -> end,
    // for the single question (see match.ts's startFinalClimbPhase).
    vi.advanceTimersByTime(8000 + 10_000 + 4000 + 4000 + 10);
    expect(room.status).toBe('ended');

    calls.length = 0;
    vi.advanceTimersByTime(1000);
    expect(calls.filter((c) => c.event === 'players:positions')).toHaveLength(0);
  });
});

describe('room platform seed', () => {
  it('issues a 32-bit seed per room', () => {
    const room = createRoom({ quiz });
    roomCode = room.code;
    expect(Number.isInteger(room.platformSeed)).toBe(true);
    expect(room.platformSeed).toBeGreaterThan(0);
    expect(room.platformSeed).toBeLessThan(2 ** 32);
  });
});
