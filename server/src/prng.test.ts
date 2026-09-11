import { describe, it, expect } from 'vitest';
import { createSeededRandom, seededBetween } from '@quizjumper/shared/prng';

describe('createSeededRandom', () => {
  it('produces the same sequence for two generators seeded identically', () => {
    const a = createSeededRandom(123456);
    const b = createSeededRandom(123456);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, createSeededRandom(1));
    const b = Array.from({ length: 20 }, createSeededRandom(2));
    expect(a).not.toEqual(b);
  });

  it('stays within [0, 1)', () => {
    const random = createSeededRandom(987654321);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is deterministic across calls for a fixed seed (regression guard on the algorithm itself)', () => {
    // Pinned literals, not a self-comparison: if the algorithm is ever swapped,
    // already-running clients and this test would disagree — that's the bug.
    const random = createSeededRandom(42);
    expect([random(), random(), random()].map((v) => Number(v.toFixed(10)))).toEqual([
      0.6011037519, 0.448290559, 0.8524657935
    ]);
  });
});

describe('seededBetween', () => {
  it('returns inclusive integers within the requested range', () => {
    const random = createSeededRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const value = seededBetween(random, 3, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('handles a single-value range', () => {
    const random = createSeededRandom(11);
    expect(seededBetween(random, 5, 5)).toBe(5);
  });
});
