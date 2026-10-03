import { describe, expect, it } from 'vitest';
import { applyMove, type Direction, newGame, type TileMove } from '../engine';
import {
  advanceTracker,
  type Birth,
  createTracker,
  drawOrder,
  matchesBoard,
  syncTracker,
  type TileView,
} from './tileTracker';

const step = (
  from: [row: number, col: number],
  to: [row: number, col: number],
  value: number,
  merged = false,
): TileMove => ({
  from: { row: from[0], col: from[1] },
  to: { row: to[0], col: to[1] },
  value,
  merged,
});

const tile = (
  id: number,
  value: number,
  row: number,
  col: number,
  birth: Birth = 'initial',
): TileView => ({ id, value, row, col, birth });

describe('createTracker', () => {
  it('gives ids in row-major order and continues counting from nextId', () => {
    const tracker = createTracker([
      [0, 2],
      [4, 0],
    ]);
    expect(tracker).toEqual({
      tiles: [tile(1, 2, 0, 1), tile(2, 4, 1, 0)],
      ghosts: [],
      nextId: 3,
    });
    expect(createTracker([[2]], 10).tiles).toEqual([tile(10, 2, 0, 0)]);
  });

  it('has no tiles for an empty board', () => {
    expect(createTracker([[0, 0]])).toEqual({
      tiles: [],
      ghosts: [],
      nextId: 1,
    });
  });

  it('labels every tile with the requested birth', () => {
    expect(createTracker([[2]], 1, 'fresh').tiles).toEqual([tile(1, 2, 0, 0, 'fresh')]);
  });
});

describe('advanceTracker', () => {
  it('keeps the id, value, and birth of tiles that only slide, and appends the spawn', () => {
    const prev = createTracker([
      [0, 0, 2],
      [0, 0, 0],
      [4, 0, 0],
    ]);
    const next = advanceTracker(prev, [step([0, 2], [0, 0], 2), step([2, 0], [2, 0], 4)], {
      row: 1,
      col: 1,
      value: 2,
    });
    expect(next).toEqual({
      tiles: [tile(1, 2, 0, 0), tile(2, 4, 2, 0), tile(3, 2, 1, 1, 'spawn')],
      ghosts: [],
      nextId: 4,
    });
  });

  it('turns merge partners into ghosts and creates one new merge tile with a new id', () => {
    const prev = createTracker([
      [2, 2, 2],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const next = advanceTracker(
      prev,
      [step([0, 0], [0, 0], 2, true), step([0, 1], [0, 0], 2, true), step([0, 2], [0, 1], 2)],
      { row: 2, col: 2, value: 4 },
    );
    expect(next.tiles).toEqual([
      tile(3, 2, 0, 1),
      tile(4, 4, 0, 0, 'merge'),
      tile(5, 4, 2, 2, 'spawn'),
    ]);
    expect(next.ghosts).toEqual([tile(1, 2, 0, 0), tile(2, 2, 0, 0)]);
    expect(next.nextId).toBe(6);
  });

  it('handles two separate merges in one row, as in [2,2,2,2]', () => {
    const prev = createTracker([[2, 2, 2, 2]]);
    const next = advanceTracker(
      prev,
      [
        step([0, 0], [0, 0], 2, true),
        step([0, 1], [0, 0], 2, true),
        step([0, 2], [0, 1], 2, true),
        step([0, 3], [0, 1], 2, true),
      ],
      null,
    );
    expect(next.tiles).toEqual([tile(5, 4, 0, 0, 'merge'), tile(6, 4, 0, 1, 'merge')]);
    expect(next.ghosts.map((ghost) => ghost.id)).toEqual([1, 2, 3, 4]);
    expect(next.nextId).toBe(7);
  });

  it('adds nothing when no tile spawned', () => {
    const prev = createTracker([[2, 0]]);
    expect(advanceTracker(prev, [step([0, 0], [0, 0], 2)], null).tiles).toEqual([tile(1, 2, 0, 0)]);
  });

  it('does not mutate the previous tracker', () => {
    const prev = createTracker([[2, 2]]);
    const snapshot = structuredClone(prev);
    advanceTracker(prev, [step([0, 0], [0, 0], 2, true), step([0, 1], [0, 0], 2, true)], null);
    expect(prev).toEqual(snapshot);
  });

  it('throws when the trace does not match the tiles', () => {
    const prev = createTracker([[2, 0]]);
    expect(() => advanceTracker(prev, [], null)).toThrow('out of sync');
    expect(() => advanceTracker(prev, [step([0, 1], [0, 0], 2)], null)).toThrow('out of sync');
    expect(() => advanceTracker(prev, [step([0, 0], [0, 0], 4)], null)).toThrow('out of sync');
  });
});

describe('drawOrder', () => {
  it('interleaves ghosts and live tiles by id and flags the ghosts', () => {
    // [4,2,2,0] moving left: the 4 stays, the two 2s merge into a new tile.
    const prev = createTracker([[4, 2, 2, 0]]);
    const next = advanceTracker(
      prev,
      [step([0, 0], [0, 0], 4), step([0, 1], [0, 1], 2, true), step([0, 2], [0, 1], 2, true)],
      null,
    );
    expect(drawOrder(next).map((t) => [t.id, t.ghost])).toEqual([
      [1, false],
      [2, true],
      [3, true],
      [4, false],
    ]);
  });

  it('lists only live tiles when there are no ghosts', () => {
    const drawn = drawOrder(createTracker([[2, 4]]));
    expect(drawn).toHaveLength(2);
    expect(drawn.every((t) => !t.ghost)).toBe(true);
  });
});

describe('matchesBoard', () => {
  const board = [
    [2, 0],
    [0, 4],
  ];

  it('is true when tiles describe exactly the board', () => {
    expect(matchesBoard(createTracker(board).tiles, board)).toBe(true);
  });

  it('is false when a value is wrong', () => {
    expect(matchesBoard([tile(1, 8, 0, 0), tile(2, 4, 1, 1)], board)).toBe(false);
  });

  it('is false when a tile is missing, extra, or duplicated', () => {
    expect(matchesBoard([tile(1, 2, 0, 0)], board)).toBe(false);
    expect(matchesBoard([...createTracker(board).tiles, tile(3, 2, 0, 1)], board)).toBe(false);
    expect(matchesBoard([tile(1, 2, 0, 0), tile(2, 2, 0, 0)], board)).toBe(false);
  });
});

describe('syncTracker', () => {
  it('returns the same object when the tracker already matches', () => {
    const tracker = createTracker([[2, 0]]);
    expect(syncTracker(tracker, [[2, 0]])).toBe(tracker);
  });

  it('rebuilds from the board when it does not, without reusing ids', () => {
    const tracker = createTracker([[2, 0]]);
    expect(syncTracker(tracker, [[0, 4]])).toEqual({
      tiles: [tile(2, 4, 0, 1)],
      ghosts: [],
      nextId: 3,
    });
  });
});

describe('tracker against the real engine', () => {
  const script: Direction[] = ['left', 'up', 'right', 'down'];

  // The one slow test in the suite: up to 6000 moves, each with eight assertions, so roughly a
  // quarter of a million expect() calls. It takes 3s on an idle machine and 7s when the suite
  // runs in parallel, which is over Vitest's 5s default and made this test fail intermittently
  // on a loaded runner. The budget is stated rather than raised globally, so every other test
  // still fails fast.
  it('stays in step with the board, stays sorted, never reuses an id, never changes a birth', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let game = newGame(seed);
      let tracker = createTracker(game.board);
      const seen = new Set(tracker.tiles.map((t) => t.id));

      for (let i = 0; i < 300 && game.status === 'playing'; i++) {
        const result = applyMove(game, script[i % script.length] ?? 'left');
        if (!result.moved) continue;

        const before = new Map(tracker.tiles.map((t) => [t.id, t]));
        const next = advanceTracker(tracker, result.moves, result.spawned);
        const context = `seed ${seed}, move ${i}`;

        expect(matchesBoard(next.tiles, result.state.board), context).toBe(true);

        const ids = next.tiles.map((t) => t.id);
        expect(ids, context).toEqual([...ids].sort((a, b) => a - b));

        const drawnIds = drawOrder(next).map((t) => t.id);
        expect(drawnIds, context).toEqual([...drawnIds].sort((a, b) => a - b));

        for (const t of next.tiles) {
          const old = before.get(t.id);
          if (old) {
            expect(t.value, context).toBe(old.value); // survivors never change value
            expect(t.birth, context).toBe(old.birth); // or birth, so entrances play once
          } else {
            expect(seen.has(t.id), `${context}: id ${t.id} reused`).toBe(false);
            seen.add(t.id);
            expect(['spawn', 'merge'], context).toContain(t.birth);
          }
        }

        for (const ghost of next.ghosts) {
          expect(before.has(ghost.id), context).toBe(true);
          expect(ghost.birth, context).toBe(before.get(ghost.id)?.birth);
          expect(result.state.board[ghost.row]?.[ghost.col], context).toBe(ghost.value * 2);
        }

        game = result.state;
        tracker = next;
      }
    }
  }, 30_000);
});
