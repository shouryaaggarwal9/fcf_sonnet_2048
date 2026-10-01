import { describe, expect, it } from 'vitest';
import { tileTier } from './tiles';

describe('tileTier', () => {
  it.each([
    [2, 1],
    [4, 2],
    [8, 3],
    [1024, 10],
    [2048, 11],
    [4096, 12],
    [131072, 12],
  ])('maps %i to tier %i', (value, tier) => {
    expect(tileTier(value)).toBe(tier);
  });
});
