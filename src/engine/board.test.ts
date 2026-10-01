import { describe, expect, it } from 'vitest';
import {
  cloneBoard,
  createEmptyBoard,
  getEmptyCells,
  getMaxTile,
  hasAvailableMoves,
  reverseRows,
  transpose,
} from './board';
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

describe('getEmptyCells', () => {
  it('lists empty cells in row-major order', () => {
    const board: Board = [
      [2, 0, 4],
      [0, 8, 0],
      [16, 32, 0],
    ];
    expect(getEmptyCells(board)).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
    ]);
  });

  it('returns every cell for an empty board', () => {
    expect(getEmptyCells(createEmptyBoard(3))).toHaveLength(9);
  });

  it('returns an empty list for a full board', () => {
    expect(getEmptyCells(grid)).toEqual([]);
  });
});

describe('hasAvailableMoves', () => {
  it('is true when any cell is empty', () => {
    expect(
      hasAvailableMoves([
        [2, 4],
        [4, 0],
      ]),
    ).toBe(true);
  });

  it('is true on a full board with a horizontal pair', () => {
    expect(
      hasAvailableMoves([
        [2, 2],
        [4, 8],
      ]),
    ).toBe(true);
  });

  it('is true on a full board with a vertical pair', () => {
    expect(
      hasAvailableMoves([
        [2, 4],
        [2, 8],
      ]),
    ).toBe(true);
  });

  it('is false on a full board with no equal neighbors', () => {
    expect(
      hasAvailableMoves([
        [2, 4, 2],
        [4, 2, 4],
        [2, 4, 2],
      ]),
    ).toBe(false);
  });

  it('does not treat the end of one row and the start of the next as neighbors', () => {
    // Row 0 ends in 4 and row 1 starts with 4, but they are not adjacent.
    expect(
      hasAvailableMoves([
        [2, 4],
        [4, 2],
      ]),
    ).toBe(false);
  });
});

describe('getMaxTile', () => {
  it('returns the largest value', () => {
    expect(getMaxTile(grid)).toBe(9);
  });

  it('returns 0 for an empty board', () => {
    expect(getMaxTile(createEmptyBoard(4))).toBe(0);
  });
});
