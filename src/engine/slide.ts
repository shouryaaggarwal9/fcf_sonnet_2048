import type { Row } from './types';

export interface SlideResult {
  /** The row after sliding and merging. Always the same length as the input. */
  row: number[];
  /** Points earned: the sum of every tile created by a merge. */
  score: number;
  /** True if the row changed. A move that changes nothing is not a legal move. */
  moved: boolean;
}

/** One tile's journey along a single row. */
export interface LineMove {
  from: number;
  to: number;
  value: number;
  merged: boolean;
}

export interface DetailedSlideResult extends SlideResult {
  /** One entry per non-empty input tile, in reading order. Merge partners share a `to`. */
  moves: LineMove[];
}

/** Like slideRow, but also reports where every tile went. Pure: never mutates. */
export function slideRowDetailed(input: Row): DetailedSlideResult {
  const tiles: { index: number; value: number }[] = [];
  for (const [index, value] of input.entries()) {
    if (value !== 0) tiles.push({ index, value });
  }

  const row: number[] = [];
  const moves: LineMove[] = [];
  let score = 0;

  let i = 0;
  while (i < tiles.length) {
    const current = tiles[i];
    if (!current) break;

    const next = tiles[i + 1];
    const to = row.length;

    if (next && next.value === current.value) {
      const merged = current.value * 2;
      row.push(merged);
      score += merged;
      moves.push({
        from: current.index,
        to,
        value: current.value,
        merged: true,
      });
      moves.push({ from: next.index, to, value: next.value, merged: true });
      i += 2; // skip the partner, so a merged tile can't merge again
    } else {
      row.push(current.value);
      moves.push({
        from: current.index,
        to,
        value: current.value,
        merged: false,
      });
      i += 1;
    }
  }

  while (row.length < input.length) {
    row.push(0);
  }

  const moved = row.some((value, index) => value !== input[index]);
  return { row, score, moved, moves };
}

/** Slides a row toward index 0, merging equal neighbors once per move. Pure: never mutates. */
export function slideRow(input: Row): SlideResult {
  const { row, score, moved } = slideRowDetailed(input);
  return { row, score, moved };
}
