import { createEmptyBoard, getMaxTile, hasAvailableMoves } from './board';
import { move } from './move';
import { createRng } from './rng';
import { spawnTile } from './spawn';
import type { Board, Direction, GameState, GameStatus, Tile } from './types';

export const WIN_TILE = 2048;
export const STARTING_TILES = 2;

export interface TurnResult {
  /** The new state. If the move was rejected, this is the exact same object that went in. */
  state: GameState;
  moved: boolean;
  /** Points earned by this move alone. */
  gained: number;
  /** The tile that spawned after the move, so the UI can animate it. */
  spawned: Tile | null;
}

function resolveStatus(board: Board, keepPlaying: boolean): GameStatus {
  if (!keepPlaying && getMaxTile(board) >= WIN_TILE) return 'won';
  return hasAvailableMoves(board) ? 'playing' : 'over';
}

/** Starts a fresh game. The same seed and size always produce the same game. */
export function newGame(seed: number, size = 4): GameState {
  const rng = createRng(seed);
  let board = createEmptyBoard(size);
  for (let i = 0; i < STARTING_TILES; i++) {
    board = spawnTile(board, rng).board;
  }

  return {
    board,
    score: 0,
    moves: 0,
    status: resolveStatus(board, false),
    keepPlaying: false,
    seed,
    rngState: rng.getState(),
  };
}

/**
 * Plays one move. Pure: never mutates the state it receives.
 *
 * A move is rejected, returning the same state object, if the game is not in the
 * 'playing' status or if the move would change nothing. Rejected moves spawn no
 * tile and consume no randomness.
 */
export function applyMove(state: GameState, direction: Direction): TurnResult {
  const rejected: TurnResult = {
    state,
    moved: false,
    gained: 0,
    spawned: null,
  };
  if (state.status !== 'playing') return rejected;

  const slid = move(state.board, direction);
  if (!slid.moved) return rejected;

  const rng = createRng(state.rngState);
  const { board, tile } = spawnTile(slid.board, rng);

  return {
    state: {
      ...state,
      board,
      score: state.score + slid.score,
      moves: state.moves + 1,
      status: resolveStatus(board, state.keepPlaying),
      rngState: rng.getState(),
    },
    moved: true,
    gained: slid.score,
    spawned: tile,
  };
}

/** Dismisses the win screen and lets the player keep going. A no-op unless status is 'won'. */
export function continueGame(state: GameState): GameState {
  if (state.status !== 'won') return state;
  return {
    ...state,
    keepPlaying: true,
    status: resolveStatus(state.board, true),
  };
}
