import type { GameState } from '../engine';

/**
 * The state as it was immediately before one accepted move.
 *
 * Only the game is stored, not the tile tracker, even though ids live outside `GameState`.
 * A snapshot's tracker is always in step with its board, and restoring rewrites every birth
 * to 'initial' so nothing animates. That is byte-for-byte what rebuilding a tracker from the
 * board produces, so keeping the tracker would double the stored payload for no difference.
 * Ids are reissued from the live `nextId` on restore, so no DOM node is ever reused and no
 * tile can slide from a stale position.
 */
export interface Snapshot {
  game: GameState;
}

/** Undo depth while playing. Older snapshots are dropped once this is reached. */
export const HISTORY_CAP = 50;

/**
 * How much history is written to storage. Lower than HISTORY_CAP to bound what we save;
 * a reload starts you with the last PERSISTED_HISTORY_CAP moves still undoable.
 */
export const PERSISTED_HISTORY_CAP = 20;

/** Appends a snapshot, dropping the oldest once the cap is reached. */
export function pushSnapshot(
  history: readonly Snapshot[],
  snapshot: Snapshot,
  cap: number = HISTORY_CAP,
): readonly Snapshot[] {
  const next = [...history, snapshot];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** The snapshot an undo would restore, or null when there is nothing to undo. */
export function undoable(history: readonly Snapshot[]): Snapshot | null {
  return history[history.length - 1] ?? null;
}

/** Drops the newest snapshot. Returns the same array when there was nothing to drop. */
export function popSnapshot(history: readonly Snapshot[]): readonly Snapshot[] {
  return history.length === 0 ? history : history.slice(0, -1);
}

/** Trims a history to what is worth persisting. */
export function forPersisting(history: readonly Snapshot[]): readonly GameState[] {
  return history.slice(-PERSISTED_HISTORY_CAP).map((snapshot) => snapshot.game);
}

/** Rebuilds snapshots from persisted games. Invalid entries are dropped, not fatal. */
export function fromPersisted(
  games: readonly GameState[],
  isValid: (value: unknown) => value is GameState,
): readonly Snapshot[] {
  return games.filter((game) => isValid(game)).map((game) => ({ game }));
}
