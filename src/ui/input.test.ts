import { describe, expect, it } from 'vitest';
import { isUndoKey, type KeyInfo, keyToDirection, swipeToDirection } from './input';

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

describe('isUndoKey', () => {
  it('accepts U on its own', () => {
    expect(isUndoKey(press('KeyU'))).toBe(true);
  });

  it('accepts Ctrl+Z and Cmd+Z', () => {
    expect(isUndoKey(press('KeyZ', { ctrlKey: true }))).toBe(true);
    expect(isUndoKey(press('KeyZ', { metaKey: true }))).toBe(true);
  });

  it('rejects plain Z, which is not a shortcut', () => {
    expect(isUndoKey(press('KeyZ'))).toBe(false);
  });

  it('rejects U with a modifier, so it cannot collide with a browser shortcut', () => {
    expect(isUndoKey(press('KeyU', { ctrlKey: true }))).toBe(false);
    expect(isUndoKey(press('KeyU', { metaKey: true }))).toBe(false);
  });

  it('rejects Ctrl+Cmd+Z, which no browser uses and no player means', () => {
    expect(isUndoKey(press('KeyZ', { ctrlKey: true, metaKey: true }))).toBe(false);
  });

  it('never fires on key repeat', () => {
    expect(isUndoKey(press('KeyU', { repeat: true }))).toBe(false);
    expect(isUndoKey(press('KeyZ', { ctrlKey: true, repeat: true }))).toBe(false);
  });

  it('never fires during IME composition', () => {
    expect(isUndoKey(press('KeyU', { isComposing: true }))).toBe(false);
  });

  it('never fires with Alt held, matching the direction rules', () => {
    expect(isUndoKey(press('KeyU', { altKey: true }))).toBe(false);
    expect(isUndoKey(press('KeyZ', { ctrlKey: true, altKey: true }))).toBe(false);
  });

  it('rejects every other key', () => {
    for (const code of ['ArrowUp', 'KeyW', 'Enter', 'Space', 'KeyY', 'F5']) {
      expect(isUndoKey(press(code))).toBe(false);
    }
  });

  it('does not overlap with the direction map, so no key triggers both', () => {
    for (const code of ['KeyU', 'KeyZ', 'ArrowUp', 'KeyW', 'Enter']) {
      const undoWins = isUndoKey(press(code));
      const isDirection = keyToDirection(press(code)) !== null;
      expect(undoWins && isDirection, code).toBe(false);
    }
  });

  it('still recognises undo when Ctrl is held, which keyToDirection refuses', () => {
    // This is the asymmetry that matters: keyToDirection ignores every modified key, so undo
    // cannot live inside it without losing Ctrl+Z entirely.
    expect(keyToDirection(press('KeyZ', { ctrlKey: true }))).toBeNull();
    expect(isUndoKey(press('KeyZ', { ctrlKey: true }))).toBe(true);
  });
});

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
