import { describe, expect, it } from 'vitest';
import { createEmptyBoard, getEmptyCells } from './board';
import { createRng, type Rng } from './rng';
import { spawnTile } from './spawn';
import type { Board } from './types';

/** An Rng that returns exactly the given values, then throws. Lets tests control every roll. */
function sequence(...values: number[]): Rng {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) throw new Error('rng exhausted');
    return value;
  };
}

const oneGap: Board = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 0, 4],
  [4, 2, 4, 2],
];

const twoGaps: Board = [
  [0, 2],
  [4, 0],
];

describe('spawnTile', () => {
  it('fills the only empty cell with a 2', () => {
    const result = spawnTile(oneGap, sequence(0.5, 0.5));
    expect(result.tile).toEqual({ row: 2, col: 2, value: 2 });
    expect(result.board[2]).toEqual([2, 4, 2, 4]);
  });

  it('spawns a 4 when the value roll is below the four-chance', () => {
    expect(spawnTile(oneGap, sequence(0.5, 0.05)).tile?.value).toBe(4);
  });

  it('spawns a 2 when the value roll is exactly the four-chance', () => {
    expect(spawnTile(oneGap, sequence(0, 0.1)).tile?.value).toBe(2);
  });

  it('uses the first roll to choose among empty cells in row-major order', () => {
    expect(spawnTile(twoGaps, sequence(0, 0.5)).tile).toMatchObject({
      row: 0,
      col: 0,
    });
    expect(spawnTile(twoGaps, sequence(0.99, 0.5)).tile).toMatchObject({
      row: 1,
      col: 1,
    });
  });

  it('adds exactly one tile and changes nothing else', () => {
    const { board } = spawnTile(twoGaps, sequence(0, 0.5));
    expect(board).toEqual([
      [2, 2],
      [4, 0],
    ]);
  });

  it('returns the board unchanged, consuming no randomness, when it is full', () => {
    const full: Board = [
      [2, 4],
      [4, 2],
    ];
    const result = spawnTile(full, sequence()); // sequence() throws if called
    expect(result).toEqual({ board: full, tile: null });
  });

  it('does not mutate the input board', () => {
    const before = structuredClone(twoGaps);
    spawnTile(twoGaps, sequence(0, 0));
    expect(twoGaps).toEqual(before);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const rng = createRng(2048);
      let board: Board = createEmptyBoard(4);
      for (let i = 0; i < 8; i++) board = spawnTile(board, rng).board;
      return board;
    };
    expect(run()).toEqual(run());
  });

  it('spawns about 10% fours over many spawns', () => {
    const rng = createRng(99);
    let fours = 0;
    const total = 10_000;
    for (let i = 0; i < total; i++) {
      if (spawnTile(createEmptyBoard(4), rng).tile?.value === 4) fours += 1;
    }
    expect(fours / total).toBeGreaterThan(0.08);
    expect(fours / total).toBeLessThan(0.12);
  });

  it('only ever fills a cell that was empty', () => {
    const rng = createRng(1);
    const before = getEmptyCells(twoGaps);
    for (let i = 0; i < 50; i++) {
      const tile = spawnTile(twoGaps, rng).tile;
      expect(before).toContainEqual({ row: tile?.row, col: tile?.col });
    }
  });
});
