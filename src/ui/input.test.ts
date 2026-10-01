import { describe, expect, it } from 'vitest';
import { type KeyInfo, keyToDirection, swipeToDirection } from './input';

function press(code: string, overrides: Partial<KeyInfo> = {}): KeyInfo {
  return {
    code,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    ...overrides,
  };
}

describe('keyToDirection', () => {
  it.each([
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down'],
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['KeyW', 'up'],
    ['KeyS', 'down'],
    ['KeyA', 'left'],
    ['KeyD', 'right'],
  ])('maps %s to %s', (code, direction) => {
    expect(keyToDirection(press(code))).toBe(direction);
  });

  it.each(['Space', 'Enter', 'Tab', 'Escape', 'KeyQ', 'Digit1', 'constructor'])(
    'ignores %s',
    (code) => {
      expect(keyToDirection(press(code))).toBeNull();
    },
  );

  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)(
    'ignores arrow keys while %s is held, so browser shortcuts keep working',
    (modifier) => {
      expect(keyToDirection(press('ArrowLeft', { [modifier]: true }))).toBeNull();
    },
  );

  it('still accepts Shift', () => {
    // KeyInfo has no shiftKey field on purpose: Shift never changes the meaning of a move.
    expect(keyToDirection(press('KeyW'))).toBe('up');
  });

  it('ignores auto-repeat from a held key', () => {
    expect(keyToDirection(press('ArrowRight', { repeat: true }))).toBeNull();
  });

  it('ignores keys pressed during IME composition', () => {
    expect(keyToDirection(press('KeyA', { isComposing: true }))).toBeNull();
  });
});

describe('swipeToDirection', () => {
  it.each([
    [40, 0, 'right'],
    [-40, 0, 'left'],
    [0, 40, 'down'],
    [0, -40, 'up'],
  ])('maps a drag of (%i, %i) to %s', (dx, dy, direction) => {
    expect(swipeToDirection(dx, dy)).toBe(direction);
  });

  it.each([
    [0, 0],
    [23, 0],
    [0, -23],
    [-20, 20],
  ])('ignores a drag of (%i, %i) as too short', (dx, dy) => {
    expect(swipeToDirection(dx, dy)).toBeNull();
  });

  it('accepts a drag of exactly the minimum distance', () => {
    expect(swipeToDirection(24, 0)).toBe('right');
  });

  it.each([
    [30, 20, 'right'],
    [-20, 30, 'down'],
    [-30, -29, 'left'],
    [10, -40, 'up'],
  ])('resolves the diagonal drag (%i, %i) to its longer axis, %s', (dx, dy, direction) => {
    expect(swipeToDirection(dx, dy)).toBe(direction);
  });

  it('ignores a perfectly diagonal drag instead of guessing', () => {
    expect(swipeToDirection(30, 30)).toBeNull();
  });

  it('respects a custom minimum distance', () => {
    expect(swipeToDirection(40, 0, 50)).toBeNull();
    expect(swipeToDirection(60, 0, 50)).toBe('right');
  });
});
