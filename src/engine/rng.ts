/** Returns a number in [0, 1). Same contract as Math.random, but deterministic when seeded. */
export type Rng = () => number;

/**
 * Creates a deterministic generator using mulberry32: tiny, fast, and good enough for a game.
 * The seed is coerced to an unsigned 32-bit integer.
 */
export function createRng(seed: number): Rng {
  let state = seed | 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
