import { describe, expect, it } from 'vitest';
import { type GameState, newGame } from '../engine';
import {
  forPersisting,
  fromPersisted,
  HISTORY_CAP,
  PERSISTED_HISTORY_CAP,
  popSnapshot,
  pushSnapshot,
  type Snapshot,
  undoable,
} from './history';

const snap = (seed: number): Snapshot => ({ game: newGame(seed) });

/** Stands in for the real validator: anything with a board is accepted. */
function isGameState(value: unknown): value is GameState {
  return typeof value === 'object' && value !== null && 'board' in value;
}

describe('pushSnapshot', () => {
  it('appends in order', () => {
    const history = pushSnapshot(pushSnapshot([], snap(1)), snap(2));
    expect(history.map((s) => s.game.seed)).toEqual([1, 2]);
  });

  it('drops the oldest once the cap is reached', () => {
    let history: readonly Snapshot[] = [];
    for (let seed = 1; seed <= HISTORY_CAP + 5; seed++) history = pushSnapshot(history, snap(seed));

    expect(history).toHaveLength(HISTORY_CAP);
    // The newest HISTORY_CAP seeds survive; the first five are gone.
    expect(history[0]?.game.seed).toBe(6);
    expect(history[HISTORY_CAP - 1]?.game.seed).toBe(HISTORY_CAP + 5);
  });

  it('respects an injected cap, so the rule is testable without 50 moves', () => {
    let history: readonly Snapshot[] = [];
    for (let seed = 1; seed <= 5; seed++) history = pushSnapshot(history, snap(seed), 2);
    expect(history.map((s) => s.game.seed)).toEqual([4, 5]);
  });

  it('does not mutate the previous history', () => {
    const before: readonly Snapshot[] = [snap(1)];
    pushSnapshot(before, snap(2));
    expect(before).toHaveLength(1);
  });
});

describe('undoable', () => {
  it('is null when there is nothing to undo', () => {
    expect(undoable([])).toBeNull();
  });

  it('is the most recent snapshot', () => {
    const history = pushSnapshot(pushSnapshot([], snap(1)), snap(2));
    expect(undoable(history)?.game.seed).toBe(2);
  });
});

describe('popSnapshot', () => {
  it('removes the most recent snapshot', () => {
    const history = pushSnapshot(pushSnapshot([], snap(1)), snap(2));
    expect(popSnapshot(history).map((s) => s.game.seed)).toEqual([1]);
  });

  it('is a no-op on an empty history, returning the same array', () => {
    const empty: readonly Snapshot[] = [];
    expect(popSnapshot(empty)).toBe(empty);
  });
});

describe('persistence round trip', () => {
  it('keeps only the most recent snapshots, to bound what is stored', () => {
    let history: readonly Snapshot[] = [];
    for (let seed = 1; seed <= HISTORY_CAP + 10; seed++)
      history = pushSnapshot(history, snap(seed));

    const persisted = forPersisting(history);
    expect(persisted).toHaveLength(PERSISTED_HISTORY_CAP);
    expect(persisted[0]?.seed).toBe(HISTORY_CAP + 10 - PERSISTED_HISTORY_CAP + 1);
  });

  it('rebuilds the same history, in the same order', () => {
    const history = pushSnapshot(pushSnapshot([], snap(7)), snap(8));
    const restored = fromPersisted(forPersisting(history), isGameState);
    expect(restored.map((s) => s.game.seed)).toEqual([7, 8]);
  });

  it('drops invalid entries instead of failing the whole load', () => {
    // The entry is deliberately not a GameState: this is what a tampered save looks like.
    const tampered: unknown = { tampered: true };
    const restored = fromPersisted([newGame(1), tampered as GameState, newGame(2)], isGameState);
    expect(restored.map((s) => s.game.seed)).toEqual([1, 2]);
  });

  it('handles an empty history', () => {
    expect(forPersisting([])).toEqual([]);
    expect(fromPersisted([], isGameState)).toEqual([]);
  });
});
