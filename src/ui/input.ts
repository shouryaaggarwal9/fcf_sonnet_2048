import type { Direction } from '../engine';

/** The parts of a KeyboardEvent we look at. A real KeyboardEvent satisfies this. */
export interface KeyInfo {
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
}

/** Physical key codes, so WASD stays in the same place on every keyboard layout. */
const KEY_MAP = new Map<string, Direction>([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['KeyW', 'up'],
  ['KeyS', 'down'],
  ['KeyA', 'left'],
  ['KeyD', 'right'],
]);

/** Returns the direction a key press means, or null if it should be ignored. */
export function keyToDirection(event: KeyInfo): Direction | null {
  if (event.repeat || event.isComposing) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  return KEY_MAP.get(event.code) ?? null;
}
