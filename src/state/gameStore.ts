import { create } from 'zustand';
import {
  applyMove,
  continueGame,
  type Direction,
  type GameState,
  newGame,
  type Tile,
} from '../engine';
import { advanceTracker, createTracker, syncTracker, type TrackerState } from './tileTracker';

/** What the last accepted move did. A new object per move, so the UI can use it as a trigger. */
export interface LastTurn {
  gained: number;
  spawned: Tile | null;
}

interface GameStore {
  game: GameState;
  /** The tiles on screen, with stable ids. Always describes game.board. */
  tracker: TrackerState;
  /** Null at the start of a game, and after any rejected move. */
  lastTurn: LastTurn | null;
  /** Plays a move. Returns false, changing nothing, if the move was rejected. */
  move: (direction: Direction) => boolean;
  /** Dismisses the win screen. */
  keepPlaying: () => void;
  /** Starts a new game. Pass a seed for a reproducible game, or omit it for a random one. */
  restart: (seed?: number) => void;
}

/** The only place real randomness enters the app. Everything below it is deterministic. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

const initialGame = newGame(randomSeed());

export const useGameStore = create<GameStore>()((set, get) => ({
  game: initialGame,
  tracker: createTracker(initialGame.board),
  lastTurn: null,

  move: (direction) => {
    const { game, tracker } = get();
    const result = applyMove(game, direction);
    if (!result.moved) return false; // no state change, so no re-render

    // If the game was replaced without going through restart (tests do this), the tracker is
    // stale. Rebuild it from the old board first, so the trace always applies cleanly.
    const synced = syncTracker(tracker, game.board);

    set({
      game: result.state,
      tracker: advanceTracker(synced, result.moves, result.spawned),
      lastTurn: { gained: result.gained, spawned: result.spawned },
    });
    return true;
  },

  keepPlaying: () => {
    const next = continueGame(get().game);
    if (next !== get().game) set({ game: next });
  },

  restart: (seed = randomSeed()) => {
    const game = newGame(seed);
    // nextId carries over, so ids stay unique across games and old nodes can't be reused.
    set({
      game,
      tracker: createTracker(game.board, get().tracker.nextId, 'fresh'),
      lastTurn: null,
    });
  },
}));
