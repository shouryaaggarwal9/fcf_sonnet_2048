import { create } from 'zustand';
import {
  applyMove,
  continueGame,
  type Direction,
  type GameState,
  newGame,
  type Tile,
  type TileMove,
} from '../engine';
import { forPersisting, popSnapshot, pushSnapshot, type Snapshot, undoable } from './history';
import {
  clearSaved,
  loadSaved,
  type Restore,
  recordBest,
  STORAGE_KEY,
  type StorageLike,
  safeStorage,
  saveTo,
} from './persistence';
import {
  type BestScores,
  bestFor,
  DEFAULT_SETTINGS,
  type MotionPreference,
  type SavedData,
  type Settings,
  type ThemePreference,
} from './savedData';
import { seedFromLocation } from './seed';
import { advanceTracker, createTracker, syncTracker, type TrackerState } from './tileTracker';

/** What the last accepted move did. A new object per move, so the UI can use it as a trigger. */
export interface LastTurn {
  gained: number;
  spawned: Tile | null;
  /**
   * Values of the tiles this move created by merging, deduplicated and in ascending order.
   * Empty when nothing merged. Both partners of one merge report the same destination value,
   * so a single merge appears once here, and a move that makes two identical tiles reports
   * that value once. Used to announce merges to a screen reader.
   */
  merged: readonly number[];
}

/** The tiles a move created by merging, from its trace. */
function mergedValues(moves: readonly TileMove[]): readonly number[] {
  const values = new Set<number>();
  for (const step of moves) {
    if (step.merged) values.add(step.value * 2);
  }
  return [...values].sort((a, b) => a - b);
}

interface GameStore {
  game: GameState;
  /** The tiles on screen, with stable ids. Always describes game.board. */
  tracker: TrackerState;
  /** Null at the start of a game, and after any rejected move. */
  lastTurn: LastTurn | null;
  /** Highest score ever reached, per board size. Never decreases. */
  best: BestScores;
  /** User preferences. Theme is applied to <html> by the UI, not by the store. */
  settings: Settings;
  /** States from before each accepted move, oldest first. Bounded by HISTORY_CAP. */
  history: readonly Snapshot[];
  /** How many undos have been used this session. Persisted for a future daily limit. */
  undos: number;
  /**
   * Bumped whenever the board is replaced wholesale (undo, another tab, restore). The board
   * uses it to crossfade instead of trying to animate the change, which would read as a
   * glitch or as tiles sliding backwards.
   */
  boardEpoch: number;
  /** Plays a move. Returns false, changing nothing, if the move was rejected. */
  move: (direction: Direction) => boolean;
  /** Steps back one move. Returns false when there is nothing to undo. */
  undo: () => boolean;
  /** Dismisses the win screen. */
  keepPlaying: () => void;
  /** Saves a preference. */
  setTheme: (theme: ThemePreference) => void;
  /** Shows or hides the on-screen direction pad. */
  setDpad: (enabled: boolean) => void;
  /** Sets how much motion to use. */
  setMotion: (motion: MotionPreference) => void;
  /** Starts a new game. Pass a seed for a reproducible game, or omit it for a random one. */
  restart: (seed?: number) => void;
  /**
   * Replaces the game and tracker with a restored one, keeping ids unique.
   * Used on load and when another tab reports a newer game.
   */
  adopt: (restored: Restore) => void;
}

/** The only place real randomness enters the app. Everything below it is deterministic. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

/**
 * Reads the save and works out the starting state. The tracker is rebuilt from the board
 * with birth 'initial', so a restored game appears without playing its entrance animation.
 */
export function initialState(): {
  game: GameState;
  tracker: TrackerState;
  best: BestScores;
  settings: Settings;
  history: readonly Snapshot[];
  undos: number;
} {
  const saved = loadSaved(storageOrNull());

  /**
   * A ?seed= in the URL picks the starting game, but only when there is nothing saved.
   *
   * Letting the seed always win looks more faithful to the link but is quietly broken: moves
   * are still written to storage, so progress would be saved and then never read, and every
   * reload would silently discard the game. Seeding only a fresh install keeps "reload keeps my
   * game" true, which matters more. The Phase 10 daily challenge needs its own storage key for
   * the same reason: a shared seed must not collide with ordinary play.
   */
  const urlSeed = saved || typeof window === 'undefined' ? null : seedFromLocation(window.location);

  if (!saved) {
    const game = newGame(urlSeed ?? randomSeed());
    return {
      game,
      tracker: createTracker(game.board),
      best: {},
      settings: DEFAULT_SETTINGS,
      history: [],
      undos: 0,
    };
  }
  return {
    game: saved.game,
    tracker: createTracker(saved.game.board, 1, 'initial'),
    best: saved.best,
    settings: saved.settings,
    history: saved.history.map((game) => ({ game })),
    undos: saved.undos,
  };
}

/**
 * Storage is resolved once, lazily. A missing or throwing localStorage yields null, and
 * every write is then skipped: the game runs exactly the same, it just does not persist.
 */
let storage: StorageLike | null | undefined;
function storageOrNull(): StorageLike | null {
  if (storage === undefined) storage = safeStorage();
  return storage;
}

const start = initialState();

export const useGameStore = create<GameStore>()((set, get) => ({
  game: start.game,
  tracker: start.tracker,
  lastTurn: null,
  best: start.best,
  settings: start.settings,
  history: start.history,
  undos: start.undos,
  boardEpoch: 0,

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
      lastTurn: {
        gained: result.gained,
        spawned: result.spawned,
        merged: mergedValues(result.moves),
      },
      // recordBest returns the same object when this is not a new record, so this cannot
      // cause a render of its own.
      best: recordBest(get().best, result.state.board.length, result.state.score),
      // Snapshot the state we are leaving, so undo has somewhere to go back to. A rejected
      // move returns above, so the history only ever holds real moves.
      history: pushSnapshot(get().history, { game }),
    });
    return true;
  },

  undo: () => {
    const target = undoable(get().history);
    if (!target) return false;

    // Ids are reissued from the live nextId rather than restored, so no DOM node is reused.
    // That means no tile can slide from where it used to be, and birth is 'initial' so
    // nothing animates in. The board crossfades instead, via boardEpoch.
    set({
      game: target.game,
      tracker: createTracker(target.game.board, get().tracker.nextId, 'initial'),
      history: popSnapshot(get().history),
      lastTurn: null,
      undos: get().undos + 1,
      boardEpoch: get().boardEpoch + 1,
      // Best is deliberately untouched: undoing a good move must not lower a record.
    });
    return true;
  },

  keepPlaying: () => {
    const next = continueGame(get().game);
    if (next !== get().game) set({ game: next });
  },

  setTheme: (theme) => {
    if (get().settings.theme === theme) return; // no state change, so no re-render
    set({ settings: { ...get().settings, theme } });
  },

  setDpad: (enabled) => {
    if (get().settings.dpad === enabled) return;
    set({ settings: { ...get().settings, dpad: enabled } });
  },

  setMotion: (motion) => {
    if (get().settings.motion === motion) return;
    set({ settings: { ...get().settings, motion } });
  },

  restart: (seed = randomSeed()) => {
    const game = newGame(seed);
    // nextId carries over, so ids stay unique across games and old nodes can't be reused.
    set({
      game,
      tracker: createTracker(game.board, get().tracker.nextId, 'fresh'),
      lastTurn: null,
      // A new game has no past, so there is nothing to undo. Best is kept: a new game never
      // lowers a record.
      history: [],
    });
  },

  adopt: (restored) => {
    set({
      game: restored.game,
      // Ids carry over so no node from the previous game is reused, and birth is 'initial'
      // so the restored board does not animate in.
      tracker: createTracker(restored.game.board, get().tracker.nextId, 'initial'),
      lastTurn: null,
      best: restored.best,
      // Another tab's game supersedes ours, so its history no longer describes this board.
      history: restored.history.map((game) => ({ game })),
      boardEpoch: get().boardEpoch + 1,
    });
  },
}));

/* ---------- Saving ---------- */

/** How long to wait after a move before writing. Coalesces a burst into one write. */
const SAVE_DEBOUNCE_MS = 400;

let saveTimer: number | undefined;

function cancelPendingSave(): void {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
}

function currentSave(): SavedData {
  const { game, best, settings, history, undos } = useGameStore.getState();
  return { game, best, settings, history: forPersisting(history), undos };
}

/** Writes now. Used on page hide, where a pending debounce would never fire. */
export function flushSave(): void {
  cancelPendingSave();
  saveTo(storageOrNull(), currentSave());
}

/** Schedules a write. Repeated calls within the window collapse into one. */
export function scheduleSave(): void {
  if (saveTimer !== undefined) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    saveTo(storageOrNull(), currentSave());
  }, SAVE_DEBOUNCE_MS) as unknown as number;
}

/**
 * Starts persisting: writes on accepted moves, on tab hide, and on page unload.
 *
 * Nothing is written on load, so a corrupt save that we rejected is not immediately
 * rewritten with the fresh game. The next real move replaces it.
 */
export function startPersistence(): () => void {
  const unsubscribe = useGameStore.subscribe((state, previous) => {
    // A rejected move changes nothing. An undo, or a settings change, does.
    if (state.game === previous.game && state.settings === previous.settings) return;
    scheduleSave();
  });

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushSave();
  };
  const onPageHide = () => flushSave();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    unsubscribe();
    cancelPendingSave();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
  };
}

/**
 * Merges another tab's best scores into ours, taking the maximum for every board size.
 *
 * Best never decreases, so this is safe to run on every storage event. The result is a new
 * object only when something actually improved, so no needless re-render.
 */
export function mergeBest(ours: BestScores, theirs: BestScores): BestScores {
  let merged = ours;
  for (const [size, score] of Object.entries(theirs)) {
    const key = Number(size);
    if (bestFor(merged, key) < score) {
      merged = { ...merged, [key]: score };
    }
  }
  return merged;
}

/**
 * Keeps best score consistent across tabs, and takes the other tab's game.
 *
 * The `storage` event only fires in *other* tabs, so this never reacts to our own write.
 * Best takes the maximum of the two, which is why it can never appear to go backwards. The
 * game is last-writer-wins: with two tabs playing, the most recent write is the one you see.
 */
export function startStorageSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    // The event carries newValue, but reading the key back is the same data and keeps one
    // code path: whatever is in storage now, validated the same way as on load.
    const incoming = loadSaved(storageOrNull());
    if (!incoming) return;

    const best = mergeBest(useGameStore.getState().best, incoming.best);
    // Another tab's theme choice is adopted too, so the two windows agree.
    useGameStore.getState().adopt({
      game: incoming.game,
      best,
      settings: incoming.settings,
      history: incoming.history,
    });
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/** Wipes the save. Used by the future error boundary's reset action. */
export function resetSavedGame(): void {
  clearSaved(storageOrNull());
}
