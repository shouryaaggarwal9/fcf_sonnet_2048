import { type GameState, newGame } from '../engine';
import {
  type BestScores,
  bestFor,
  DEFAULT_SETTINGS,
  migrate,
  recordBest,
  type SavedData,
  SCHEMA_VERSION,
  type Settings,
} from './savedData';

/** One key for everything, so a single write is atomic and cannot half-apply. */
export const STORAGE_KEY = 'fcf-sonnet-2048/v1';

/**
 * The slice of the Web Storage API this module uses. Declared here so tests can pass a
 * fake that throws, which is how private-mode and quota behaviour gets covered.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Returns localStorage, or null when it is unavailable or throws on access.
 *
 * Some browsers throw a SecurityError on touching localStorage at all (private mode with
 * cookies blocked, or a sandboxed iframe). A null result means "play without saving", not
 * an error: the game must be fully playable either way.
 */
export function safeStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // A write probe: quota can be exhausted even when the property reads fine.
    const probe = `${STORAGE_KEY}/probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Everything a fresh install starts with. */
export function emptySave(): SavedData {
  return { game: newGame(1), best: {}, settings: DEFAULT_SETTINGS };
}

/**
 * Reads saved data. Returns null for anything unusable, including invalid JSON, a wrong
 * version, or a payload that fails validation, so a corrupt save can never break startup.
 */
export function loadSaved(storage: StorageLike | null): SavedData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Writes saved data. Returns false if storage is unavailable, full, or throwing. */
export function saveTo(storage: StorageLike | null, data: SavedData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, data }));
    return true;
  } catch {
    return false;
  }
}

export function clearSaved(storage: StorageLike | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: a save that cannot be removed is harmless, and the game keeps running.
  }
}

export interface Restore {
  game: GameState;
  best: BestScores;
  settings: Settings;
}

/**
 * Works out what to start from: the saved game if there is a valid one, otherwise a fresh
 * game with a new random seed.
 */
export function restore(storage: StorageLike | null, randomSeed: number, size = 4): Restore {
  const saved = loadSaved(storage);
  if (saved) return { game: saved.game, best: saved.best, settings: saved.settings };
  return { game: newGame(randomSeed, size), best: {}, settings: DEFAULT_SETTINGS };
}

export type { BestScores, SavedData, Settings, ThemePreference } from './savedData';
/** Re-exported so callers do not need to know the module split. */
export { bestFor, recordBest, SCHEMA_VERSION };
