import type { Board, GameState, GameStatus, Row } from '../engine';

/**
 * Validation of persisted data. Pure functions over `unknown`, so a tampered, truncated, or
 * hand-edited storage payload can never make the game crash on load.
 *
 * Nothing here touches storage or the DOM: `persistence.ts` does that.
 */

export const SCHEMA_VERSION = 3;

/** Board sizes the engine is intended for. Wider or narrower is treated as corrupt. */
export const MIN_BOARD_SIZE = 3;
export const MAX_BOARD_SIZE = 8;

/** Above this a score is nonsense, not a real game. Guards against a tampered value. */
export const MAX_PLAUSIBLE_SCORE = 1_000_000_000;

const STATUSES: readonly GameStatus[] = ['playing', 'won', 'over'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non-negative whole number, safe as a count. Rejects NaN, Infinity, and negatives. */
function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/**
 * A 32-bit integer, which is what mulberry32 stores. Also accepts any safe integer, because
 * the engine coerces with `| 0` on the way in; a float seed is still usable and must not
 * be treated as corruption.
 */
function isSeedLike(value: unknown): value is number {
  return Number.isFinite(value) && Number.isInteger(value);
}

/** Tile values are 0 (empty) or a power of two of 2 or more. Rejects 1, 3, -4, and 2.5. */
export function isTileValue(value: unknown): value is number {
  if (!Number.isInteger(value)) return false;
  const n = value as number;
  if (n === 0) return true; // an empty cell
  if (n < 2) return false;
  // A power of two has exactly one bit set.
  return (n & (n - 1)) === 0;
}

function isValidRow(value: unknown): value is Row {
  return Array.isArray(value) && value.every(isTileValue);
}

/** A square board in range, with every cell holding a legal tile value. */
export function isValidBoard(value: unknown): value is Board {
  if (!Array.isArray(value)) return false;
  const size = value.length;
  if (size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE) return false;
  return value.every((row) => isValidRow(row) && row.length === size);
}

/** Validates a whole game. Returns the state unchanged, or null if anything is wrong. */
export function parseGameState(value: unknown): GameState | null {
  if (!isPlainObject(value)) return null;
  if (!isValidBoard(value.board)) return null;
  if (!isCount(value.score) || (value.score as number) > MAX_PLAUSIBLE_SCORE) return null;
  if (!isCount(value.moves)) return null;
  if (!STATUSES.includes(value.status as GameStatus)) return null;
  if (typeof value.keepPlaying !== 'boolean') return null;
  if (!isSeedLike(value.seed)) return null;
  if (!isSeedLike(value.rngState)) return null;

  return {
    board: value.board,
    score: value.score,
    moves: value.moves,
    status: value.status as GameStatus,
    keepPlaying: value.keepPlaying,
    seed: value.seed,
    rngState: value.rngState,
  };
}

export type ThemePreference = 'system' | 'light' | 'dark';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export interface Settings {
  theme: ThemePreference;
  /**
   * Show the on-screen direction pad. Off by default: swipe and the keyboard already cover
   * input. This exists for WCAG 2.5.1, which asks for a single-pointer alternative to a
   * path-based gesture like a swipe.
   */
  dpad: boolean;
}

/** Best score per board size, so a 3x3 record never inflates a 4x4 one. */
export type BestScores = Readonly<Record<number, number>>;

export interface SavedData {
  game: GameState;
  best: BestScores;
  settings: Settings;
  /**
   * Games from before each accepted move, oldest first, so undo survives a reload.
   * Added in v2. A v1 save simply has none.
   */
  history: readonly GameState[];
  /** How many undos have ever been used. Recorded for a future daily-challenge limit. */
  undos: number;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', dpad: false };

function parseBest(value: unknown): BestScores {
  if (!isPlainObject(value)) return {};
  const best: Record<number, number> = {};
  for (const [key, score] of Object.entries(value)) {
    const size = Number(key);
    // Keys are board sizes; ignore anything that is not a size we support.
    if (!Number.isInteger(size) || size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE) continue;
    if (!isCount(score) || score > MAX_PLAUSIBLE_SCORE) continue;
    best[size] = score;
  }
  return best;
}

function parseSettings(value: unknown): Settings {
  if (!isPlainObject(value)) return DEFAULT_SETTINGS;
  // Each field falls back on its own, so a partially valid object still keeps what it can.
  const theme = THEMES.includes(value.theme as ThemePreference)
    ? (value.theme as ThemePreference)
    : DEFAULT_SETTINGS.theme;
  // Anything that is not literally true is off. A tampered "yes" must not turn it on.
  return { theme, dpad: value.dpad === true };
}

/**
 * Validates the payload inside a version envelope. Null means "start fresh".
 *
 * `history` and `undos` are v2 additions. A v1 payload is upgraded by `migrate`, which
 * fills them in here, so this stays a single description of the current shape.
 */
export function parseSavedData(value: unknown): SavedData | null {
  if (!isPlainObject(value)) return null;
  const game = parseGameState(value.game);
  if (!game) return null;
  return {
    game,
    best: parseBest(value.best),
    settings: parseSettings(value.settings),
    history: parseHistory(value.history),
    undos: isCount(value.undos) ? value.undos : 0,
  };
}

/** Keeps only entries that are individually valid, so one bad snapshot is not fatal. */
function parseHistory(value: unknown): readonly GameState[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => parseGameState(entry))
    .filter((entry): entry is GameState => entry !== null);
}

export interface Envelope {
  version: number;
  data: SavedData;
}

/**
 * Reads any supported envelope version. Returns null for an unknown or future version, so a
 * downgrade to an older build starts a fresh game instead of misreading newer fields.
 *
 * Each later shape adds a branch here rather than editing the validator above, so old saves
 * keep working. v1 had no undo history; the v1 branch simply has none to restore.
 */
export function migrate(raw: unknown): SavedData | null {
  if (!isPlainObject(raw)) return null;
  if (!Number.isInteger(raw.version)) return null;

  if (raw.version === SCHEMA_VERSION) return parseSavedData(raw.data);

  // v1 had no undo history, so there is nothing to restore from it.
  if (raw.version === 1) {
    const parsed = parseSavedData(raw.data);
    if (!parsed) return null;
    return { ...parsed, history: [], undos: 0 };
  }

  // v2 had no on-screen d-pad setting, so it starts hidden.
  if (raw.version === 2) {
    const parsed = parseSavedData(raw.data);
    if (!parsed) return null;
    return { ...parsed, settings: { ...parsed.settings, dpad: false } };
  }

  // A newer version is unreadable by design.
  return null;
}

/**
 * Best score for a board size. Never decreases: `recordBest` takes the higher of the two,
 * so undo, restore, and a second tab all converge on the same maximum.
 */
export function bestFor(best: BestScores, size: number): number {
  return best[size] ?? 0;
}

/** Returns the same object when the score is not an improvement, so React can skip a render. */
export function recordBest(best: BestScores, size: number, score: number): BestScores {
  if (score <= bestFor(best, size)) return best;
  return { ...best, [size]: score };
}
