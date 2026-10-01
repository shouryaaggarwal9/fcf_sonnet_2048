import type { Direction } from '../engine';

/** How many moves may wait while tiles are sliding. Extra inputs are dropped. */
export const MAX_QUEUE = 2;

export interface MoveControllerOptions {
  /** Plays a move. Returns false if it changed nothing (a wall bump, or the game is over). */
  attempt: (direction: Direction) => boolean;
  /** How long an accepted move locks input, in ms. Read on every move, so it can change. */
  lockMs: () => number;
  maxQueue?: number;
  /** Injected for tests. */
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface MoveController {
  /** Call for every player input, from any source. Safe to pass around unbound. */
  input: (direction: Direction) => void;
  /** Forgets queued moves and unlocks. Call when the game is replaced. */
  reset: () => void;
}

/**
 * Serializes moves so each slide finishes before the next begins, buffering a few inputs
 * in between. Locked means a timer is pending. When it fires, queued moves run in order,
 * skipping any that no longer change the board.
 */
export function createMoveController(options: MoveControllerOptions): MoveController {
  const {
    attempt,
    lockMs,
    maxQueue = MAX_QUEUE,
    setTimer = (callback, ms) => setTimeout(callback, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options;

  let queue: Direction[] = [];
  let timer: unknown = null;

  function play(direction: Direction): void {
    if (!attempt(direction)) return;
    const ms = lockMs();
    if (ms > 0) timer = setTimer(unlock, ms);
  }

  function unlock(): void {
    timer = null;
    while (queue.length > 0 && timer === null) {
      const next = queue.shift();
      if (next) play(next); // an accepted move re-locks, which ends the loop
    }
  }

  return {
    input: (direction) => {
      if (timer !== null) {
        if (queue.length < maxQueue) queue.push(direction);
        return;
      }
      play(direction);
    },

    reset: () => {
      if (timer !== null) clearTimer(timer);
      timer = null;
      queue = [];
    },
  };
}
