import { beforeEach, describe, expect, it } from 'vitest';
import { applyMove, type Direction, type GameState, newGame } from '../engine';
import { useGameStore } from './gameStore';
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
