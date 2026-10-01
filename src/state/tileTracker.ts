import type { Board, Tile, TileMove } from '../engine';

/** How a tile came to exist. Fixed for its whole life, so its entrance plays exactly once. */
export type Birth =
  /** Present on page load or after a rebuild: no animation. */
  | 'initial'
  /** Part of a new game: spawn animation, no delay. */
  | 'fresh'
  /** Spawned after a move: spawn animation, delayed until the slide ends. */
  | 'spawn'
  /** Created by a merge: pop, delayed until the slide ends. */
  | 'merge';

/** What the UI needs to draw one tile. `id` is what React uses to track it between renders. */
export interface TileView {
  id: number;
  value: number;
  row: number;
  col: number;
  birth: Birth;
}

/** A tile as drawn: live tiles plus ghosts (merge partners still finishing their slide). */
export interface DrawnTile extends TileView {
  ghost: boolean;
}

export interface TrackerState {
  /** Live tiles, always in ascending id order. */
  readonly tiles: readonly TileView[];
  /**
   * Merge partners from the last move. Each keeps its old id and value and sits at the cell
   * it merged into. They exist only so the UI can finish sliding them before they vanish.
   */
  readonly ghosts: readonly TileView[];
  /** The id the next new tile will get. Ids are never reused. */
  readonly nextId: number;
}

const cellKey = (row: number, col: number) => `${row},${col}`;

/** Builds a tracker from a plain board, giving ids in row-major order. */
export function createTracker(board: Board, nextId = 1, birth: Birth = 'initial'): TrackerState {
  const tiles: TileView[] = [];
  let id = nextId;
  for (const [row, values] of board.entries()) {
    for (const [col, value] of values.entries()) {
      if (value !== 0) tiles.push({ id: id++, value, row, col, birth });
    }
  }
  return { tiles, ghosts: [], nextId: id };
}

/** True if the tiles describe exactly the board: same cells, same values, nothing extra. */
export function matchesBoard(tiles: readonly TileView[], board: Board): boolean {
  let occupied = 0;
  for (const row of board) {
    for (const value of row) {
      if (value !== 0) occupied += 1;
    }
  }

  const cells = new Set(tiles.map((tile) => cellKey(tile.row, tile.col)));
  if (tiles.length !== occupied || cells.size !== tiles.length) return false;
  return tiles.every((tile) => board[tile.row]?.[tile.col] === tile.value);
}

/** Returns the tracker unchanged if it matches the board, otherwise rebuilds it from the board. */
export function syncTracker(tracker: TrackerState, board: Board): TrackerState {
  return matchesBoard(tracker.tiles, board) ? tracker : createTracker(board, tracker.nextId);
}

/**
 * Applies one move's trace to the tile list. Pure: never mutates.
 * Throws if the trace doesn't describe the tiles it was given. Callers run syncTracker first.
 */
export function advanceTracker(
  prev: TrackerState,
  moves: readonly TileMove[],
  spawned: Tile | null,
): TrackerState {
  if (moves.length !== prev.tiles.length) {
    throw new Error(`Tile tracker out of sync: ${prev.tiles.length} tiles, ${moves.length} moves`);
  }

  const moveFrom = new Map<string, TileMove>();
  for (const step of moves) moveFrom.set(cellKey(step.from.row, step.from.col), step);

  const tiles: TileView[] = [];
  const ghosts: TileView[] = [];
  const mergedCells = new Map<string, { row: number; col: number; value: number }>();

  for (const tile of prev.tiles) {
    const step = moveFrom.get(cellKey(tile.row, tile.col));
    if (!step || step.value !== tile.value) {
      throw new Error(`Tile tracker out of sync at ${tile.row},${tile.col}`);
    }

    const { row, col } = step.to;
    if (step.merged) {
      ghosts.push({ ...tile, row, col });
      mergedCells.set(cellKey(row, col), { row, col, value: step.value * 2 });
    } else {
      tiles.push({ ...tile, row, col });
    }
  }

  // New tiles are appended in a fixed order, so the list stays sorted by id.
  let nextId = prev.nextId;
  const merged = [...mergedCells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const cell of merged) tiles.push({ id: nextId++, ...cell, birth: 'merge' });
  if (spawned) {
    tiles.push({
      id: nextId++,
      value: spawned.value,
      row: spawned.row,
      col: spawned.col,
      birth: 'spawn',
    });
  }

  return { tiles, ghosts, nextId };
}

/**
 * Every tile that should be in the DOM, in ascending id order.
 *
 * The order matters: browsers cancel a running CSS transition when a node is moved in the DOM.
 * Survivors and ghosts keep their ids, and new tiles have the highest ids, so React only ever
 * appends. Nodes are never reordered.
 */
export function drawOrder(tracker: TrackerState): DrawnTile[] {
  return [
    ...tracker.tiles.map((tile) => ({ ...tile, ghost: false })),
    ...tracker.ghosts.map((tile) => ({ ...tile, ghost: true })),
  ].sort((a, b) => a.id - b.id);
}
