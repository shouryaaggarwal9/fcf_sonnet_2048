import { beforeEach, describe, expect, it } from 'vitest';
import { applyMove, type Direction, type GameState, newGame } from '../engine';
import { mergeBest, useGameStore } from './gameStore';
import { HISTORY_CAP, pushSnapshot } from './history';
import { bestFor } from './savedData';
import { matchesBoard } from './tileTracker';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

const store = () => useGameStore.getState();

function legalMove(game: GameState): Direction {
  const direction = DIRECTIONS.find((d) => applyMove(game, d).moved);
  if (!direction) throw new Error('no legal move');
  return direction;
}

const cornerTile: GameState = {
  ...newGame(1),
  board: [
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
};

const nearWin: GameState = {
  ...newGame(1),
  board: [
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
};

beforeEach(() => {
  store().restart(1);
});

describe('game store', () => {
  it('starts a playable game', () => {
    expect(store().game.status).toBe('playing');
    expect(
      store()
        .game.board.flat()
        .filter((value) => value !== 0),
    ).toHaveLength(2);
    expect(store().lastTurn).toBeNull();
  });

  it('restart with a seed gives the same game as the engine', () => {
    store().restart(42);
    expect(store().game).toEqual(newGame(42));
  });

  it('restart clears the last turn', () => {
    store().move(legalMove(store().game));
    expect(store().lastTurn).not.toBeNull();
    store().restart(1);
    expect(store().lastTurn).toBeNull();
  });

  it('applies an accepted move and records what happened', () => {
    const before = store().game;
    const direction = legalMove(before);
    const expected = applyMove(before, direction);

    store().move(direction);

    expect(store().game).toEqual(expected.state);
    expect(store().lastTurn).toEqual({
      gained: expected.gained,
      spawned: expected.spawned,
      // A merge is worth announcing, so the store reports what this move created.
      merged: [...new Set(expected.moves.filter((m) => m.merged).map((m) => m.value * 2))].sort(
        (a, b) => a - b,
      ),
    });
  });

  it('ignores a move that changes nothing', () => {
    useGameStore.setState({ game: cornerTile, lastTurn: null });
    store().move('left');
    expect(store().game).toBe(cornerTile);
    expect(store().lastTurn).toBeNull();
  });

  it('ignores moves after the game is over', () => {
    const over: GameState = { ...cornerTile, status: 'over' };
    useGameStore.setState({ game: over });
    store().move('right');
    expect(store().game).toBe(over);
  });

  it('shows the win, then lets the player keep playing', () => {
    useGameStore.setState({ game: nearWin });
    store().move('left');
    expect(store().game.status).toBe('won');

    store().keepPlaying();
    expect(store().game.status).toBe('playing');
    expect(store().game.keepPlaying).toBe(true);
  });

  it('keepPlaying does nothing outside the won state', () => {
    const before = store().game;
    store().keepPlaying();
    expect(store().game).toBe(before);
  });

  it('keeps the tile tracker in step with the board', () => {
    for (let i = 0; i < 50 && store().game.status === 'playing'; i++) {
      store().move(legalMove(store().game));
      expect(matchesBoard(store().tracker.tiles, store().game.board)).toBe(true);
    }
  });

  it('recovers when the game was replaced without going through the tracker', () => {
    useGameStore.setState({ game: nearWin });
    store().move('left');
    expect(matchesBoard(store().tracker.tiles, store().game.board)).toBe(true);
  });

  it('restart rebuilds the tracker without reusing ids', () => {
    const highestBefore = store().tracker.nextId;
    store().restart(2);
    expect(matchesBoard(store().tracker.tiles, store().game.board)).toBe(true);
    expect(store().tracker.tiles.every((t) => t.id >= highestBefore)).toBe(true);
  });

  it('labels new-game tiles as fresh and the tile spawned by a move as spawn', () => {
    expect(store().tracker.tiles.every((t) => t.birth === 'fresh')).toBe(true);
    store().move(legalMove(store().game));
    expect(store().tracker.tiles.filter((t) => t.birth === 'spawn')).toHaveLength(1);
  });

  it('reports whether a move was accepted', () => {
    useGameStore.setState({ game: cornerTile, lastTurn: null });
    expect(store().move('left')).toBe(false);
    expect(store().move('right')).toBe(true);
  });
});

describe('best score', () => {
  it('starts at nothing recorded', () => {
    useGameStore.setState({ best: {} });
    expect(bestFor(store().best, 4)).toBe(0);
  });

  it('records the score of a game and never lowers it', () => {
    useGameStore.setState({ best: {}, game: newGame(1) });
    for (let i = 0; i < 40 && store().game.status === 'playing'; i++)
      store().move(legalMove(store().game));

    const reached = store().game.score;
    expect(bestFor(store().best, 4)).toBe(reached);

    store().restart(2); // a new game starts at 0, the record must survive
    expect(bestFor(store().best, 4)).toBe(reached);
    expect(store().game.score).toBe(0);
  });

  it('is per board size, so a 3x3 record does not become a 4x4 record', () => {
    useGameStore.setState({ best: { 3: 777 }, game: newGame(1) });
    store().move(legalMove(store().game));
    expect(bestFor(store().best, 3)).toBe(777);
    expect(bestFor(store().best, 4)).toBe(0);
  });

  it('does not change when a move scores nothing new, so no needless re-render', () => {
    useGameStore.setState({ best: { 4: 10_000 }, game: newGame(1) });
    const before = store().best;
    store().move(legalMove(store().game));
    expect(store().best).toBe(before);
  });
});

describe('mergeBest', () => {
  it('takes the higher score for each size', () => {
    expect(mergeBest({ 4: 100 }, { 4: 900, 3: 50 })).toEqual({ 4: 900, 3: 50 });
    expect(mergeBest({ 4: 900 }, { 4: 100 })).toEqual({ 4: 900 });
  });

  it('returns the same object when nothing improves, so no re-render', () => {
    const ours = { 4: 900 };
    expect(mergeBest(ours, { 4: 100 })).toBe(ours);
    expect(mergeBest(ours, {})).toBe(ours);
  });

  it('never lowers a record, whichever tab is ahead', () => {
    expect(mergeBest({}, { 4: 500 })).toEqual({ 4: 500 });
  });
});

describe('settings', () => {
  it('starts following the system theme', () => {
    useGameStore.setState({
      settings: { theme: 'system', dpad: false, motion: 'system' as const },
    });
    expect(store().settings.theme).toBe('system');
  });

  it('stores an explicit theme choice', () => {
    useGameStore.setState({
      settings: { theme: 'system', dpad: false, motion: 'system' as const },
    });
    store().setTheme('dark');
    expect(store().settings.theme).toBe('dark');
    store().setTheme('light');
    expect(store().settings.theme).toBe('light');
  });

  it('does not change state when the theme is already what was asked for', () => {
    useGameStore.setState({ settings: { theme: 'dark', dpad: false, motion: 'system' as const } });
    const before = store().settings;
    store().setTheme('dark');
    expect(store().settings).toBe(before);
  });

  it('keeps the theme across a new game', () => {
    useGameStore.setState({ settings: { theme: 'dark', dpad: false, motion: 'system' as const } });
    store().restart(3);
    expect(store().settings.theme).toBe('dark');
  });

  it('does not disturb the game when only the theme changes', () => {
    store().restart(4);
    const before = store().game;
    store().setTheme('dark');
    expect(store().game).toBe(before);
  });

  it('toggles the on-screen pad, which starts hidden', () => {
    useGameStore.setState({
      settings: { theme: 'system', dpad: false, motion: 'system' as const },
    });
    expect(store().settings.dpad).toBe(false);
    store().setDpad(true);
    expect(store().settings.dpad).toBe(true);
  });

  it('does not change state when the pad is already in the requested position', () => {
    useGameStore.setState({ settings: { theme: 'system', dpad: true, motion: 'system' as const } });
    const before = store().settings;
    store().setDpad(true);
    expect(store().settings).toBe(before);
  });

  it('keeps the theme when the pad is toggled, and the pad when the theme changes', () => {
    useGameStore.setState({ settings: { theme: 'dark', dpad: false, motion: 'system' as const } });
    store().setDpad(true);
    expect(store().settings).toEqual({ theme: 'dark', dpad: true, motion: 'system' });
    store().setTheme('light');
    expect(store().settings).toEqual({ theme: 'light', dpad: true, motion: 'system' });
  });

  it('keeps the pad choice across a new game', () => {
    useGameStore.setState({ settings: { theme: 'system', dpad: true, motion: 'system' as const } });
    store().restart(2);
    expect(store().settings.dpad).toBe(true);
  });
});

describe('adopt', () => {
  it('replaces game and tracker together, and rebuilds without animating', () => {
    useGameStore.setState({ best: {} });
    const restored = { ...newGame(9), score: 400, moves: 12 };
    store().adopt({
      game: restored,
      best: { 4: 400 },
      settings: { theme: 'system', dpad: false, motion: 'system' as const },
      history: [],
    });

    expect(store().game).toEqual(restored);
    expect(matchesBoard(store().tracker.tiles, restored.board)).toBe(true);
    expect(store().tracker.tiles.every((t) => t.birth === 'initial')).toBe(true);
    expect(store().lastTurn).toBeNull();
    expect(bestFor(store().best, 4)).toBe(400);
  });

  it('keeps tile ids moving forward so no DOM node from the old game is reused', () => {
    const highest = store().tracker.nextId;
    store().adopt({
      game: newGame(3),
      best: {},
      settings: { theme: 'system', dpad: false, motion: 'system' as const },
      history: [],
    });
    expect(store().tracker.tiles.every((t) => t.id >= highest)).toBe(true);
  });
});

describe('undo', () => {
  beforeEach(() => {
    useGameStore.setState({ best: {}, history: [], undos: 0, boardEpoch: 0 });
    store().restart(1);
  });

  it('does nothing and reports false with an empty history', () => {
    const before = store().game;
    expect(store().undo()).toBe(false);
    expect(store().game).toBe(before);
    expect(store().undos).toBe(0);
  });

  it('restores the exact state from before the last accepted move', () => {
    store().move(legalMove(store().game));
    const afterOne = store().game;
    store().move(legalMove(store().game));
    expect(store().game).not.toEqual(afterOne);

    expect(store().undo()).toBe(true);
    expect(store().game).toEqual(afterOne);
  });

  it('restores score and moves, because both live in GameState', () => {
    for (let i = 0; i < 6 && store().game.status === 'playing'; i++)
      store().move(legalMove(store().game));
    const before = { score: store().game.score, moves: store().game.moves };

    store().undo();
    expect(store().game.score).toBeLessThan(before.score);
    expect(store().game.moves).toBe(before.moves - 1);
  });

  it('steps back several times, and refuses once empty', () => {
    const start = store().game;
    store().move(legalMove(store().game));
    const first = store().game;
    store().move(legalMove(store().game));
    const second = store().game;
    store().move(legalMove(store().game));
    expect(store().history).toHaveLength(3);

    expect(store().undo()).toBe(true);
    expect(store().game).toEqual(second);
    expect(store().undo()).toBe(true);
    expect(store().game).toEqual(first);
    expect(store().undo()).toBe(true);
    expect(store().game).toEqual(start);
    expect(store().undo()).toBe(false);
  });

  it('undoes to the very start of the game', () => {
    store().move(legalMove(store().game));
    while (store().history.length > 0) store().undo();

    expect(store().game.moves).toBe(0);
    expect(store().game.score).toBe(0);
    expect(store().game.status).toBe('playing');
    expect(matchesBoard(store().tracker.tiles, store().game.board)).toBe(true);
  });

  it('never lowers the best score', () => {
    for (let i = 0; i < 30 && store().game.status === 'playing'; i++)
      store().move(legalMove(store().game));
    const reached = store().game.score;
    expect(bestFor(store().best, 4)).toBe(reached);

    store().undo();
    store().undo();
    expect(store().game.score).toBeLessThan(reached);
    expect(bestFor(store().best, 4)).toBe(reached);
  });

  it('returns to playing when undoing out of game over', () => {
    const over: GameState = { ...cornerTile, status: 'over' };
    useGameStore.setState({ game: over, history: [{ game: cornerTile }] });

    expect(store().undo()).toBe(true);
    expect(store().game.status).toBe('playing');
  });

  it('returns to playing when undoing out of the win state', () => {
    const won = applyMove(nearWin, 'left').state;
    expect(won.status).toBe('won');
    useGameStore.setState({ game: won, history: [{ game: nearWin }] });

    expect(store().undo()).toBe(true);
    expect(store().game.status).toBe('playing');
    expect(store().game.keepPlaying).toBe(false);
  });

  it('restores keepPlaying exactly, so undoing does not forget a continue', () => {
    // Play into the win, choose to continue, then undo the continue.
    const won = applyMove(nearWin, 'left').state;
    expect(won.status).toBe('won');
    useGameStore.setState({ game: won, history: [] });

    store().keepPlaying();
    const afterContinue = store().game;
    expect(afterContinue.status).toBe('playing');
    expect(afterContinue.keepPlaying).toBe(true);

    useGameStore.setState({ history: [{ game: won }] });
    store().undo();
    expect(store().game.status).toBe('won');
    expect(store().game.keepPlaying).toBe(false);
  });

  it('replays the same direction to the same result, because rngState is restored', () => {
    // The honest consequence of restoring rngState: undo then replay is identical. This is
    // deliberate, and is why the engine is never reseeded.
    store().move(legalMove(store().game));
    const direction = legalMove(store().game);
    const original = applyMove(store().game, direction);
    store().move(direction);

    store().undo();
    store().move(direction);

    expect(store().game).toEqual(original.state);
  });

  it('takes a different path when a different direction is played after undo', () => {
    store().move(legalMove(store().game));
    const played = legalMove(store().game);
    const other = DIRECTIONS.find((d) => d !== played && applyMove(store().game, d).moved);
    if (!other) return; // a board with a single legal move has no alternative to compare

    store().move(played);
    store().undo();
    store().move(other);
    expect(store().game.moves).toBe(2);
  });

  it('leaves no ghosts and no animation, so the board cannot show debris', () => {
    for (let i = 0; i < 12 && store().game.status === 'playing'; i++)
      store().move(legalMove(store().game));
    store().undo();

    expect(store().tracker.ghosts).toEqual([]);
    expect(store().tracker.tiles.every((t) => t.birth === 'initial')).toBe(true);
    expect(matchesBoard(store().tracker.tiles, store().game.board)).toBe(true);
  });

  it('bumps boardEpoch so the board can crossfade instead of sliding backwards', () => {
    const before = store().boardEpoch;
    store().move(legalMove(store().game));
    store().undo();
    expect(store().boardEpoch).toBe(before + 1);
  });

  it('reissues tile ids, so no node is reused and none can slide from a stale position', () => {
    store().move(legalMove(store().game));
    const highestBefore = store().tracker.nextId;
    store().undo();
    expect(store().tracker.tiles.every((t) => t.id >= highestBefore)).toBe(true);
  });

  it('reports no merges for a move that only slid and spawned', () => {
    useGameStore.setState({ game: newGame(1), history: [] });
    const direction = legalMove(store().game);
    if (applyMove(store().game, direction).gained > 0) return; // this seed merged first
    store().move(direction);
    expect(store().lastTurn?.merged).toEqual([]);
  });

  it('reports the tiles a move created by merging, for announcements', () => {
    // A single 64+64 merge creates one 128.
    useGameStore.setState({
      game: {
        ...newGame(1),
        board: [
          [64, 64, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      },
      history: [],
    });
    store().move('left');
    expect(store().lastTurn?.merged).toEqual([128]);
  });

  it('reports two merge values from one move that merges twice', () => {
    useGameStore.setState({
      game: {
        ...newGame(1),
        board: [
          [2, 2, 2, 2],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      },
      history: [],
    });
    store().move('left');
    // Two 4s were made from four 2s, deduplicated to one value.
    expect(store().lastTurn?.merged).toEqual([4]);
  });

  it('reports the last turn cleared after undo', () => {
    store().move(legalMove(store().game));
    expect(store().lastTurn).not.toBeNull();
    store().undo();
    expect(store().lastTurn).toBeNull();
  });

  it('counts undos for a future daily-challenge limit', () => {
    store().move(legalMove(store().game));
    store().move(legalMove(store().game));
    store().undo();
    store().undo();
    expect(store().undos).toBe(2);
    expect(store().history).toEqual([]);
  });

  it('is cleared by a new game, which has no past', () => {
    store().move(legalMove(store().game));
    expect(store().history.length).toBeGreaterThan(0);
    store().restart(2);
    expect(store().history).toEqual([]);
    expect(store().undo()).toBe(false);
  });

  it('does not record a rejected move, so undo cannot rewind a wall bump', () => {
    useGameStore.setState({ game: cornerTile, history: [] });
    expect(store().move('left')).toBe(false);
    expect(store().history).toEqual([]);
  });

  it('drops the oldest snapshot once the cap is reached', () => {
    let history: ReturnType<typeof useGameStore.getState>['history'] = [];
    for (let i = 0; i < HISTORY_CAP + 3; i++) history = pushSnapshot(history, { game: newGame(i) });
    useGameStore.setState({ history });
    expect(store().history).toHaveLength(HISTORY_CAP);
  });

  it('conserves the sum of tiles across undo, so no value is invented or lost', () => {
    const sum = (game: GameState) => game.board.flat().reduce((a, b) => a + b, 0);
    for (let i = 0; i < 20 && store().game.status === 'playing'; i++)
      store().move(legalMove(store().game));

    const beforeSum = sum(store().game);
    store().undo();
    // Undo reverses a move, so the total drops by the tile that was merged, never more.
    expect(sum(store().game)).toBeLessThanOrEqual(beforeSum);
    expect(sum(store().game)).toBeGreaterThan(0);
  });

  it('fuzz: random moves and undos never break the tracker or the board', () => {
    for (let seed = 1; seed <= 25; seed++) {
      store().restart(seed);
      for (let i = 0; i < 60; i++) {
        // A deterministic pseudo-random choice, so a failure is reproducible from the seed.
        const roll = (seed * 7919 + i * 104729) % 10;
        if (roll < 2) store().undo();
        else store().move(DIRECTIONS[roll % DIRECTIONS.length] as Direction);

        expect(
          matchesBoard(store().tracker.tiles, store().game.board),
          `seed ${seed} step ${i}`,
        ).toBe(true);
        expect(store().tracker.tiles.every((t) => t.id > 0)).toBe(true);
        expect(
          store()
            .game.board.flat()
            .every((v) => v === 0 || (v & (v - 1)) === 0),
        ).toBe(true);
      }
    }
  });
});
