import { beforeEach, describe, expect, it } from 'vitest';
import { applyMove, type GameState, newGame } from '../engine';
import {
  clearSaved,
  emptySave,
  loadSaved,
  type Restore,
  restore,
  STORAGE_KEY,
  type StorageLike,
  saveTo,
} from './persistence';
import { SCHEMA_VERSION } from './savedData';

/** In-memory Storage. `failOnWrite` and `failOnRead` stand in for quota and private mode. */
class FakeStorage implements StorageLike {
  readonly map = new Map<string, string>();
  failOnWrite = false;
  failOnRead = false;

  getItem(key: string): string | null {
    if (this.failOnRead) throw new Error('SecurityError');
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnWrite) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

let storage: FakeStorage;

beforeEach(() => {
  storage = new FakeStorage();
});

const play = (game: GameState, directions: readonly ('up' | 'down' | 'left' | 'right')[]) => {
  let state = game;
  for (const direction of directions) {
    const result = applyMove(state, direction);
    if (result.moved) state = result.state;
  }
  return state;
};

describe('saveTo and loadSaved', () => {
  it('round-trips a game, best score, and settings', () => {
    const data = {
      game: newGame(42),
      best: { 4: 1234 },
      settings: { theme: 'dark' as const, dpad: false },
      history: [],
      undos: 0,
    };
    expect(saveTo(storage, data)).toBe(true);
    expect(loadSaved(storage)).toEqual(data);
  });

  it('stores a versioned envelope, not a bare payload', () => {
    saveTo(storage, {
      game: newGame(1),
      best: {},
      settings: { theme: 'system', dpad: false },
      history: [],
      undos: 0,
    });
    const raw = JSON.parse(storage.map.get(STORAGE_KEY) ?? '');
    expect(raw.version).toBe(SCHEMA_VERSION);
    expect(raw.data.game.board).toBeDefined();
  });

  it('returns null when nothing was ever saved', () => {
    expect(loadSaved(storage)).toBeNull();
  });

  it('returns null for invalid JSON instead of throwing', () => {
    storage.map.set(STORAGE_KEY, '{not json');
    expect(() => loadSaved(storage)).not.toThrow();
    expect(loadSaved(storage)).toBeNull();
  });

  it('returns null for JSON that is not an object', () => {
    for (const raw of ['null', '42', '"text"', '[]', 'true']) {
      storage.map.set(STORAGE_KEY, raw);
      expect(loadSaved(storage)).toBeNull();
    }
  });

  it('returns null for a wrong or future version', () => {
    const data = {
      game: newGame(1),
      best: {},
      settings: { theme: 'system' as const, dpad: false },
      history: [],
      undos: 0,
    };
    storage.map.set(STORAGE_KEY, JSON.stringify({ version: 99, data }));
    expect(loadSaved(storage)).toBeNull();

    storage.map.set(STORAGE_KEY, JSON.stringify({ version: '1', data }));
    expect(loadSaved(storage)).toBeNull();
  });

  it('returns null for a tampered board, rather than restoring a broken game', () => {
    const data = {
      game: newGame(1),
      best: {},
      settings: { theme: 'system' as const, dpad: false },
      history: [],
      undos: 0,
    };
    saveTo(storage, data);
    const raw = JSON.parse(storage.map.get(STORAGE_KEY) ?? '');
    raw.data.game.board = [
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    storage.map.set(STORAGE_KEY, JSON.stringify(raw));
    expect(loadSaved(storage)).toBeNull();
  });

  it('returns null when storage itself throws on read', () => {
    storage.failOnRead = true;
    expect(loadSaved(storage)).toBeNull();
  });

  it('reports a failed write instead of throwing', () => {
    storage.failOnWrite = true;
    expect(saveTo(storage, emptySave())).toBe(false);
  });

  it('is a no-op when there is no storage at all', () => {
    expect(loadSaved(null)).toBeNull();
    expect(saveTo(null, emptySave())).toBe(false);
    expect(() => clearSaved(null)).not.toThrow();
  });

  it('clears the save', () => {
    saveTo(storage, emptySave());
    clearSaved(storage);
    expect(loadSaved(storage)).toBeNull();
  });

  it('survives a removeItem that throws', () => {
    storage.removeItem = () => {
      throw new Error('nope');
    };
    expect(() => clearSaved(storage)).not.toThrow();
  });
});

describe('restore', () => {
  it('returns the saved game so a reload continues the same game', () => {
    const saved = play(newGame(7), ['left', 'left', 'up', 'left']);
    saveTo(storage, {
      game: saved,
      best: { 4: 500 },
      settings: { theme: 'light', dpad: false },
      history: [],
      undos: 0,
    });

    const result = restore(storage, 999);
    expect(result.game).toEqual(saved);
    expect(result.best).toEqual({ 4: 500 });
    expect(result.settings).toEqual({ theme: 'light', dpad: false });
  });

  it('continues identically to the original after a save and restore', () => {
    // Determinism through rngState: the same next move must give the same board and spawn.
    const original = play(newGame(11), ['left', 'up', 'right', 'up', 'left']);
    saveTo(storage, {
      game: original,
      best: {},
      settings: { theme: 'system', dpad: false },
      history: [],
      undos: 0,
    });

    const restored = restore(storage, 12345).game;
    expect(applyMove(restored, 'down').state).toEqual(applyMove(original, 'down').state);
  });

  it('falls back to a fresh game when storage is unusable, ignoring the supplied seed path', () => {
    storage.failOnRead = true;
    const result = restore(storage, 5);
    expect(result.game.board.flat().filter((v) => v !== 0)).toHaveLength(2);
    expect(result.game.moves).toBe(0);
  });

  it('falls back to a fresh game when the save is corrupt', () => {
    storage.map.set(STORAGE_KEY, 'garbage');
    expect(restore(storage, 5).game.moves).toBe(0);
  });

  it('starts a game of the requested size when there is nothing saved', () => {
    const result = restore(storage, 5, 3);
    expect(result.game.board).toHaveLength(3);
    expect(result.game.board[0]).toHaveLength(3);
  });

  it('keeps the saved size rather than the requested one', () => {
    const three = play(newGame(3, 3), ['left']);
    saveTo(storage, {
      game: three,
      best: { 3: 10 },
      settings: { theme: 'system', dpad: false },
      history: [],
      undos: 0,
    });
    const result: Restore = restore(storage, 5, 4);
    expect(result.game.board).toHaveLength(3);
  });
});
