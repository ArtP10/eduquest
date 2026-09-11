import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Room } from '../rooms.js';

const query = vi.fn();
const connect = vi.fn();

vi.mock('../db.js', () => ({ getPool: () => ({ connect }) }));

const { persistMatch } = await import('./matches.js');

function makeRoom(): Room {
  return {
    code: 'ABCD12',
    inviteLink: 'http://x/join/ABCD12',
    hostPlayerId: 'p1',
    status: 'ended',
    quiz: { id: 'quiz-1', title: 'Algebra', questions: [] },
    platformSeed: 1,
    currentQuestionIndex: 1,
    players: new Map([
      ['p1', { displayName: 'Ada', socketId: 's1', connected: true, climbProgress: 10, userId: 'user-1' }],
      ['p2', { displayName: 'Bea', socketId: 's2', connected: true, climbProgress: 5 }]
    ]),
    answers: new Map(),
    scores: new Map([
      ['p1', { correctAnswers: 1, questionsAnswered: 1 }],
      ['p2', { correctAnswers: 0, questionsAnswered: 1 }]
    ]),
    modifiers: new Map(),
    positions: new Map(),
    phaseTimer: null,
    positionTimer: null,
    phaseEndsAt: null,
    answerLog: [
      {
        playerId: 'p1',
        questionIndex: 0,
        questionText: 'Q1',
        choices: ['a', 'b', 'c', 'd'],
        correctChoiceIndex: 0,
        selectedChoiceIndex: 0,
        isCorrect: true,
        answerTimeMs: 1000
      }
    ]
  };
}

beforeEach(() => {
  query.mockReset();
  connect.mockReset();
});

describe('persistMatch', () => {
  it('returns the persisted matchId and a matchPlayerId for every player in the room', async () => {
    const client = { query, release: vi.fn() };
    connect.mockResolvedValue(client);
    query.mockImplementation((sql: string) => {
      if (sql.startsWith('INSERT INTO matches')) return Promise.resolve({ rows: [{ id: 'match-1' }] });
      if (sql.startsWith('INSERT INTO match_players')) {
        return Promise.resolve({ rows: [{ id: `mp-${query.mock.calls.length}` }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const room = makeRoom();
    const result = await persistMatch(room, [
      { playerId: 'p1', rank: 1, climbProgress: 10 },
      { playerId: 'p2', rank: 2, climbProgress: 5 }
    ]);

    expect(result.matchId).toBe('match-1');
    expect(result.matchPlayerIdByPlayerId.size).toBe(2);
    expect(result.matchPlayerIdByPlayerId.get('p1')).toBeDefined();
    expect(result.matchPlayerIdByPlayerId.get('p2')).toBeDefined();
  });

  it('rolls back and rethrows on failure, without returning anything', async () => {
    const client = { query, release: vi.fn() };
    connect.mockResolvedValue(client);
    query.mockImplementation((sql: string) => {
      if (sql.startsWith('INSERT INTO matches')) return Promise.reject(new Error('connection lost'));
      return Promise.resolve({ rows: [] });
    });

    await expect(persistMatch(makeRoom(), [])).rejects.toThrow('connection lost');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
});
