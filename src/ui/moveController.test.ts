import { describe, expect, it } from 'vitest';
import type { Direction } from '../engine';
import { createMoveController } from './moveController';

function setup(options: { rejects?: Direction[]; lockMs?: number } = {}) {
  const attempts: Direction[] = [];
  const blocked = new Set(options.rejects ?? []);
  const timers = new Map<number, { callback: () => void; ms: number }>();
  let nextHandle = 1;

  const controller = createMoveController({
    attempt: (direction) => {
      attempts.push(direction);
      return !blocked.has(direction);
    },
    lockMs: () => options.lockMs ?? 150,
    setTimer: (callback, ms) => {
      const handle = nextHandle++;
      timers.set(handle, { callback, ms });
      return handle;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
  });

  return {
    controller,
    attempts,
    pending: () => timers.size,
    delay: () => [...timers.values()][0]?.ms,
    /** Fires the pending timer, as if the lock had run out. */
    unlock: () => {
      const entry = [...timers.entries()][0];
      if (!entry) throw new Error('no timer is pending');
      timers.delete(entry[0]);
      entry[1].callback();
    },
  };
}

describe('createMoveController', () => {
  it('plays the first input immediately and locks for the configured time', () => {
    const t = setup({ lockMs: 220 });
    t.controller.input('left');
    expect(t.attempts).toEqual(['left']);
    expect(t.pending()).toBe(1);
    expect(t.delay()).toBe(220);
  });

  it('does not lock after a rejected move', () => {
    const t = setup({ rejects: ['left'] });
    t.controller.input('left');
    expect(t.pending()).toBe(0);
    t.controller.input('up');
    expect(t.attempts).toEqual(['left', 'up']);
  });

  it('queues input during the lock and plays it when the lock ends', () => {
    const t = setup();
    t.controller.input('left');
    t.controller.input('up');
    expect(t.attempts).toEqual(['left']);

    t.unlock();
    expect(t.attempts).toEqual(['left', 'up']);
    expect(t.pending()).toBe(1); // the queued move locked again
  });

  it('queues at most two moves, in order, and drops the newest extras', () => {
    const t = setup();
    for (const direction of ['left', 'up', 'right', 'down'] as const) {
      t.controller.input(direction);
    }
    t.unlock();
    t.unlock();
    t.unlock();
    expect(t.attempts).toEqual(['left', 'up', 'right']);
    expect(t.pending()).toBe(0);
  });

  it('skips queued moves that change nothing and plays the next one in the same tick', () => {
    const t = setup({ rejects: ['right'] });
    t.controller.input('left');
    t.controller.input('right');
    t.controller.input('up');

    t.unlock();
    expect(t.attempts).toEqual(['left', 'right', 'up']);
    expect(t.pending()).toBe(1);
  });

  it('ends up unlocked when every queued move turns out to be a no-op', () => {
    const t = setup({ rejects: ['right', 'down'] });
    t.controller.input('left');
    t.controller.input('right');
    t.controller.input('down');

    t.unlock();
    expect(t.pending()).toBe(0);

    t.controller.input('up');
    expect(t.attempts.at(-1)).toBe('up');
    expect(t.pending()).toBe(1);
  });

  it('reset forgets the queue and unlocks immediately', () => {
    const t = setup();
    t.controller.input('left');
    t.controller.input('up');
    t.controller.reset();
    expect(t.pending()).toBe(0);

    t.controller.input('right');
    expect(t.attempts).toEqual(['left', 'right']);

    t.unlock();
    expect(t.attempts).toEqual(['left', 'right']); // the old queued 'up' never ran
  });

  it('never locks or queues when the lock time is zero', () => {
    const t = setup({ lockMs: 0 });
    for (const direction of ['left', 'up', 'right'] as const) t.controller.input(direction);
    expect(t.attempts).toEqual(['left', 'up', 'right']);
    expect(t.pending()).toBe(0);
  });

  it('can be passed around unbound', () => {
    const t = setup();
    const { input } = t.controller;
    input('left');
    expect(t.attempts).toEqual(['left']);
  });
});
