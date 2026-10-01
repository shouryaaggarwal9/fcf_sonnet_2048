/** Returns a number in [0, 1). Same contract as Math.random, but deterministic when seeded. */
export type Rng = () => number;

/** An Rng whose position in its sequence can be saved and resumed. */
export interface SeededRng {
  (): number;
  /** The internal state. Passing it to createRng() resumes the sequence exactly from here. */
  getState(): number;
}

/**
 * Creates a deterministic generator using mulberry32: tiny, fast, and good enough for a game.
 * The seed is coerced to a signed 32-bit integer.
 */
export function createRng(seed: number): SeededRng {
  let state = seed | 0;

  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Object.assign(next, { getState: () => state });
}
