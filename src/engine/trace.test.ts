import { describe, expect, it } from 'vitest';
import { moveDetailed } from './move';
import { createRng, type Rng } from './rng';
import type { Board, Direction, TileMove } from './types';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

const t = (
  from: [row: number, col: number],
  to: [row: number, col: number],
  value: number,
  merged = false,
): TileMove => ({
  from: { row: from[0], col: from[1] },
  to: { row: to[0], col: to[1] },
  value,
  merged,
});

const byFrom = (a: TileMove, b: TileMove) => a.from.row - b.from.row || a.from.col - b.from.col;
const trace = (board: Board, direction: Direction) =>
  [...moveDetailed(board, direction).moves].sort(byFrom);

const hand: Board = [
  [2, 2, 2],
  [0, 0, 0],
  [0, 0, 4],
];

describe('moveDetailed trace, worked by hand', () => {
  it('left: the leading pair merges and the third tile slides up against it', () => {
    expect(trace(hand, 'left')).toEqual([
      t([0, 0], [0, 0], 2, true),
      t([0, 1], [0, 0], 2, true),
      t([0, 2], [0, 1], 2),
      t([2, 2], [2, 0], 4),
    ]);
  });

  it('right: the pair nearest the right wall merges', () => {
    expect(trace(hand, 'right')).toEqual([
      t([0, 0], [0, 1], 2),
      t([0, 1], [0, 2], 2, true),
      t([0, 2], [0, 2], 2, true),
      t([2, 2], [2, 2], 4),
    ]);
  });

  it('up: column 2 closes its gap, nothing merges', () => {
    expect(trace(hand, 'up')).toEqual([
      t([0, 0], [0, 0], 2),
      t([0, 1], [0, 1], 2),
      t([0, 2], [0, 2], 2),
      t([2, 2], [1, 2], 4),
    ]);
  });

  it('down: everything falls to the bottom, column 2 stacks the 4 under the 2', () => {
    expect(trace(hand, 'down')).toEqual([
      t([0, 0], [2, 0], 2),
      t([0, 1], [2, 1], 2),
      t([0, 2], [1, 2], 2),
      t([2, 2], [2, 2], 4),
    ]);
  });
});

function randomBoard(rng: Rng, size: number): Board {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => (rng() < 0.4 ? 0 : 2 ** (1 + Math.floor(rng() * 4)))),
  );
}

function travelsTheRightWay({ from, to }: TileMove, direction: Direction): boolean {
  switch (direction) {
    case 'left':
      return to.row === from.row && to.col <= from.col;
    case 'right':
      return to.row === from.row && to.col >= from.col;
    case 'up':
      return to.col === from.col && to.row <= from.row;
    case 'down':
      return to.col === from.col && to.row >= from.row;
  }
}

const key = (p: { row: number; col: number }) => `${p.row},${p.col}`;
const countTiles = (board: Board) => board.flat().filter((value) => value !== 0).length;

function checkTrace(before: Board, direction: Direction) {
  const { board: after, moves, moved } = moveDetailed(before, direction);
  const context = `${direction} on ${JSON.stringify(before)}`;

  // Every tile on the board is reported exactly once, with its true value.
  expect(moves, context).toHaveLength(countTiles(before));
  expect(new Set(moves.map((step) => key(step.from))).size, context).toBe(moves.length);
  for (const step of moves) {
    expect(before[step.from.row]?.[step.from.col], context).toBe(step.value);
    expect(travelsTheRightWay(step, direction), `${context} moved the wrong way`).toBe(true);
  }

  // Group by destination: one lone tile, or exactly two equal partners that merged.
  const groups = new Map<string, TileMove[]>();
  for (const step of moves) {
    const k = key(step.to);
    groups.set(k, [...(groups.get(k) ?? []), step]);
  }

  for (const group of groups.values()) {
    const [first, second] = group;
    if (!first) throw new Error('empty group');
    const result = after[first.to.row]?.[first.to.col];

    expect(group.length, context).toBeLessThanOrEqual(2);
    if (second) {
      expect(first.merged && second.merged, context).toBe(true);
      expect(first.value, context).toBe(second.value);
      expect(result, context).toBe(first.value * 2);
    } else {
      expect(first.merged, context).toBe(false);
      expect(result, context).toBe(first.value);
    }
  }

  // Destinations are exactly the occupied cells of the new board.
  expect(groups.size, context).toBe(countTiles(after));

  // `moved` agrees with the trace.
  const anyChange = moves.some((step) => step.merged || key(step.from) !== key(step.to));
  expect(moved, context).toBe(anyChange);
}

describe('moveDetailed trace invariants', () => {
  it.each(DIRECTIONS)('hold on 300 random boards of sizes 3 to 5: %s', (direction) => {
    const rng = createRng(2025);
    for (let i = 0; i < 300; i++) {
      checkTrace(randomBoard(rng, 3 + (i % 3)), direction);
    }
  });
});
