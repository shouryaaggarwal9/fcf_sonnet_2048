import type { Row } from './types';

export interface SlideResult {
  /** The row after sliding and merging. Always the same length as the input. */
  row: number[];
  /** Points earned: the sum of every tile created by a merge. */
  score: number;
  /** True if the row changed. A move that changes nothing is not a legal move. */
  moved: boolean;
}

/** Slides a row toward index 0, merging equal neighbors once per move. Pure: never mutates. */
export function slideRow(input: Row): SlideResult {
  const tiles = input.filter((value) => value !== 0);
  const row: number[] = [];
  let score = 0;

  let i = 0;
  while (i < tiles.length) {
    const current = tiles[i];
    if (current === undefined) break;

    if (current === tiles[i + 1]) {
      const merged = current * 2;
      row.push(merged);
      score += merged;
      i += 2; // skip the partner, so a merged tile can't merge again
    } else {
      row.push(current);
      i += 1;
    }
  }

  while (row.length < input.length) {
    row.push(0);
  }

  const moved = row.some((value, index) => value !== input[index]);
  return { row, score, moved };
}
