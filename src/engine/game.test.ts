import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from './board';
import { applyMove, continueGame, newGame } from './game';
import { createRng } from './rng';
import { spawnTile } from './spawn';
import type { Board, Direction, GameState } from './types';

function stateFrom(board: Board, overrides: Partial<GameState> = {}): GameState {
  return {
    board,
    score: 0,
    moves: 0,
    status: 'playing',
    keepPlaying: false,
    seed: 1,
    rngState: 12345,
    ...overrides,
  };
}

const sum = (board: Board) => board.flat().reduce((total, value) => total + value, 0);

const script: Direction[] = ['left', 'up', 'right', 'down'];

function play(state: GameState, count: number, offset = 0): GameState {
  let current = state;
  for (let i = 0; i < count; i++) {
    current = applyMove(current, script[(i + offset) % script.length] ?? 'left').state;
  }
  return current;
}

/** A full 2/4 checkerboard: no empty cells and no merges. */
const locked: Board = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 2],
];

/** Moving right slides the last row, which opens exactly one cell at (3,0). */
const oneMoveFromStuck: Board = [
  [8, 16, 8, 16],
  [16, 8, 16, 8],
  [8, 16, 8, 16],
  [32, 64, 128, 0],
];

/** Moving left merges 1024 + 1024 into 2048. */
const nearWin: Board = [
  [1024, 1024, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

describe('newGame', () => {
  it('starts with two tiles, each a 2 or a 4', () => {
    const tiles = newGame(1)
      .board.flat()
      .filter((value) => value !== 0);
    expect(tiles).toHaveLength(2);
    for (const value of tiles) expect([2, 4]).toContain(value);
  });

  it('starts fresh', () => {
    expect(newGame(9)).toMatchObject({
      score: 0,
      moves: 0,
      status: 'playing',
      keepPlaying: false,
      seed: 9,
    });
  });

  it('is deterministic for a given seed', () => {
    expect(newGame(2048)).toEqual(newGame(2048));
  });

  it('produces different games for different seeds', () => {
    const boards = Array.from({ length: 20 }, (_, seed) => JSON.stringify(newGame(seed).board));
    expect(new Set(boards).size).toBeGreaterThan(1);
  });

  it('supports other board sizes', () => {
    const state = newGame(1, 5);
    expect(state.board).toHaveLength(5);
    expect(state.board.every((row) => row.length === 5)).toBe(true);
  });

  it('saves the rng position reached after the starting spawns', () => {
    const rng = createRng(77);
    let board: Board = createEmptyBoard(4);
    board = spawnTile(board, rng).board;
    board = spawnTile(board, rng).board;
    expect(newGame(77).rngState).toBe(rng.getState());
  });
});

describe('applyMove', () => {
  it('rejects a move that changes nothing, returning the same state object', () => {
    const state = stateFrom([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = applyMove(state, 'left');
    expect(result.moved).toBe(false);
    expect(result.state).toBe(state);
    expect(result.spawned).toBeNull();
  });

  it('merges, scores, counts the move, and spawns exactly one tile', () => {
    const before = stateFrom([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = applyMove(before, 'left');

    expect(result.moved).toBe(true);
    expect(result.gained).toBe(4);
    expect(result.state.score).toBe(4);
    expect(result.state.moves).toBe(1);
    expect(result.state.status).toBe('playing');
    expect(result.state.rngState).not.toBe(before.rngState);
    expect(result.state.board[0]?.[0]).toBe(4);
    expect(result.state.board.flat().filter((value) => value !== 0)).toHaveLength(2);

    const { spawned } = result;
    if (!spawned) throw new Error('expected a spawned tile');
    expect([2, 4]).toContain(spawned.value);
    expect(result.state.board[spawned.row]?.[spawned.col]).toBe(spawned.value);
  });

  it('does not mutate the previous state', () => {
    const before = stateFrom(nearWin);
    const snapshot = structuredClone(before);
    applyMove(before, 'left');
    expect(before).toEqual(snapshot);
  });

  it('is deterministic: the same state and move give the same result', () => {
    const state = newGame(5);
    expect(applyMove(state, 'left')).toEqual(applyMove(state, 'left'));
  });

  it('conserves tile value: each move adds exactly the spawned tile', () => {
    let state = newGame(31);
    for (let i = 0; i < 400 && state.status === 'playing'; i++) {
      const result = applyMove(state, script[i % script.length] ?? 'left');
      if (result.moved) {
        expect(sum(result.state.board)).toBe(sum(state.board) + (result.spawned?.value ?? 0));
        expect(result.state.score).toBe(state.score + result.gained);
      }
      state = result.state;
    }
    expect(state.moves).toBeGreaterThan(0);
  });

  it('detects game over when the move leaves no merges available', () => {
    const result = applyMove(stateFrom(oneMoveFromStuck), 'right');
    expect(result.moved).toBe(true);
    expect(result.state.status).toBe('over');
  });

  it('ignores moves once the game is over', () => {
    const over = stateFrom(locked, { status: 'over' });
    for (const direction of script) {
      expect(applyMove(over, direction).state).toBe(over);
    }
  });

  it('reports a win when a 2048 tile is created', () => {
    const result = applyMove(stateFrom(nearWin), 'left');
    expect(result.state.board[0]?.[0]).toBe(2048);
    expect(result.state.status).toBe('won');
    expect(result.state.keepPlaying).toBe(false);
  });

  it('blocks further moves while the win screen is showing', () => {
    const won = applyMove(stateFrom(nearWin), 'left').state;
    expect(applyMove(won, 'right').state).toBe(won);
  });
});

describe('continueGame', () => {
  it('lets play resume after a win without triggering the win again', () => {
    const won = applyMove(stateFrom(nearWin), 'left').state;
    const resumed = continueGame(won);
    expect(resumed.status).toBe('playing');
    expect(resumed.keepPlaying).toBe(true);

    const next = applyMove(resumed, 'right');
    expect(next.moved).toBe(true);
    expect(next.state.status).toBe('playing');
  });

  it('does nothing unless the game is in the won state', () => {
    const playing = newGame(1);
    expect(continueGame(playing)).toBe(playing);
    const over = stateFrom(locked, { status: 'over' });
    expect(continueGame(over)).toBe(over);
  });

  it('ends the game if the board is stuck when the player continues', () => {
    const stuckWin = stateFrom(
      [
        [2048, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ],
      { status: 'won' },
    );
    expect(continueGame(stuckWin).status).toBe('over');
  });
});

describe('replays', () => {
  it('plays out identically for the same seed and the same moves', () => {
    expect(play(newGame(7), 200)).toEqual(play(newGame(7), 200));
  });

  it('continues identically after a JSON save and restore', () => {
    const midGame = play(newGame(5), 15);
    const restored = JSON.parse(JSON.stringify(midGame)) as GameState;
    expect(play(restored, 30, 15)).toEqual(play(midGame, 30, 15));
  });
});
