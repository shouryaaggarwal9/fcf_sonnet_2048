export type Direction = 'up' | 'down' | 'left' | 'right';

/** A single row (or column) of tile values. 0 means empty. */
export type Row = readonly number[];

/** A square grid stored as rows. Tile values are 2, 4, 8, ... and 0 means empty. */
export type Board = readonly Row[];

export interface Position {
  row: number;
  col: number;
}

/** A tile with its position. Used for newly spawned tiles so the UI can animate them. */
export interface Tile extends Position {
  value: number;
}

export type GameStatus = 'playing' | 'won' | 'over';

/** Everything needed to save, restore, or replay a game. Plain data, safe for JSON. */
export interface GameState {
  readonly board: Board;
  readonly score: number;
  /** Number of legal moves made. Rejected moves are not counted. */
  readonly moves: number;
  readonly status: GameStatus;
  /** True once the player chose to continue past 2048. */
  readonly keepPlaying: boolean;
  /** The seed the game started from. Kept for replays and sharing. */
  readonly seed: number;
  /** Where the RNG is in its sequence. Lets a restored game continue identically. */
  readonly rngState: number;
}

/** One tile's journey during a move. A tile that doesn't move has from equal to to. */
export interface TileMove {
  from: Position;
  to: Position;
  /** The tile's value before the move. */
  value: number;
  /** True for both partners of a merge. The merged tile's value is value * 2. */
  merged: boolean;
}
