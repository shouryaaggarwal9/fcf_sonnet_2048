import { describe, expect, it } from 'vitest';
import { move } from './move';
import type { Board, Direction } from './types';

const sample: Board = [
  [2, 0, 2, 0],
  [0, 4, 0, 4],
  [2, 2, 0, 0],
  [0, 0, 0, 8],
];

type Case = [direction: Direction, board: number[][], score: number];

const cases: Case[] = [
  [
    'left',
    [
      [4, 0, 0, 0],
      [8, 0, 0, 0],
      [4, 0, 0, 0],
      [8, 0, 0, 0],
    ],
    16,
  ],
  [
    'right',
    [
      [0, 0, 0, 4],
      [0, 0, 0, 8],
      [0, 0, 0, 4],
      [0, 0, 0, 8],
    ],
    16,
  ],
  [
    'up',
    [
      [4, 4, 2, 4],
      [0, 2, 0, 8],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    4,
  ],
  [
    'down',
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 4, 0, 4],
      [4, 2, 2, 8],
    ],
    4,
  ],
];

describe('move', () => {
  it.each(cases)('moves %s', (direction, board, score) => {
    expect(move(sample, direction)).toEqual({ board, score, moved: true });
  });

  it('reports moved=false when the move changes nothing', () => {
    const packed: Board = [
      [2, 4, 0, 0],
      [8, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(move(packed, 'left')).toEqual({
      board: packed,
      score: 0,
      moved: false,
    });
    expect(move(packed, 'up')).toEqual({
      board: packed,
      score: 0,
      moved: false,
    });
    expect(move(packed, 'right').moved).toBe(true);
  });

  it('reports moved=false in every direction on a full board with no merges', () => {
    const locked: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      expect(move(locked, direction)).toEqual({
        board: locked,
        score: 0,
        moved: false,
      });
    }
  });

  it('merges toward the wall being moved to, not always toward the left', () => {
    const board: Board = [
      [2, 2, 2],
      [0, 0, 0],
      [0, 0, 0],
    ];
    expect(move(board, 'left').board[0]).toEqual([4, 2, 0]);
    expect(move(board, 'right').board[0]).toEqual([0, 2, 4]);
  });

  it('works on non-4x4 boards', () => {
    const board: Board = [
      [2, 2, 2],
      [0, 0, 0],
      [0, 0, 0],
    ];
    expect(move(board, 'left')).toEqual({
      board: [
        [4, 2, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      score: 4,
      moved: true,
    });
    expect(move(board, 'up').moved).toBe(false);
  });

  it('does not mutate the input board', () => {
    const before = structuredClone(sample);
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      move(sample, direction);
    }
    expect(sample).toEqual(before);
  });
});
