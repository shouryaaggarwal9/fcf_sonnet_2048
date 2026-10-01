import { describe, expect, it } from 'vitest';
import { type KeyInfo, keyToDirection } from './input';

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
