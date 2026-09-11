// Deterministic PRNG shared by the server (seed generation lives there) and
// the client (platform layout is generated from it). Hand-written rather than
// pulled from npm: it's ~10 lines, and the exact algorithm has to stay frozen
// forever — every client in a room must produce the identical sequence, so a
// dependency silently changing its implementation would desync live matches.

/** mulberry32 — 32-bit state, uniform enough for layout jitter, identical across engines. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Inclusive integer in [min, max], mirroring Phaser.Math.Between's contract so
 * call sites in the platform generator swap over without changing their ranges.
 */
export function seededBetween(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}
