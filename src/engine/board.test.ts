import { describe, expect, it } from 'vitest';
import { cloneBoard, createEmptyBoard, reverseRows, transpose } from './board';
import type { Board } from './types';

const grid: Board = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

describe('createEmptyBoard', () => {
  it('defaults to a 4x4 board of zeros', () => {
    expect(createEmptyBoard()).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  it('supports custom sizes', () => {
    const board = createEmptyBoard(6);
    expect(board).toHaveLength(6);
    expect(board.every((row) => row.length === 6)).toBe(true);
  });

  it('does not share row arrays between rows', () => {
    const board = createEmptyBoard(3);
    expect(board[0]).not.toBe(board[1]);
  });

  it.each([0, -1, 2.5, Number.NaN])('rejects invalid size %s', (size) => {
    expect(() => createEmptyBoard(size)).toThrow(RangeError);
  });
});

describe('cloneBoard', () => {
  it('returns an equal but fully independent copy', () => {
    const copy = cloneBoard(grid);
    expect(copy).toEqual(grid);
    expect(copy).not.toBe(grid);
    expect(copy[0]).not.toBe(grid[0]);
  });
});

describe('transpose', () => {
  it('swaps rows and columns', () => {
    expect(transpose(grid)).toEqual([
      [1, 4, 7],
      [2, 5, 8],
      [3, 6, 9],
    ]);
  });

  it('is its own inverse', () => {
    expect(transpose(transpose(grid))).toEqual(grid);
  });

  it('does not mutate its input', () => {
    const before = structuredClone(grid);
    transpose(grid);
    expect(grid).toEqual(before);
  });
});

describe('reverseRows', () => {
  it('mirrors each row', () => {
    expect(reverseRows(grid)).toEqual([
      [3, 2, 1],
      [6, 5, 4],
      [9, 8, 7],
    ]);
  });

  it('is its own inverse', () => {
    expect(reverseRows(reverseRows(grid))).toEqual(grid);
  });

  it('does not mutate its input', () => {
    const before = structuredClone(grid);
    reverseRows(grid);
    expect(grid).toEqual(before);
  });
});
