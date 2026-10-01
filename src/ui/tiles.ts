import type { Board } from '../engine';

/** What the UI needs to draw one tile. `id` is what React uses to track it between renders. */
export interface TileView {
  id: string;
  value: number;
  row: number;
  col: number;
}

/** Tiers 1..11 are 2..2048. Everything bigger shares the last tier (the "super" color). */
export const MAX_TIER = 12;

/** 2 → 1, 4 → 2, ... 2048 → 11, 4096 and above → 12. */
export function tileTier(value: number): number {
  return Math.min(Math.max(Math.round(Math.log2(value)), 1), MAX_TIER);
}

/**
 * Lists the tiles on a board in row-major order.
 * Placeholder IDs are positions, so tiles can't animate between cells yet. Phase 4 replaces this.
 */
export function boardToTiles(board: Board): TileView[] {
  const tiles: TileView[] = [];
  for (const [row, values] of board.entries()) {
    for (const [col, value] of values.entries()) {
      if (value !== 0) tiles.push({ id: `${row}-${col}`, value, row, col });
    }
  }
  return tiles;
}
