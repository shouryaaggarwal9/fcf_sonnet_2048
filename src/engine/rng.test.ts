import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

function take(count: number, seed: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng());
}

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(20, 42)).toEqual(take(20, 42));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(5, 1)).not.toEqual(take(5, 2));
  });

  it('only returns values in [0, 1)', () => {
    for (const value of take(10_000, 7)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is roughly uniform', () => {
    const values = take(10_000, 123);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('keeps generators independent of each other', () => {
    const a = createRng(5);
    const b = createRng(5);
    a();
    a();
    a();
    expect(b()).toBe(take(1, 5)[0]);
  });
});
