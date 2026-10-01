import { describe, expect, it } from 'vitest';
import {
  applyMove,
  continueGame,
  type Direction,
  type GameState,
  newGame,
  WIN_TILE,
} from './index';
import { move } from './move';
import { createRng, type Rng } from './rng';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const PRIORITY: readonly Direction[] = ['left', 'down', 'right', 'up'];
const MAX_STEPS = 3000;

type Bot = (state: GameState, rng: Rng) => Direction;

/** Picks any direction, including illegal ones, so rejected moves get exercised too. */
const randomBot: Bot = (_state, rng) => DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)] ?? 'left';

/** Always plays the first legal move in a fixed order. Survives longer and builds big tiles. */
const cornerBot: Bot = (state) => PRIORITY.find((d) => move(state.board, d).moved) ?? 'left';

/** Freezes recursively, so any accidental mutation inside the engine throws immediately. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const sum = (board: readonly (readonly number[])[]) =>
  board.flat().reduce((total, value) => total + value, 0);

/** 0, or a power of two that is at least 2. */
const isValidTile = (value: number) => value === 0 || (value >= 2 && (value & (value - 1)) === 0);

function assertValid(state: GameState, size: number) {
  const badBoard = !(
    state.board.length === size &&
    state.board.every((row) => row.length === size && row.every(isValidTile))
  );
  expect(badBoard, `invalid board: ${JSON.stringify(state.board)}`).toBe(false);

  // The status must agree with what move() says is actually possible.
  const canMove = DIRECTIONS.some((direction) => move(state.board, direction).moved);
  if (state.status === 'playing') expect(canMove).toBe(true);
  if (state.status === 'over') expect(canMove).toBe(false);
  if (state.status === 'won') {
    expect(Math.max(...state.board.flat())).toBeGreaterThanOrEqual(WIN_TILE);
    expect(state.keepPlaying).toBe(false);
  }
  if (state.keepPlaying) expect(state.status).not.toBe('won');
}

interface Outcome {
  final: GameState;
  steps: number;
}

function runGame(seed: number, size: number, bot: Bot): Outcome {
  const botRng = createRng(seed + 1_000_003);
  let state = deepFreeze(newGame(seed, size));
  assertValid(state, size);

  let steps = 0;
  let accepted = 0;

  while (state.status !== 'over' && steps < MAX_STEPS) {
    steps += 1;

    if (state.status === 'won') {
      state = deepFreeze(continueGame(state));
      assertValid(state, size);
      continue;
    }

    const before = state;
    const result = applyMove(before, bot(before, botRng));

    if (!result.moved) {
      expect(result.state).toBe(before);
      expect(result.gained).toBe(0);
      expect(result.spawned).toBeNull();
      continue;
    }

    // An accepted move always leaves room: sliding on a full board only changes it by merging.
    expect(result.spawned).not.toBeNull();
    const spawnedValue = result.spawned?.value ?? 0;

    state = deepFreeze(result.state);
    accepted += 1;

    expect(state.moves).toBe(before.moves + 1);
    expect(state.score).toBe(before.score + result.gained);
    expect(state.score % 2).toBe(0); // merges only ever add even numbers
    expect(sum(state.board)).toBe(sum(before.board) + spawnedValue); // merges conserve value
    expect(state.seed).toBe(before.seed);
    assertValid(state, size);
  }

  expect(state.moves).toBe(accepted);
  return { final: state, steps };
}

/** Same as runGame, but failures say which game broke. */
function runGameChecked(seed: number, size: number, bot: Bot): Outcome {
  try {
    return runGame(seed, size, bot);
  } catch (error) {
    throw new Error(`Invariant failed (size ${size}, seed ${seed})`, {
      cause: error,
    });
  }
}

const configs = [
  [3, 150],
  [4, 150],
  [5, 15],
  [6, 8],
] as const;

const bots = [
  ['random', randomBot],
  ['corner', cornerBot],
] as const;

describe.each(configs)('fuzz: size %i, %i games', (size, games) => {
  it.each(bots)(
    '%s bot never breaks an invariant',
    (_name, bot) => {
      for (let seed = 1; seed <= games; seed++) {
        runGameChecked(seed, size, bot);
      }
    },
    60_000,
  );
});

describe('fuzz: end states', () => {
  it('random play on small boards always ends in game over', () => {
    for (const size of [3, 4]) {
      for (let seed = 1; seed <= 50; seed++) {
        expect(runGameChecked(seed, size, randomBot).final.status).toBe('over');
      }
    }
  });

  it('behaves identically when the state is saved and restored after every move', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const botRng = createRng(seed);
      let live = newGame(seed);
      let restored = newGame(seed);

      for (let i = 0; i < 500 && live.status === 'playing'; i++) {
        const direction = randomBot(live, botRng);
        live = applyMove(live, direction).state;
        restored = applyMove(restored, direction).state;
        restored = JSON.parse(JSON.stringify(restored)) as GameState;
        expect(restored).toEqual(live);
      }
    }
  });
});
