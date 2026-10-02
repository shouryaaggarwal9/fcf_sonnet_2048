import { describe, expect, it } from 'vitest';
import { newGame } from '../engine';
import {
  bestFor,
  DEFAULT_SETTINGS,
  isTileValue,
  isValidBoard,
  MAX_PLAUSIBLE_SCORE,
  migrate,
  parseGameState,
  parseSavedData,
  recordBest,
  SCHEMA_VERSION,
} from './savedData';

const game = () => newGame(42);

describe('isTileValue', () => {
  it('accepts empty cells and powers of two from 2 up', () => {
    expect(isTileValue(0)).toBe(true);
    for (const power of [2, 4, 8, 16, 1024, 2048, 4096, 1_048_576]) {
      expect(isTileValue(power)).toBe(true);
    }
  });

  it('rejects 1, which 2048 can never produce, and any non-power of two', () => {
    for (const bad of [1, 3, 5, 6, 7, 12, 100, 1000]) {
      expect(isTileValue(bad)).toBe(false);
    }
  });

  it('rejects negatives, zero-valued falsy lookalikes, and non-integers', () => {
    for (const bad of [-2, -4, 0.5, 2.5, NaN, Infinity, '4', null, undefined]) {
      expect(isTileValue(bad)).toBe(false);
    }
  });
});

describe('isValidBoard', () => {
  it('accepts a square board in the supported size range', () => {
    expect(isValidBoard(newGame(1, 3).board)).toBe(true);
    expect(isValidBoard(newGame(1, 4).board)).toBe(true);
    expect(isValidBoard(newGame(1, 8).board)).toBe(true);
  });

  it('rejects a board that is not square', () => {
    expect(
      isValidBoard([
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ]),
    ).toBe(false);
  });

  it('rejects sizes outside 3 to 8', () => {
    expect(isValidBoard([[0, 0]])).toBe(false);
    expect(isValidBoard(Array.from({ length: 9 }, () => [0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
  });

  it('rejects a board with an illegal cell value', () => {
    const board = newGame(1).board;
    expect(isValidBoard([[3, 0, 0, 0], ...board.slice(1)])).toBe(false);
  });

  it('rejects non-arrays and null', () => {
    expect(isValidBoard(null)).toBe(false);
    expect(isValidBoard('board')).toBe(false);
    expect(isValidBoard({ rows: [] })).toBe(false);
  });
});

describe('parseGameState', () => {
  it('round-trips a real game untouched', () => {
    const original = game();
    expect(parseGameState(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });

  it('rejects a tampered board while leaving the rest valid', () => {
    const original = game();
    expect(
      parseGameState({
        ...original,
        board: [
          [1, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      }),
    ).toBeNull();
  });

  it('rejects a negative or fractional score or move count', () => {
    const original = game();
    expect(parseGameState({ ...original, score: -1 })).toBeNull();
    expect(parseGameState({ ...original, score: 10.5 })).toBeNull();
    expect(parseGameState({ ...original, moves: -3 })).toBeNull();
    expect(parseGameState({ ...original, moves: 2.5 })).toBeNull();
  });

  it('rejects an impossible score', () => {
    expect(parseGameState({ ...game(), score: MAX_PLAUSIBLE_SCORE + 1 })).toBeNull();
  });

  it('rejects an unknown status', () => {
    for (const status of ['finished', 'WON', '', 0, null]) {
      expect(parseGameState({ ...game(), status })).toBeNull();
    }
  });

  it('rejects a non-boolean keepPlaying', () => {
    for (const keepPlaying of ['true', 1, 0, null]) {
      expect(parseGameState({ ...game(), keepPlaying })).toBeNull();
    }
  });

  it('rejects a non-integer or non-finite seed or rngState', () => {
    const original = game();
    for (const bad of [NaN, Infinity, -Infinity, 1.5, '42', null]) {
      expect(parseGameState({ ...original, seed: bad })).toBeNull();
      expect(parseGameState({ ...original, rngState: bad })).toBeNull();
    }
  });

  it('accepts a negative rngState, because mulberry32 uses a signed 32-bit int', () => {
    expect(parseGameState({ ...game(), rngState: -12345 })).not.toBeNull();
  });

  it('rejects a missing field rather than defaulting it', () => {
    const { rngState: _omitted, ...withoutRng } = game();
    expect(parseGameState(withoutRng)).toBeNull();
  });

  it('rejects non-objects', () => {
    for (const bad of [null, undefined, 42, 'game', [], true]) {
      expect(parseGameState(bad)).toBeNull();
    }
  });
});

describe('parseSavedData', () => {
  it('keeps a valid game, best, and settings', () => {
    const original = game();
    const parsed = parseSavedData({
      game: original,
      best: { 4: 900 },
      settings: { theme: 'dark', dpad: false },
      history: [],
      undos: 0,
    });
    expect(parsed).toEqual({
      game: original,
      best: { 4: 900 },
      settings: { theme: 'dark', dpad: false },
      history: [],
      undos: 0,
    });
  });

  it('falls back to defaults when best or settings are missing or unusable', () => {
    const original = game();
    expect(parseSavedData({ game: original })).toEqual({
      game: original,
      best: {},
      settings: DEFAULT_SETTINGS,
      history: [],
      undos: 0,
    });
    expect(parseSavedData({ game: original, best: 'nope', settings: 7 })).toEqual({
      game: original,
      best: {},
      settings: DEFAULT_SETTINGS,
      history: [],
      undos: 0,
    });
  });

  it('drops best entries for unsupported sizes or impossible scores', () => {
    const parsed = parseSavedData({
      game: game(),
      best: { 2: 500, 4: 900, 12: 100, 5: -1, 6: 'x', 7: MAX_PLAUSIBLE_SCORE + 1 },
      settings: { theme: 'light', dpad: false },
      history: [],
      undos: 0,
    });
    expect(parsed?.best).toEqual({ 4: 900 });
  });

  it('falls back to the system theme for an unknown theme value', () => {
    for (const theme of ['neon', 'LIGHT', '', null, 3]) {
      expect(parseSavedData({ game: game(), settings: { theme } })?.settings).toEqual(
        DEFAULT_SETTINGS,
      );
    }
  });

  it('rejects the whole payload when the game is invalid', () => {
    expect(parseSavedData({ game: { ...game(), board: 'nope' } })).toBeNull();
  });
});

describe('migrate', () => {
  const data = {
    game: game(),
    best: { 4: 100 },
    settings: { theme: 'system', dpad: false },
    history: [],
    undos: 0,
  };

  it('reads the current version', () => {
    expect(migrate({ version: SCHEMA_VERSION, data })).toEqual(data);
  });

  it('returns null for a future version, so a downgrade starts fresh instead of misreading it', () => {
    expect(migrate({ version: SCHEMA_VERSION + 1, data })).toBeNull();
  });

  it('returns null for a version that is not a whole number', () => {
    expect(migrate({ version: '1', data })).toBeNull();
    expect(migrate({ version: 1.5, data })).toBeNull();
    expect(migrate({ data })).toBeNull();
  });

  it('returns null when the payload inside a valid envelope is corrupt', () => {
    expect(migrate({ version: SCHEMA_VERSION, data: { game: null } })).toBeNull();
    expect(migrate({ version: SCHEMA_VERSION })).toBeNull();
  });

  it('returns null for junk', () => {
    for (const bad of [null, undefined, 'x', 7, []]) {
      expect(migrate(bad)).toBeNull();
    }
  });
});

describe('best scores', () => {
  it('reads 0 for a size that has no record', () => {
    expect(bestFor({}, 4)).toBe(0);
  });

  it('is per board size, so a 3x3 record never inflates a 4x4 one', () => {
    const best = recordBest(recordBest({}, 3, 500), 4, 200);
    expect(bestFor(best, 3)).toBe(500);
    expect(bestFor(best, 4)).toBe(200);
  });

  it('keeps a valid game, best, and settings', () => {
    const original = game();
    const parsed = parseSavedData({
      game: original,
      best: { 4: 900 },
      settings: { theme: 'dark', dpad: false },
    });
    expect(parsed).toEqual({
      game: original,
      best: { 4: 900 },
      settings: { theme: 'dark', dpad: false },
      history: [],
      undos: 0,
    });
  });

  it('keeps undo history and the undo counter', () => {
    const first = game();
    const second = newGame(5);
    const parsed = parseSavedData({
      game: second,
      best: {},
      settings: { theme: 'system', dpad: false },
      history: [first, second],
      undos: 3,
    });
    expect(parsed?.history).toEqual([first, second]);
    expect(parsed?.undos).toBe(3);
  });

  it('drops only the bad history entries, keeping the rest', () => {
    const good = game();
    const parsed = parseSavedData({
      game: game(),
      best: {},
      settings: { theme: 'system', dpad: false },
      history: [good, { board: 'tampered' }, null],
      undos: 0,
    });
    expect(parsed?.history).toEqual([good]);
  });

  it('defaults history and undos when absent, as a v1 payload has neither', () => {
    const parsed = parseSavedData({
      game: game(),
      best: {},
      settings: { theme: 'system', dpad: false },
    });
    expect(parsed?.history).toEqual([]);
    expect(parsed?.undos).toBe(0);
  });

  it('rejects a negative or fractional undo count', () => {
    const parsed = parseSavedData({
      game: game(),
      best: {},
      settings: { theme: 'system', dpad: false },
      history: [],
      undos: -1,
    });
    expect(parsed?.undos).toBe(0);
  });

  it('upgrades a v1 payload, keeping the game and best but starting with no history', () => {
    const original = game();
    const upgraded = migrate({
      version: 1,
      data: { game: original, best: { 4: 700 }, settings: { theme: 'dark', dpad: false } },
    });
    expect(upgraded).toEqual({
      game: original,
      best: { 4: 700 },
      settings: { theme: 'dark', dpad: false },
      history: [],
      undos: 0,
    });
  });

  it('upgrades a v2 payload, keeping everything but starting with the pad hidden', () => {
    const original = game();
    const upgraded = migrate({
      version: 2,
      data: {
        game: original,
        best: { 4: 700 },
        settings: { theme: 'dark' },
        history: [original],
        undos: 2,
      },
    });
    expect(upgraded).toEqual({
      game: original,
      best: { 4: 700 },
      settings: { theme: 'dark', dpad: false },
      history: [original],
      undos: 2,
    });
  });

  it('upgrades a v1 payload all the way, with no history and no pad', () => {
    const original = game();
    const upgraded = migrate({
      version: 1,
      data: { game: original, best: {}, settings: { theme: 'light' } },
    });
    expect(upgraded?.history).toEqual([]);
    expect(upgraded?.undos).toBe(0);
    expect(upgraded?.settings).toEqual({ theme: 'light', dpad: false });
  });

  it('only turns the pad on for a literal true, so a tampered value cannot enable it', () => {
    for (const dpad of ['true', 1, 'yes', null, {}]) {
      const parsed = parseSavedData({
        game: game(),
        best: {},
        settings: { theme: 'system', dpad },
      });
      expect(parsed?.settings.dpad, String(dpad)).toBe(false);
    }
    expect(
      parseSavedData({ game: game(), best: {}, settings: { theme: 'system', dpad: true } })
        ?.settings.dpad,
    ).toBe(true);
  });

  it('keeps a valid theme even when the pad field is missing, and vice versa', () => {
    const noPad = parseSavedData({ game: game(), best: {}, settings: { theme: 'dark' } });
    expect(noPad?.settings).toEqual({ theme: 'dark', dpad: false });

    const noTheme = parseSavedData({ game: game(), best: {}, settings: { dpad: true } });
    expect(noTheme?.settings).toEqual({ theme: 'system', dpad: true });
  });

  it('never decreases', () => {
    const first = recordBest({}, 4, 900);
    expect(recordBest(first, 4, 100)).toBe(first);
    expect(bestFor(first, 4)).toBe(900);
  });

  it('raises the record when the score is higher', () => {
    expect(bestFor(recordBest({}, 4, 100), 4)).toBe(100);
    expect(bestFor(recordBest({ 4: 100 }, 4, 900), 4)).toBe(900);
  });

  it('does not mutate the previous record', () => {
    const before = { 4: 100 };
    recordBest(before, 4, 900);
    expect(before).toEqual({ 4: 100 });
  });
});
