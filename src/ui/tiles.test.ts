import { describe, expect, it } from 'vitest';
import type { Board } from '../engine';
import { boardToTiles, tileTier } from './tiles';

describe('boardToTiles', () => {
  it('returns no tiles for an empty board', () => {
    expect(
      boardToTiles([
        [0, 0],
        [0, 0],
      ]),
    ).toEqual([]);
  });

  it('lists tiles in row-major order with their positions and values', () => {
    const board: Board = [
      [2, 0, 4],
      [0, 8, 0],
      [0, 0, 16],
    ];
    expect(boardToTiles(board)).toEqual([
      { id: '0-0', value: 2, row: 0, col: 0 },
      { id: '0-2', value: 4, row: 0, col: 2 },
      { id: '1-1', value: 8, row: 1, col: 1 },
      { id: '2-2', value: 16, row: 2, col: 2 },
    ]);
  });

  it('gives every tile a unique id', () => {
    const tiles = boardToTiles([
      [2, 2],
      [2, 2],
    ]);
    expect(new Set(tiles.map((tile) => tile.id)).size).toBe(4);
  });
});

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
