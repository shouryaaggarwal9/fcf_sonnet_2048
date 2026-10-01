import { describe, expect, it } from 'vitest';
import { slideRow, slideRowDetailed } from './slide';

type Case = [name: string, input: number[], row: number[], score: number, moved: boolean];

const cases: Case[] = [
  ['empty row stays empty', [0, 0, 0, 0], [0, 0, 0, 0], 0, false],
  ['tile already at the edge does not move', [2, 0, 0, 0], [2, 0, 0, 0], 0, false],
  ['single tile slides to the edge', [0, 0, 0, 2], [2, 0, 0, 0], 0, true],
  ['full row with no merges does not move', [2, 4, 2, 4], [2, 4, 2, 4], 0, false],
  ['two equal tiles merge', [2, 2, 0, 0], [4, 0, 0, 0], 4, true],
  ['equal tiles merge across a gap', [2, 0, 2, 4], [4, 4, 0, 0], 4, true],
  ['[2,2,2,2] becomes [4,4,0,0]', [2, 2, 2, 2], [4, 4, 0, 0], 8, true],
  ['[2,2,4,0] becomes [4,4,0,0]', [2, 2, 4, 0], [4, 4, 0, 0], 4, true],
  ['[4,2,2,0] becomes [4,4,0,0]', [4, 2, 2, 0], [4, 4, 0, 0], 4, true],
  ['three equal tiles merge the leading pair', [2, 2, 2, 0], [4, 2, 0, 0], 4, true],
  ['[4,4,4,0] becomes [8,4,0,0]', [4, 4, 4, 0], [8, 4, 0, 0], 8, true],
  ['a merged tile cannot merge again', [2, 2, 4, 8], [4, 4, 8, 0], 4, true],
  ['large values merge correctly', [2048, 2048, 0, 0], [4096, 0, 0, 0], 4096, true],
  ['works on rows of length 3', [2, 2, 2], [4, 2, 0], 4, true],
  ['works on rows of length 5', [2, 2, 2, 2, 2], [4, 4, 2, 0, 0], 8, true],
];

describe('slideRow', () => {
  it.each(cases)('%s', (_name, input, row, score, moved) => {
    expect(slideRow(input)).toEqual({ row, score, moved });
  });

  it('does not mutate its input', () => {
    const input = [2, 2, 0, 4];
    slideRow(input);
    expect(input).toEqual([2, 2, 0, 4]);
  });

  it('returns a row of the same length as the input', () => {
    expect(slideRow([0, 2, 0, 0, 2, 0]).row).toHaveLength(6);
  });
});

describe('slideRowDetailed', () => {
  it.each(cases)('agrees with slideRow: %s', (_name, input) => {
    const { moves, ...rest } = slideRowDetailed(input);
    expect(rest).toEqual(slideRow(input));
    expect(moves).toHaveLength(input.filter((value) => value !== 0).length);
  });

  it('traces a plain slide', () => {
    expect(slideRowDetailed([0, 0, 0, 2]).moves).toEqual([
      { from: 3, to: 0, value: 2, merged: false },
    ]);
  });

  it('traces a tile that does not move', () => {
    expect(slideRowDetailed([2, 0, 0, 0]).moves).toEqual([
      { from: 0, to: 0, value: 2, merged: false },
    ]);
  });

  it('traces a merge as two tiles sharing one destination', () => {
    expect(slideRowDetailed([2, 2, 2, 0]).moves).toEqual([
      { from: 0, to: 0, value: 2, merged: true },
      { from: 1, to: 0, value: 2, merged: true },
      { from: 2, to: 1, value: 2, merged: false },
    ]);
  });

  it('traces two separate merges in [2,2,2,2]', () => {
    expect(slideRowDetailed([2, 2, 2, 2]).moves).toEqual([
      { from: 0, to: 0, value: 2, merged: true },
      { from: 1, to: 0, value: 2, merged: true },
      { from: 2, to: 1, value: 2, merged: true },
      { from: 3, to: 1, value: 2, merged: true },
    ]);
  });
});
