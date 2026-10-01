import { create } from 'zustand';
import {
  applyMove,
  continueGame,
  type Direction,
  type GameState,
  newGame,
  type Tile,
} from '../engine';

/** What the last accepted move did. A new object per move, so the UI can use it as a trigger. */
export interface LastTurn {
  gained: number;
  spawned: Tile | null;
}

interface GameStore {
  game: GameState;
  /** Null at the start of a game, and after any rejected move. */
  lastTurn: LastTurn | null;
  move: (direction: Direction) => void;
  /** Dismisses the win screen. */
  keepPlaying: () => void;
  /** Starts a new game. Pass a seed for a reproducible game, or omit it for a random one. */
  restart: (seed?: number) => void;
}

/** The only place real randomness enters the app. Everything below it is deterministic. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  game: newGame(randomSeed()),
  lastTurn: null,

  move: (direction) => {
    const result = applyMove(get().game, direction);
    if (!result.moved) return; // no state change, so no re-render
    set({
      game: result.state,
      lastTurn: { gained: result.gained, spawned: result.spawned },
    });
  },

  keepPlaying: () => {
    const next = continueGame(get().game);
    if (next !== get().game) set({ game: next });
  },

  restart: (seed = randomSeed()) => {
    set({ game: newGame(seed), lastTurn: null });
  },
}));
