import { getEmptyCells } from './board';
import type { Rng } from './rng';
import type { Board, Tile } from './types';

export const FOUR_CHANCE = 0.1;

export interface SpawnResult {
  board: Board;
  /** The tile that was added, or null if the board was full. */
  tile: Tile | null;
}

/**
 * Places a 2 (90%) or a 4 (10%) in a random empty cell. Pure: returns a new board.
 *
 * RNG call order is part of the contract, because replays depend on it:
 *   1st call picks the cell, 2nd call picks the value.
 * A full board consumes no randomness.
 */
export function spawnTile(board: Board, rng: Rng, fourChance = FOUR_CHANCE): SpawnResult {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return { board, tile: null };

  const position = empty[Math.floor(rng() * empty.length)];
  if (!position) return { board, tile: null }; // unreachable for a valid rng; satisfies the compiler

  const value = rng() < fourChance ? 4 : 2;
  const next = board.map((row, r) =>
    r === position.row ? row.map((cell, c) => (c === position.col ? value : cell)) : [...row],
  );

  return { board: next, tile: { ...position, value } };
}
