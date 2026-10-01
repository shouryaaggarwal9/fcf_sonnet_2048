import { describe, expect, it } from 'vitest';
import { slideRow } from './slide';

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
