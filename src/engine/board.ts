import type { Board, Position } from './types';

/** Creates a size×size board filled with empty cells (0). */
export function createEmptyBoard(size = 4): Board {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`Board size must be a positive integer, got ${size}`);
  }
  return Array.from({ length: size }, () => Array<number>(size).fill(0));
}

/** Returns a deep copy, so callers can never share rows with the original. */
export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/** Swaps rows and columns. Assumes a square board. */
export function transpose(board: Board): Board {
  return board.map((_, c) => board.map((row) => row[c] ?? 0));
}

/** Mirrors every row horizontally. */
export function reverseRows(board: Board): Board {
  return board.map((row) => [...row].reverse());
}

/** Lists every empty cell in row-major order (top to bottom, left to right). */
export function getEmptyCells(board: Board): Position[] {
  const cells: Position[] = [];
  for (const [row, values] of board.entries()) {
    for (const [col, value] of values.entries()) {
      if (value === 0) cells.push({ row, col });
    }
  }
  return cells;
}
