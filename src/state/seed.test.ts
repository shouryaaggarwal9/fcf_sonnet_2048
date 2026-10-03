import { describe, expect, it } from 'vitest';
import { SEED_PARAM, seedFromSearch } from './seed';

describe('seedFromSearch', () => {
  it('reads a plain positive seed', () => {
    expect(seedFromSearch('?seed=123')).toBe(123);
  });

  it('reads a zero seed', () => {
    expect(seedFromSearch('?seed=0')).toBe(0);
  });

  it('reads a negative seed, coerced the way the engine coerces it', () => {
    expect(seedFromSearch('?seed=-1')).toBe(-1);
  });

  it('coerces into the signed 32-bit range, so the URL and the engine cannot disagree', () => {
    expect(seedFromSearch('?seed=4294967296')).toBe(0);
    expect(seedFromSearch('?seed=2147483648')).toBe(-2147483648);
  });

  it('finds the seed among other parameters', () => {
    expect(seedFromSearch('?foo=1&seed=7&bar=2')).toBe(7);
  });

  it('returns null when there is no seed parameter', () => {
    expect(seedFromSearch('')).toBeNull();
    expect(seedFromSearch('?other=1')).toBeNull();
  });

  it('ignores anything that is not a whole number, rather than guessing', () => {
    // A float would be silently truncated by the engine into a different game, so it is
    // refused instead.
    for (const value of ['1.5', 'abc', '', ' ', 'NaN', '0x10', '1e3', '--1']) {
      expect(seedFromSearch(`?seed=${encodeURIComponent(value)}`), value).toBeNull();
    }
  });

  it('ignores a value too large to be a safe integer', () => {
    expect(seedFromSearch('?seed=99999999999999999999')).toBeNull();
  });

  it('reads a first seed when the parameter is repeated', () => {
    expect(seedFromSearch('?seed=5&seed=9')).toBe(5);
  });

  it('exports the parameter name so the tests and any future share link agree', () => {
    expect(SEED_PARAM).toBe('seed');
  });
});
